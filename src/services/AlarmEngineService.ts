import { Platform, PermissionsAndroid } from 'react-native';
import {
  AlarmCategory,
  AlarmItem,
  HealthCheckStatus,
  RecurringSchedule,
  ReminderLogEntry,
  isSnoozeAlarmId,
  snoozeAlarmId
} from '../domain/alarm';
import { IReminderService, ScheduleAlarmParams } from './ReminderService';
import { planScheduleWindow } from '../domain/reminderPlanner';
import * as NativeAlarmEngine from '../../modules/alarm-engine';
import { storageService } from './StorageService';
import i18n from '../i18n';

// Internal payload keys used to carry JS metadata through the native engine (BUG-002).
const PAYLOAD_SCHEDULE_ID = '_scheduleId';
const PAYLOAD_CATEGORY = '_category';

interface SyncOptions {
  /** Reschedule every desired alarm even if unchanged (after settings or language changes). */
  force?: boolean;
  /** Keep a snoozed copy whose owner still exists. */
  keepSnooze?: (alarm: AlarmItem) => boolean;
}

function sameAlarm(a: AlarmItem, b: AlarmItem): boolean {
  return (
    a.triggerTimeMs === b.triggerTimeMs &&
    a.title === b.title &&
    a.message === b.message &&
    a.style === b.style &&
    a.snoozeIntervalMinutes === b.snoozeIntervalMinutes &&
    (a.soundUri || '') === (b.soundUri || '') &&
    (a.actions || 'dose') === (b.actions || 'dose')
  );
}

/**
 * JS side of the alarm engine. On Android with the native module, alarms live natively
 * (AlarmManager + SharedPreferences). Without it (web, Expo Go) they live in StorageService and the
 * in-app loop in App.tsx rings them.
 */
export class AlarmEngineService implements IReminderService {
  /** True when alarms are delivered by the Kotlin engine. */
  get isNative(): boolean {
    return NativeAlarmEngine.isAvailable();
  }

  // --- RECURRING SCHEDULES ---

  async createRecurringSchedule(
    schedule: Omit<RecurringSchedule, 'id' | 'createdAt'>
  ): Promise<RecurringSchedule> {
    const fullSchedule = await storageService.createRecurringSchedule(schedule);
    await this.logAction({
      profileId: 'default',
      alarmId: fullSchedule.id,
      action: 'SCHEDULED',
      timestampMs: Date.now(),
      scheduledTimeMs: Date.now(),
      note: `Created recurring schedule: ${fullSchedule.title} (${fullSchedule.recurrenceType})`
    });
    await this.replanRecurringSchedules();
    return fullSchedule;
  }

  async getRecurringSchedules(): Promise<RecurringSchedule[]> {
    return storageService.getRecurringSchedules();
  }

  async getRecurringScheduleById(id: string): Promise<RecurringSchedule | null> {
    return storageService.getRecurringScheduleById(id);
  }

  async updateRecurringSchedule(
    id: string,
    updates: Partial<Omit<RecurringSchedule, 'id' | 'createdAt'>>
  ): Promise<RecurringSchedule | null> {
    const updated = await storageService.updateRecurringSchedule(id, updates);
    if (updated) {
      await this.logAction({
        profileId: 'default',
        alarmId: id,
        action: 'SCHEDULED',
        timestampMs: Date.now(),
        scheduledTimeMs: Date.now(),
        note: `Updated schedule: ${updated.title}`
      });
      // Force: the time may be the same but title, message, or style may have changed.
      await this.replanRecurringSchedules({ force: true });
    }
    return updated;
  }

  async toggleRecurringSchedule(id: string, isEnabled: boolean): Promise<boolean> {
    const success = await storageService.toggleRecurringSchedule(id, isEnabled);
    await this.replanRecurringSchedules();
    return success;
  }

  async deleteRecurringSchedule(id: string): Promise<boolean> {
    const deleted = await storageService.deleteRecurringSchedule(id);
    if (deleted) {
      await this.logAction({
        profileId: 'default',
        alarmId: id,
        action: 'DISMISSED',
        timestampMs: Date.now(),
        scheduledTimeMs: Date.now(),
        note: `Deleted recurring schedule ${id}`
      });
      await this.replanRecurringSchedules();
    }
    return deleted;
  }

