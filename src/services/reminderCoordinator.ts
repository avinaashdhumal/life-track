import { AlarmItem, ReminderActionType } from '../domain/alarm';
import { DoseStatus, Medicine, TodayDoseSlot } from '../domain/medicine';
import {
  getMedicineIdFromPayload,
  handledSlotKeysFromLogs,
  medicineAlarmId,
  medicineSeriesPrefix,
  planMedicineReminders,
  slotKey
} from '../domain/medicineReminders';
import { planNextInSeries } from '../domain/reminderPlanner';
import { localDateTimeToMs, startOfLocalDay, toLocalDateString } from '../domain/dates';
import { medicinesRepository } from '../data/medicinesRepository';
import { routineRepository } from '../data/routineRepository';
import { AppSettings, STORAGE_KEYS, storageService } from './StorageService';
import { reminderService } from './AlarmEngineService';
import i18n from '../i18n';

export type InAppAlarmAction = 'TAKEN' | 'SNOOZE' | 'DISMISS';

interface AlarmActionEvent {
  alarmId: string;
  action: ReminderActionType;
  atMs: number;
  triggerTimeMs: number;
  title: string;
  payload?: Record<string, unknown>;
}

const FOOD_LABEL_KEYS: Record<string, string | null> = {
  before: 'medicines.foodBefore',
  with: 'medicines.foodWith',
  after: 'medicines.foodAfter',
  empty_stomach: 'medicines.foodEmptyStomach',
  no_relation: null
};

/** Settings that change how scheduled alarms look or behave; a change triggers a forced resync. */
const ALARM_SETTING_KEYS: (keyof AppSettings)[] = [
  'language',
  'fullScreenAlarmEnabled',
  'vibrationEnabled',
  'defaultSnoozeMinutes',
  'autoDismissMinutes'
];

function parseSnoozedSlot(alarmId: string): { dateStr: string; time: string } | null {
  const match = /_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})_snooze$/.exec(alarmId);
  if (!match) return null;
  return { dateStr: `${match[1]}-${match[2]}-${match[3]}`, time: `${match[4]}:${match[5]}` };
}

/**
 * Orchestrates reminders across repositories and the alarm engine:
 * - keeps medicine alarms in sync with medicines, the routine, dose logs, and settings (BUG-001)
 * - applies native notification/lock-screen actions to dose history and stock (BUG-004)
 * - runs the in-app alarm engine when the native module is absent (DEBT-003)
 * All work is serialized so concurrent edits can't interleave half-finished syncs.
 */
