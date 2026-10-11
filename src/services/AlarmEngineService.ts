import { Platform, PermissionsAndroid } from 'react-native';
import { AlarmItem, HealthCheckStatus, RecurringSchedule, ReminderLogEntry } from '../domain/alarm';
import { IReminderService, ScheduleAlarmParams } from './ReminderService';
import { planOccurrencesForRecurringSchedule } from '../domain/reminderPlanner';
import * as NativeAlarmEngine from '../../modules/alarm-engine';
import { storageService, StorageInfo } from './StorageService';

export class AlarmEngineService implements IReminderService {
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    try {
      // Ensure recurring schedules exist and plan occurrences
      await this.replanRecurringSchedules();
    } catch (err) {
      console.warn('[AlarmEngineService] Error during persistent initialization:', err);
    }
  }

  // --- RECURRING SCHEDULES (CRUD) ---

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
      // Clean up previous occurrences for this schedule before re-planning
      const activeAlarms = await this.getScheduledAlarms();
      for (const a of activeAlarms) {
        if (a.scheduleId === id) {
          await this.cancelAlarm(a.id);
        }
      }

      await this.logAction({
        profileId: 'default',
        alarmId: id,
        action: 'SCHEDULED',
        timestampMs: Date.now(),
        scheduledTimeMs: Date.now(),
        note: `Updated schedule: ${updated.title}`
      });

      if (updated.isEnabled) {
        await this.replanRecurringSchedules();
      }
    }
    return updated;
  }

  async toggleRecurringSchedule(id: string, isEnabled: boolean): Promise<boolean> {
    const success = await storageService.toggleRecurringSchedule(id, isEnabled);
    if (!isEnabled) {
      // Cancel upcoming occurrences for disabled schedule
      const alarms = await this.getScheduledAlarms();
      for (const a of alarms) {
        if (a.scheduleId === id) {
          await this.cancelAlarm(a.id);
        }
      }
    } else {
      await this.replanRecurringSchedules();
    }
    return success;
  }

  async deleteRecurringSchedule(id: string): Promise<boolean> {
    // Remove all upcoming occurrences belonging to this schedule
    const alarms = await this.getScheduledAlarms();
    for (const a of alarms) {
      if (a.scheduleId === id) {
        await this.cancelAlarm(a.id);
      }
    }

    const deleted = await storageService.deleteRecurringSchedule(id);
    if (deleted) {
      await this.logAction({
        profileId: 'default',
        alarmId: id,
        action: 'SKIPPED',
        timestampMs: Date.now(),
        scheduledTimeMs: Date.now(),
        note: `Deleted recurring schedule ${id}`
      });
      await this.replanRecurringSchedules();
    }
    return deleted;
  }

  async replanRecurringSchedules(): Promise<void> {
    const nowMs = Date.now();
    const schedules = await storageService.getRecurringSchedules();
    const activeAlarms = await storageService.getScheduledAlarms();
    const activeAlarmIds = new Set(activeAlarms.map((a) => a.id));

    for (const schedule of schedules) {
      if (!schedule.isEnabled) continue;
      // Plan occurrences for next 14 days
      const occurrences = planOccurrencesForRecurringSchedule(schedule, nowMs, 5, 14);
      for (const occ of occurrences) {
        if (!activeAlarmIds.has(occ.id)) {
          await this.scheduleAlarm({
            id: occ.id,
            scheduleId: schedule.id,
            category: occ.category || schedule.category,
            triggerTimeMs: occ.triggerTimeMs,
            title: occ.title,
            message: occ.message,
            channelId: occ.channelId,
            isFullAlarm: occ.style === 'full_alarm',
            snoozeIntervalMinutes: occ.snoozeIntervalMinutes,
            payload: occ.payload
          });
          activeAlarmIds.add(occ.id);
        }
      }
    }
  }

  // --- SCHEDULED ALARMS (CRUD) ---

  async scheduleAlarm(params: ScheduleAlarmParams): Promise<boolean> {
    const nativeSuccess = await NativeAlarmEngine.scheduleAlarm({
      id: params.id,
      triggerTimeMs: params.triggerTimeMs,
      title: params.title,
      message: params.message,
      channelId: params.channelId ?? 'medicines',
      isFullAlarm: params.isFullAlarm ?? true,
      snoozeIntervalMinutes: params.snoozeIntervalMinutes ?? 10,
      payload: params.payload
    });

    const alarmItem: AlarmItem = {
      id: params.id,
      scheduleId: params.scheduleId,
      category: params.category,
      profileId: 'default',
      title: params.title,
      message: params.message,
      channelId: params.channelId ?? 'medicines',
      style: params.isFullAlarm ? 'full_alarm' : 'notification',
      triggerTimeMs: params.triggerTimeMs,
      snoozeIntervalMinutes: params.snoozeIntervalMinutes ?? 10,
      payload: params.payload
    };

    // Persist to phone storage
    await storageService.saveScheduledAlarm(alarmItem);

    await this.logAction({
      profileId: 'default',
      alarmId: params.id,
      action: 'SCHEDULED',
      timestampMs: Date.now(),
      scheduledTimeMs: params.triggerTimeMs,
      note: `Scheduled for ${new Date(params.triggerTimeMs).toLocaleTimeString()}`
    });

    return nativeSuccess || true;
  }

  async cancelAlarm(id: string): Promise<boolean> {
    await NativeAlarmEngine.cancelAlarm(id);
    await storageService.deleteScheduledAlarm(id);

    await this.logAction({
      profileId: 'default',
      alarmId: id,
      action: 'SKIPPED',
      timestampMs: Date.now(),
      scheduledTimeMs: Date.now(),
      note: 'Alarm cancelled'
    });
    return true;
  }

  async cancelAll(): Promise<boolean> {
    await NativeAlarmEngine.cancelAll();
    await storageService.clearAllScheduledAlarms();
    return true;
  }

  async getScheduledAlarms(): Promise<AlarmItem[]> {
    const nativeAlarms = await NativeAlarmEngine.getScheduledAlarms();
    if (nativeAlarms && nativeAlarms.length > 0) {
      const mapped: AlarmItem[] = nativeAlarms.map((n) => ({
        id: n.id,
        profileId: 'default',
        title: n.title,
        message: n.message,
        channelId: (n.channelId as any) || 'medicines',
        style: n.isFullAlarm ? 'full_alarm' : 'notification',
        triggerTimeMs: n.triggerTimeMs,
        snoozeIntervalMinutes: n.snoozeIntervalMinutes,
        payload: n.payloadJson ? JSON.parse(n.payloadJson) : undefined
      }));
      // Sync native alarms to persistent storage
      await storageService.saveScheduledAlarms(mapped);
      return mapped;
    }

    return storageService.getScheduledAlarms();
  }

  // --- ACTION & AUDIT LOGS (CRUD) ---

  async logAction(entry: Omit<ReminderLogEntry, 'id'>): Promise<void> {
    await storageService.addLog(entry);
  }

  async getLogs(): Promise<ReminderLogEntry[]> {
    return storageService.getLogs();
  }

  async clearLogs(): Promise<void> {
    await storageService.clearLogs();
  }

  async deleteLog(id: string): Promise<boolean> {
    return storageService.deleteLogById(id);
  }

  // --- HEALTH CHECK & DIAGNOSTICS ---

  async getHealthCheck(): Promise<HealthCheckStatus> {
    const exactAllowed = await this.canScheduleExactAlarms();
    const batteryIgnored = await this.isIgnoringBatteryOptimizations();
    const manufacturer = await this.getManufacturer();
    const alarms = await this.getScheduledAlarms();
    const lastFired = await NativeAlarmEngine.getLastFiredAlarm();

    const nextUpcoming = alarms.filter((a) => a.triggerTimeMs >= Date.now())[0];
    const channels = await this.getNotificationChannels();

    let notifsAllowed = true;
    if (Platform.OS === 'android' && Platform.Version >= 33) {
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
      manufacturer: manufacturer || 'Android Device',
      scheduledCount: alarms.length,
      nextScheduledTimeMs: nextUpcoming?.triggerTimeMs,
      foregroundServiceActive: true,
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

  async getStorageInfo(): Promise<StorageInfo> {
    return storageService.getStorageInfo();
  }

  async exportAllData(): Promise<string> {
    return storageService.exportAllData();
  }

  async importAllData(jsonString: string): Promise<boolean> {
    const ok = await storageService.importAllData(jsonString);
    if (ok) {
      await this.replanRecurringSchedules();
    }
    return ok;
  }

  async clearAllData(): Promise<void> {
    await this.cancelAll();
    await storageService.clearAllData();
    await this.replanRecurringSchedules();
  }

  async canScheduleExactAlarms(): Promise<boolean> {
    return NativeAlarmEngine.canScheduleExactAlarms();
  }

  async openExactAlarmSettings(): Promise<boolean> {
    return NativeAlarmEngine.openExactAlarmSettings();
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

  async getNotificationChannels(): Promise<any[]> {
    return NativeAlarmEngine.getNotificationChannels();
  }

  async requestBrowserNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
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