  /**
   * Brings scheduled alarms in line with the recurring schedules: adds missing occurrences, moves
   * changed ones, and cancels occurrences of disabled or deleted schedules (including their snoozes).
   */
  async replanRecurringSchedules(options: { force?: boolean } = {}): Promise<void> {
    const nowMs = Date.now();
    const schedules = await storageService.getRecurringSchedules();
    const enabledIds = new Set(schedules.filter((s) => s.isEnabled).map((s) => s.id));

    const desired: AlarmItem[] = [];
    for (const schedule of schedules) {
      if (!schedule.isEnabled) continue;
      desired.push(...planScheduleWindow(schedule, nowMs));
    }

    // Owned = any alarm generated from a recurring schedule. Older builds lost `scheduleId` on device,
    // so ids starting with the schedule prefix count too; stale ones get cancelled here.
    await this.syncAlarms(
      desired,
      (a) => !!a.scheduleId || a.id.startsWith('rec_'),
      {
        force: options.force,
        keepSnooze: (a) => !!a.scheduleId && enabledIds.has(a.scheduleId)
      }
    );
  }

  /**
   * Generic diff-based sync for a family of alarms (`isOwned` selects the family): cancels owned
   * alarms that aren't desired, and schedules desired alarms that are missing or changed.
   */
  async syncAlarms(
    desired: AlarmItem[],
    isOwned: (alarm: AlarmItem) => boolean,
    options: SyncOptions = {}
  ): Promise<void> {
    const existing = (await this.getScheduledAlarms()).filter(isOwned);
    const desiredIds = new Set(desired.map((d) => d.id));
    const existingById = new Map(existing.map((a) => [a.id, a]));

    for (const alarm of existing) {
      if (desiredIds.has(alarm.id)) continue;
      if (isSnoozeAlarmId(alarm.id) && options.keepSnooze?.(alarm)) continue;
      await this.cancelAlarm(alarm.id);
    }

    for (const item of desired) {
      const current = existingById.get(item.id);
      const presented = await this.applyPresentation(item);
      if (!options.force && current && sameAlarm(current, presented)) continue;
      await this.scheduleAlarmItem(presented);
    }
  }

  // --- SCHEDULING ---

  /** Applies user settings (full-screen on/off) to a planned alarm. */
  private async applyPresentation(item: AlarmItem): Promise<AlarmItem> {
    const settings = await storageService.getSettings();
    const style = item.style === 'full_alarm' && settings.fullScreenAlarmEnabled ? 'full_alarm' : 'notification';
    return { ...item, style };
  }

  /** Schedules a planned AlarmItem (keeps its repeat rule and metadata). */
  async scheduleAlarmItem(item: AlarmItem, options: { log?: boolean } = {}): Promise<boolean> {
    return this.scheduleAlarm(
      {
        id: item.id,
        scheduleId: item.scheduleId,
        category: item.category,
        triggerTimeMs: item.triggerTimeMs,
        title: item.title,
        message: item.message,
        channelId: item.channelId,
        isFullAlarm: item.style === 'full_alarm',
        snoozeIntervalMinutes: item.snoozeIntervalMinutes,
        payload: item.payload,
        repeat: item.repeat,
        soundUri: item.soundUri,
        actions: item.actions
      },
      options
    );
  }

