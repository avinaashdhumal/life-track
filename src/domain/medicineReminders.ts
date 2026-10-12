/**
 * Pure planner that turns a Medicine into the reminder alarms that should be scheduled.
 * No React, React Native, storage, or native imports.
 */

import { AlarmItem, AlarmStyle, buildOccurrenceId } from './alarm';
import { DoseLogEntry, Medicine, getMedicineDoseTimes } from './medicine';
import { DailyRoutine } from './routine';
import { ROLLING_WINDOW_DAYS } from './reminderPlanner';
import { addLocalDays, localDateTimeToMs, toLocalDateString } from './dates';

export const MEDICINE_ALARM_KIND = 'medicine_dose';

export interface MedicineReminderPayload extends Record<string, unknown> {
  kind: typeof MEDICINE_ALARM_KIND;
  medicineId: string;
  scheduledTime: string; // "HH:mm"
}

export interface MedicineReminderOptions {
  nowMs: number;
  routine?: DailyRoutine;
  windowDays?: number;
  /** Slots already taken or skipped, as `slotKey(date, time)`. They get no alarm. */
  handledSlotKeys?: Set<string>;
  style: AlarmStyle;
  snoozeMinutes: number;
  /** Localized title and message for a dose at `time`. */
  text: (medicine: Medicine, time: string) => { title: string; message: string };
}

export function slotKey(dateStr: string, time: string): string {
  return `${dateStr}_${time}`;
}

/**
 * Slot keys for dose logs with one of `statuses`. By default taken/skipped (the dose is settled).
 * Planning also passes 'snoozed': a snoozed slot's original alarm is replaced by its snooze copy.
 */
export function handledSlotKeysFromLogs(
  logs: DoseLogEntry[],
  statuses: DoseLogEntry['status'][] = ['taken', 'skipped']
): Set<string> {
  const keys = new Set<string>();
  for (const log of logs) {
    if (statuses.includes(log.status) && log.scheduledTime) {
      const dateStr = toLocalDateString(log.scheduledTimestampMs ?? log.takenTimestampMs);
      keys.add(slotKey(dateStr, log.scheduledTime));
    }
  }
  return keys;
}

/** Alarm id prefix for every reminder of this medicine. */
export function medicineSeriesPrefix(medicineId: string): string {
  return `dose_${medicineId}`;
}

export function medicineAlarmId(medicineId: string, dateStr: string, time: string): string {
  return buildOccurrenceId(medicineSeriesPrefix(medicineId), dateStr, time.replace(':', ''));
}

export function getMedicineIdFromPayload(payload: Record<string, unknown> | undefined): string | null {
  if (payload && payload.kind === MEDICINE_ALARM_KIND && typeof payload.medicineId === 'string') {
    return payload.medicineId;
  }
  return null;
}

/**
 * Alarms a medicine should have scheduled for the next `windowDays` days.
 * Inactive and as-needed (PRN) medicines get none. Each alarm carries a native repeat rule so the
 * series keeps going even if the app isn't opened.
 */
export function planMedicineReminders(medicine: Medicine, options: MedicineReminderOptions): AlarmItem[] {
  if (!medicine.isActive || medicine.scheduleType === 'prn_as_needed') {
    return [];
  }

  const windowDays = options.windowDays ?? ROLLING_WINDOW_DAYS;
  const times = getMedicineDoseTimes(medicine, options.routine);
  const handled = options.handledSlotKeys ?? new Set<string>();
  const horizonEndMs = options.nowMs + windowDays * 24 * 60 * 60 * 1000;
  const today = toLocalDateString(options.nowMs);
  const result = new Map<string, AlarmItem>();

  const addAlarm = (dateStr: string, time: string) => {
    const triggerTimeMs = localDateTimeToMs(dateStr, time);
    const id = medicineAlarmId(medicine.id, dateStr, time);
    if (result.has(id)) return;
    const { title, message } = options.text(medicine, time);
    const payload: MedicineReminderPayload = {
      kind: MEDICINE_ALARM_KIND,
      medicineId: medicine.id,
      scheduledTime: time
    };
    result.set(id, {
      id,
      category: 'medicine',
      profileId: medicine.profileId || 'default',
      title,
      message,
      channelId: 'medicines',
      style: options.style,
      triggerTimeMs,
      snoozeIntervalMinutes: options.snoozeMinutes,
      payload,
      repeat: {
        everyDays: windowDays,
        seriesPrefix: medicineSeriesPrefix(medicine.id),
        seriesSuffix: time.replace(':', '')
      }
    });
  };

  // Day 0..windowDays inclusive; the time filter keeps exactly one roll period (now, now + window].
  for (let dayOffset = 0; dayOffset <= windowDays; dayOffset++) {
    const dateStr = addLocalDays(today, dayOffset);
    for (const time of times) {
      const triggerTimeMs = localDateTimeToMs(dateStr, time);
      if (triggerTimeMs <= options.nowMs || triggerTimeMs > horizonEndMs) continue;
      if (handled.has(slotKey(dateStr, time))) {
        // No alarm for a dose already taken/skipped, but schedule its successor directly:
        // the native engine only rolls a series forward when an occurrence fires.
        addAlarm(addLocalDays(dateStr, windowDays), time);
        continue;
      }
      addAlarm(dateStr, time);
    }
  }

  return Array.from(result.values()).sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
}