class ReminderCoordinator {
  private queue: Promise<unknown> = Promise.resolve();
  private started = false;
  private lastAlarmSettings = '';
  private settingsTimer: ReturnType<typeof setTimeout> | null = null;

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch((err) => console.warn('[ReminderCoordinator] task failed:', err));
    return run;
  }

  private alarmSettingsSignature(settings: AppSettings): string {
    return JSON.stringify(ALARM_SETTING_KEYS.map((k) => settings[k]));
  }

  /** Subscribes to data changes. Call once at app start (after migrations). */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.lastAlarmSettings = this.alarmSettingsSignature(storageService.getSyncSettings());

    medicinesRepository.changes.subscribe((event) => {
      if (event.type === 'stock') return;
      // Edits change alarm text, so force; dose logs only add/remove occurrences.
      this.enqueue(() => this.syncMedicine(event.medicineId, event.type === 'upserted'));
    });

    routineRepository.changes.subscribe(() => {
      this.enqueue(() => this.syncAllMedicines());
    });

    storageService.subscribe((key) => {
      if (key !== STORAGE_KEYS.SETTINGS) return;
      if (this.settingsTimer) clearTimeout(this.settingsTimer);
      this.settingsTimer = setTimeout(async () => {
        const signature = this.alarmSettingsSignature(await storageService.getSettings());
        if (signature !== this.lastAlarmSettings) {
          this.lastAlarmSettings = signature;
          this.enqueue(() => this.syncAll({ force: true }));
        }
      }, 500);
    });
  }

  /** Startup and app-foreground work: apply queued native actions, then top up all reminders. */
  refresh(options: { force?: boolean } = {}): Promise<void> {
    return this.enqueue(async () => {
      await this.processNativeActions();
      await this.syncAll(options);
    });
  }

  /** Re-plans everything (after restore, migration, or a settings change). */
  rebuildAll(): Promise<void> {
    return this.enqueue(() => this.syncAll({ force: true }));
  }

  private async syncAll(options: { force?: boolean } = {}): Promise<void> {
    await reminderService.replanRecurringSchedules(options);
    await this.syncAllMedicines(options);
  }

  // --- Medicine reminders ---

  private medicineText = (medicine: Medicine, time: string) => {
    const foodKey = FOOD_LABEL_KEYS[medicine.foodRelation];
    const parts = [medicine.strength, foodKey ? i18n.t(foodKey) : '', medicine.instructions || '']
      .map((p) => (p || '').trim())
      .filter(Boolean);
    return {
      title: i18n.t('reminders.medicineTitle', { name: medicine.name }),
      message: parts.length > 0 ? parts.join(' · ') : i18n.t('reminders.medicineDefault', { time })
    };
  };

  private async planMedicines(medicines: Medicine[]): Promise<{ desired: AlarmItem[]; handled: Set<string> }> {
    const [routine, settings, logs] = await Promise.all([
      routineRepository.getRoutine('default'),
      storageService.getSettings(),
      medicinesRepository.getDosesSince(startOfLocalDay(Date.now()))
    ]);
    // Settled slots (taken/skipped) also drop their snooze copies; snoozed slots only drop the
    // original alarm (the snooze copy replaces it).
    const handled = handledSlotKeysFromLogs(logs);
    const suppressed = handledSlotKeysFromLogs(logs, ['taken', 'skipped', 'snoozed']);
    const nowMs = Date.now();
    const desired = medicines.flatMap((medicine) =>
      planMedicineReminders(medicine, {
        nowMs,
        routine,
        handledSlotKeys: suppressed,
        style: 'full_alarm',
        snoozeMinutes: settings.defaultSnoozeMinutes,
        text: this.medicineText
      })
    );
    return { desired, handled };
  }

  private keepMedicineSnooze(activeIds: Set<string>, handled: Set<string>) {
    return (alarm: AlarmItem): boolean => {
      const medicineId = getMedicineIdFromPayload(alarm.payload);
      if (!medicineId || !activeIds.has(medicineId)) return false;
      const slot = parseSnoozedSlot(alarm.id);
      return !slot || !handled.has(slotKey(slot.dateStr, slot.time));
    };
  }

  private async syncAllMedicines(options: { force?: boolean } = {}): Promise<void> {
    const medicines = await medicinesRepository.getAll('default');
    const activeIds = new Set(medicines.filter((m) => m.isActive).map((m) => m.id));
    const { desired, handled } = await this.planMedicines(medicines);
    await reminderService.syncAlarms(
      desired,
      (a) => getMedicineIdFromPayload(a.payload) !== null || a.id.startsWith('dose_'),
      { force: options.force, keepSnooze: this.keepMedicineSnooze(activeIds, handled) }
    );
  }

  private async syncMedicine(medicineId: string, force: boolean): Promise<void> {
    const medicine = await medicinesRepository.getById(medicineId);
    const medicines = medicine ? [medicine] : [];
    const activeIds = new Set(medicines.filter((m) => m.isActive).map((m) => m.id));
    const { desired, handled } = await this.planMedicines(medicines);
    const prefix = `${medicineSeriesPrefix(medicineId)}_`;
    await reminderService.syncAlarms(
      desired,
      (a) => getMedicineIdFromPayload(a.payload) === medicineId || a.id.startsWith(prefix),
      { force, keepSnooze: this.keepMedicineSnooze(activeIds, handled) }
    );
  }

  /** Today screen "Snooze": record it and actually schedule a reminder in N minutes. */
  snoozeDose(slot: TodayDoseSlot): Promise<number> {
    return this.enqueue(async () => {
      const [medicine, settings] = await Promise.all([
        medicinesRepository.getById(slot.medicineId),
        storageService.getSettings()
      ]);
      const minutes = settings.defaultSnoozeMinutes;
      if (!medicine) return minutes;

      await medicinesRepository.logDose({
        profileId: 'default',
        medicineId: slot.medicineId,
        medicineName: slot.medicineName,
        scheduledTime: slot.scheduledTime,
        scheduledTimestampMs: slot.scheduledTimestampMs,
        takenTimestampMs: Date.now(),
        status: 'snoozed',
        quantityTaken: 0,
        notes: `Snoozed ${minutes} minutes`
      });

      // The 'snoozed' log above triggers a medicine sync (queued after this task) that drops the
      // slot's original alarm and keeps the series going; here we add the snooze copy.
      const dateStr = toLocalDateString(slot.scheduledTimestampMs);
      const baseId = medicineAlarmId(medicine.id, dateStr, slot.scheduledTime);
      const { title, message } = this.medicineText(medicine, slot.scheduledTime);
      await reminderService.snooze(
        {
          id: baseId,
          category: 'medicine',
          profileId: 'default',
          title,
          message,
          channelId: 'medicines',
          style: settings.fullScreenAlarmEnabled ? 'full_alarm' : 'notification',
          triggerTimeMs: slot.scheduledTimestampMs,
          snoozeIntervalMinutes: minutes,
          payload: { kind: 'medicine_dose', medicineId: medicine.id, scheduledTime: slot.scheduledTime }
        },
        minutes
      );
      return minutes;
    });
  }

  // --- Actions (native queue and in-app modal) ---

  private async processNativeActions(): Promise<void> {
    const actions = await reminderService.drainNativeActions();
    for (const native of actions) {
      let payload: Record<string, unknown> | undefined;
      try {
        payload = native.payloadJson ? JSON.parse(native.payloadJson) : undefined;
      } catch {
        payload = undefined;
      }
      await this.applyAction({
        alarmId: native.alarmId,
        action: native.action as ReminderActionType,
        atMs: native.atMs,
        triggerTimeMs: native.triggerTimeMs,
        title: native.title,
        payload
      });
    }
  }

  /** Records a reminder action and, for medicine reminders, the matching dose log. */
  private async applyAction(event: AlarmActionEvent): Promise<string | undefined> {
    await reminderService.logAction({
      profileId: 'default',
      alarmId: event.alarmId,
      action: event.action,
      timestampMs: event.atMs,
      scheduledTimeMs: event.triggerTimeMs,
      note: event.title ? `${event.title}` : undefined
    });

    const medicineId = getMedicineIdFromPayload(event.payload);
    const statusByAction: Partial<Record<ReminderActionType, DoseStatus>> = {
      TAKEN: 'taken',
      SKIPPED: 'skipped',
      SNOOZED: 'snoozed',
      MISSED: 'missed'
    };
    const status = statusByAction[event.action];
    if (!medicineId || !status) return undefined;

    const medicine = await medicinesRepository.getById(medicineId);
    if (!medicine) return undefined;

    const scheduledTime = typeof event.payload?.scheduledTime === 'string' ? event.payload.scheduledTime : undefined;
    let scheduledTimestampMs = event.triggerTimeMs;
    if (scheduledTime) {
      // The slot's own time on the day it fired (a snoozed copy fires later than the slot).
      scheduledTimestampMs = localDateTimeToMs(toLocalDateString(event.triggerTimeMs), scheduledTime);
      if (scheduledTimestampMs > event.triggerTimeMs) {
        scheduledTimestampMs -= 24 * 60 * 60 * 1000;
      }
    }

    if (status === 'missed' && scheduledTime) {
      // Don't mark missed if the dose was already taken or skipped in the app.
      const logs = await medicinesRepository.getDosesSince(startOfLocalDay(scheduledTimestampMs));
      const handled = handledSlotKeysFromLogs(logs);
      if (handled.has(slotKey(toLocalDateString(scheduledTimestampMs), scheduledTime))) return undefined;
    }

    const result = await medicinesRepository.logDose({
      profileId: 'default',
      medicineId,
      medicineName: medicine.name,
      scheduledTime,
      scheduledTimestampMs,
      takenTimestampMs: event.atMs,
      status,
      quantityTaken: status === 'taken' ? 1 : 0,
      notes: 'Logged from reminder'
    });
    return result.safetyWarning;
  }

  /** In-app ringing modal (no native module): returns a safety warning to show, if any. */
  handleInAppAction(alarm: AlarmItem, action: InAppAlarmAction): Promise<string | undefined> {
    return this.enqueue(async () => {
      const now = Date.now();
      if (action === 'SNOOZE') {
        await reminderService.snooze(alarm, alarm.snoozeIntervalMinutes || 10);
      }
      return this.applyAction({
        alarmId: alarm.id,
        action: action === 'TAKEN' ? 'TAKEN' : action === 'SNOOZE' ? 'SNOOZED' : 'SKIPPED',
        atMs: now,
        triggerTimeMs: alarm.triggerTimeMs,
        title: alarm.title,
        payload: alarm.payload
      });
    });
  }

  /**
   * In-app alarm engine for when there is no native module. Wakes at the next due alarm (capped at
   * one minute) instead of polling every second, and never writes storage unless an alarm fires.
   */
  startInAppEngine(onRing: (alarm: AlarmItem) => void): () => void {
    if (reminderService.isNative) return () => undefined;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let busy = false;

    const arm = async () => {
      if (stopped || busy) return;
      busy = true;
      if (timer) clearTimeout(timer);
      let nextDelay = 60_000;
      try {
        const alarms = await reminderService.getScheduledAlarms();
        const now = Date.now();
        const due = alarms.find((a) => a.triggerTimeMs <= now);
        if (due) {
          await this.enqueue(async () => {
            await reminderService.cancelAlarm(due.id);
            const next = planNextInSeries(due, Date.now());
            if (next) await reminderService.scheduleAlarmItem(next);
            await this.applyAction({
              alarmId: due.id,
              action: 'FIRED',
              atMs: Date.now(),
              triggerTimeMs: due.triggerTimeMs,
              title: due.title,
              payload: due.payload
            });
          });
          onRing(due);
          nextDelay = 1000;
        } else if (alarms.length > 0) {
          nextDelay = Math.min(Math.max(alarms[0].triggerTimeMs - now, 250), 60_000);
        }
      } catch (err) {
        console.warn('[ReminderCoordinator] in-app engine error:', err);
      } finally {
        busy = false;
      }
      if (!stopped) timer = setTimeout(arm, nextDelay);
    };

    const unsubscribe = storageService.subscribe((key) => {
      if (key === STORAGE_KEYS.ALARMS) arm();
    });
    arm();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }
}

export const reminderCoordinator = new ReminderCoordinator();