  async scheduleAlarm(params: ScheduleAlarmParams, options: { log?: boolean } = { log: true }): Promise<boolean> {
    const settings = await storageService.getSettings();
    const snoozeMinutes = params.snoozeIntervalMinutes ?? settings.defaultSnoozeMinutes;
    const payload: Record<string, unknown> = { ...(params.payload || {}) };
    if (params.scheduleId) payload[PAYLOAD_SCHEDULE_ID] = params.scheduleId;
    if (params.category) payload[PAYLOAD_CATEGORY] = params.category;

    const alarmItem: AlarmItem = {
      id: params.id,
      scheduleId: params.scheduleId,
      category: params.category,
      profileId: 'default',
      title: params.title,
      message: params.message,
      channelId: params.channelId ?? 'medicines',
      style: params.isFullAlarm === false ? 'notification' : 'full_alarm',
      triggerTimeMs: params.triggerTimeMs,
      snoozeIntervalMinutes: snoozeMinutes,
      payload: params.payload,
      repeat: params.repeat,
      soundUri: params.soundUri,
      actions: params.actions
    };

    let ok = true;
    if (this.isNative) {
      ok = await NativeAlarmEngine.scheduleAlarm({
        id: params.id,
        triggerTimeMs: params.triggerTimeMs,
        title: params.title,
        message: params.message,
        channelId: alarmItem.channelId,
        isFullAlarm: alarmItem.style === 'full_alarm',
        snoozeIntervalMinutes: snoozeMinutes,
        payload,
        repeatEveryDays: params.repeat?.everyDays ?? 0,
        repeatUntilMs: params.repeat?.untilMs ?? 0,
        seriesPrefix: params.repeat?.seriesPrefix ?? '',
        seriesSuffix: params.repeat?.seriesSuffix ?? '',
        vibrate: settings.vibrationEnabled,
        autoDismissMinutes: settings.autoDismissMinutes,
        labels: {
          taken: i18n.t('reminders.taken'),
          snooze: i18n.t('reminders.snooze', { minutes: snoozeMinutes }),
          skip: i18n.t('reminders.skip'),
          badge: i18n.t('reminders.badge'),
          ok: i18n.t('common.ok')
        },
        soundUri: params.soundUri || '',
        infoOnly: params.actions === 'info'
      });
    } else {
      await storageService.saveScheduledAlarm(alarmItem);
    }

    if (options.log) {
      await this.logAction({
        profileId: 'default',
        alarmId: params.id,
        action: 'SCHEDULED',
        timestampMs: Date.now(),
        scheduledTimeMs: params.triggerTimeMs,
        note: `Scheduled for ${new Date(params.triggerTimeMs).toLocaleString()}`
      });
    }
    return ok;
  }

  /** Schedules a one-off snoozed copy of an alarm (used by the in-app ringing modal and Today). */
  async snooze(alarm: AlarmItem, minutes: number): Promise<void> {
    await this.scheduleAlarm(
      {
        id: snoozeAlarmId(alarm.id),
        scheduleId: alarm.scheduleId,
        category: alarm.category,
        triggerTimeMs: Date.now() + minutes * 60 * 1000,
        title: alarm.title,
        message: alarm.message,
        channelId: alarm.channelId,
        isFullAlarm: alarm.style === 'full_alarm',
        snoozeIntervalMinutes: minutes,
        payload: alarm.payload,
        soundUri: alarm.soundUri,
        actions: alarm.actions
      },
      { log: false }
    );
  }

  async cancelAlarm(id: string): Promise<boolean> {
    if (this.isNative) {
      await NativeAlarmEngine.cancelAlarm(id);
    } else {
      await storageService.deleteScheduledAlarm(id);
    }
    return true;
  }

  async cancelAll(): Promise<boolean> {
    if (this.isNative) {
      await NativeAlarmEngine.cancelAll();
    }
    await storageService.clearAllScheduledAlarms();
    return true;
  }

  /** Upcoming alarms. Read-only: never writes storage. */
  async getScheduledAlarms(): Promise<AlarmItem[]> {
    if (!this.isNative) {
      return storageService.getScheduledAlarms();
    }
    const nativeAlarms = await NativeAlarmEngine.getScheduledAlarms();
    return nativeAlarms
      .map((n) => {
        let payload: Record<string, unknown> = {};
        try {
          payload = n.payloadJson ? JSON.parse(n.payloadJson) : {};
        } catch {
          payload = {};
        }
        const scheduleId = typeof payload[PAYLOAD_SCHEDULE_ID] === 'string' ? (payload[PAYLOAD_SCHEDULE_ID] as string) : undefined;
        const category = typeof payload[PAYLOAD_CATEGORY] === 'string' ? (payload[PAYLOAD_CATEGORY] as AlarmCategory) : undefined;
        delete payload[PAYLOAD_SCHEDULE_ID];
        delete payload[PAYLOAD_CATEGORY];
        const item: AlarmItem = {
          id: n.id,
          scheduleId,
          category,
          profileId: 'default',
          title: n.title,
          message: n.message,
          channelId: (n.channelId as AlarmItem['channelId']) || 'medicines',
          style: n.isFullAlarm ? 'full_alarm' : 'notification',
          triggerTimeMs: n.triggerTimeMs,
          snoozeIntervalMinutes: n.snoozeIntervalMinutes,
          payload: Object.keys(payload).length > 0 ? payload : undefined,
          soundUri: n.soundUri || undefined,
          actions: n.infoOnly ? 'info' : 'dose'
        };
        return item;
      })
      .sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
  }

