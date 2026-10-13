/**
 * Pure planner for evening shift-change notices ("Tomorrow: Night shift 22:00–06:00").
 * No React, React Native, storage, or native imports.
 */

import { AlarmItem, buildOccurrenceId } from './alarm';
import { ShiftConfig, ShiftType, getShiftForDate } from './shift';
import { addLocalDays, localDateTimeToMs, toLocalDateString } from './dates';

export const SHIFT_NOTICE_KIND = 'shift_notice';
export const SHIFT_NOTICE_PREFIX = 'shiftnotice';

/**
 * Shift rotations are irregular (overrides, mixed cycles), so notices are planned this far ahead
 * by JS and not rolled forward natively; any app start or shift edit tops them up.
 */
export const SHIFT_NOTICE_HORIZON_DAYS = 30;

export interface ShiftNoticeOptions {
  nowMs: number;
  horizonDays?: number;
  /** Localized title and message for tomorrow's shift. */
  text: (tomorrowShift: ShiftType, tomorrowDateStr: string) => { title: string; message: string };
}

/** True when shift notices should be sent (shifts enabled and the notice not switched off). */
export function shiftNoticesEnabled(config: ShiftConfig): boolean {
  return config.isEnabled && config.shiftChangeNotice !== false;
}

/** One notice at `eveningNotificationTime` on each evening before the shift changes. */
export function planShiftChangeNotices(config: ShiftConfig, options: ShiftNoticeOptions): AlarmItem[] {
  if (!shiftNoticesEnabled(config)) return [];
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.test(config.eveningNotificationTime)
    ? config.eveningNotificationTime
    : '20:00';
  const horizonDays = options.horizonDays ?? SHIFT_NOTICE_HORIZON_DAYS;
  const today = toLocalDateString(options.nowMs);
  const result: AlarmItem[] = [];

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const dateStr = addLocalDays(today, dayOffset);
    const triggerTimeMs = localDateTimeToMs(dateStr, time);
    if (triggerTimeMs <= options.nowMs) continue;

    const tomorrowStr = addLocalDays(dateStr, 1);
    const todayShift = getShiftForDate(config, dateStr).shiftType;
    const tomorrowShift = getShiftForDate(config, tomorrowStr).shiftType;
    if (todayShift.id === tomorrowShift.id) continue;

    const { title, message } = options.text(tomorrowShift, tomorrowStr);
    result.push({
      id: buildOccurrenceId(SHIFT_NOTICE_PREFIX, dateStr, time.replace(':', '')),
      category: 'reminder',
      profileId: 'default',
      title,
      message,
      channelId: 'routine',
      style: 'notification',
      triggerTimeMs,
      snoozeIntervalMinutes: 10,
      payload: { kind: SHIFT_NOTICE_KIND, date: tomorrowStr, shiftTypeId: tomorrowShift.id },
      actions: 'info'
    });
  }

  return result;
}