  /** Native actions (notification / lock-screen taps, misses) queued while JS wasn't looking. */
  async drainNativeActions(): Promise<NativeAlarmEngine.NativePendingAction[]> {
    if (!this.isNative) return [];
    return NativeAlarmEngine.drainPendingActions();
  }

  // --- REMINDER LOGS ---

  async logAction(entry: Omit<ReminderLogEntry, 'id'>): Promise<void> {
    await storageService.addLog(entry);
  }

  async getLogs(limit?: number): Promise<ReminderLogEntry[]> {
    return storageService.getLogs(limit);
  }

  async clearLogs(): Promise<void> {
    await storageService.clearLogs();
  }

  async deleteLog(id: string): Promise<boolean> {
    return storageService.deleteLogById(id);
  }

  // --- HEALTH CHECK & DIAGNOSTICS ---

  async getHealthCheck(): Promise<HealthCheckStatus> {
    const [exactAllowed, batteryIgnored, manufacturer, alarms, lastFired, channels, fullScreenAllowed] =
      await Promise.all([
        this.canScheduleExactAlarms(),
        this.isIgnoringBatteryOptimizations(),
        this.getManufacturer(),
        this.getScheduledAlarms(),
        NativeAlarmEngine.getLastFiredAlarm(),
        this.getNotificationChannels(),
        NativeAlarmEngine.canUseFullScreenIntent()
      ]);

    const nextUpcoming = alarms.filter((a) => a.triggerTimeMs >= Date.now())[0];

    let notifsAllowed = true;
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      try {
        notifsAllowed = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      } catch {
        notifsAllowed = true;
      }
    }

    return {
      exactAlarmsAllowed: exactAllowed,
      notificationsAllowed: notifsAllowed,
      batteryOptimizationsIgnored: batteryIgnored,
      fullScreenIntentAllowed: fullScreenAllowed,
      manufacturer: manufacturer || 'Android Device',
      scheduledCount: alarms.length,
      nextScheduledTimeMs: nextUpcoming?.triggerTimeMs,
      notificationChannelsCount: channels.length,
      lastFiredAlarm: lastFired
        ? {
            id: lastFired.id,
            title: lastFired.title,
            firedAtMs: lastFired.firedAtMs || Date.now()
          }
        : null
    };
  }

  // --- TONES ---

  /** The phone's sounds for the tone picker (empty on web, where only the default tone exists). */
  async getSystemTones(): Promise<NativeAlarmEngine.NativeTone[]> {
    return NativeAlarmEngine.getSystemTones();
  }

  async previewTone(uri: string): Promise<boolean> {
    return NativeAlarmEngine.previewTone(uri);
  }

  async stopTonePreview(): Promise<void> {
    await NativeAlarmEngine.stopTonePreview();
  }

  async canScheduleExactAlarms(): Promise<boolean> {
    return NativeAlarmEngine.canScheduleExactAlarms();
  }

  async openExactAlarmSettings(): Promise<boolean> {
    return NativeAlarmEngine.openExactAlarmSettings();
  }

  async canUseFullScreenIntent(): Promise<boolean> {
    return NativeAlarmEngine.canUseFullScreenIntent();
  }

  async openFullScreenIntentSettings(): Promise<boolean> {
    return NativeAlarmEngine.openFullScreenIntentSettings();
  }

  async isIgnoringBatteryOptimizations(): Promise<boolean> {
    return NativeAlarmEngine.isIgnoringBatteryOptimizations();
  }

  async requestIgnoreBatteryOptimizations(): Promise<boolean> {
    return NativeAlarmEngine.requestIgnoreBatteryOptimizations();
  }

  async getManufacturer(): Promise<string> {
    return NativeAlarmEngine.getManufacturer();
  }

  async openAutostartSettings(): Promise<boolean> {
    return NativeAlarmEngine.openAutostartSettings();
  }

  async openChannelNotificationSettings(channelId: string): Promise<boolean> {
    return NativeAlarmEngine.openChannelNotificationSettings(channelId);
  }

  async openAppNotificationSettings(): Promise<boolean> {
    return NativeAlarmEngine.openAppNotificationSettings();
  }

  async getNotificationChannels(): Promise<NativeAlarmEngine.NativeChannelInfo[]> {
    return NativeAlarmEngine.getNotificationChannels();
  }

  /** Asks for notification permission (Android 13+ runtime permission, or the browser on web). */
  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }
}

export const reminderService = new AlarmEngineService();
