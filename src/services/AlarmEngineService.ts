import { AlarmItem, HealthCheckStatus, RecurringSchedule, ReminderLogEntry } from '../domain/alarm';
import { IReminderService, ScheduleAlarmParams } from './ReminderService';
import { planOccurrencesForRecurringSchedule } from '../domain/reminderPlanner';
import * as NativeAlarmEngine from '../../modules/alarm-engine';

export class AlarmEngineService implements IReminderService {
  private localLogs: ReminderLogEntry[] = [];
  private fallbackAlarms: Map<string, AlarmItem> = new Map();
  private recurringSchedules: Map<string, RecurringSchedule> = new Map();

  constructor() {
    this.loadInitialRecurringSchedules();
  }

  private loadInitialRecurringSchedules() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('lifetrack_recurring_schedules');
        if (saved) {
          const list: RecurringSchedule[] = JSON.parse(saved);
          list.forEach((s) => this.recurringSchedules.set(s.id, s));
          this.replanRecurringSchedules();
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Default starter recurring schedules showcasing versatility
    const defaultSchedules: RecurringSchedule[] = [
      {
        id: 'rec_daily_metformin',
        profileId: 'default',
        category: 'medicine',
        title: 'Morning Medicine (Metformin 500mg)',
        message: 'Take 1 tablet with breakfast',
        channelId: 'medicines',
        style: 'full_alarm',
        recurrenceType: 'daily',
        timeOfDay: '08:00',
        snoozeIntervalMinutes: 10,
        isEnabled: true,
        createdAt: Date.now()
      },
      {
        id: 'rec_every_2_days_dressing',
        profileId: 'default',
        category: 'reminder',
        title: 'Wound Dressing & Inspection',
        message: 'Every 2 days antiseptic check & clean dressing',
        channelId: 'routine',
        style: 'full_alarm',
        recurrenceType: 'every_n_days',
        intervalDays: 2,
        timeOfDay: '11:00',
        snoozeIntervalMinutes: 15,
        isEnabled: true,
        createdAt: Date.now()
      },
      {
        id: 'rec_weekly_workout',
        profileId: 'default',
        category: 'exercise',
        title: 'Yoga & Pranayama Session',
        message: 'Mon, Wed, Fri morning routine',
        channelId: 'exercise',
        style: 'notification',
        recurrenceType: 'weekly',
        weekdays: [1, 3, 5], // Mon, Wed, Fri
        timeOfDay: '06:30',
        snoozeIntervalMinutes: 10,
        isEnabled: true,
        createdAt: Date.now()
      },
      {
        id: 'rec_monthly_doctor',
        profileId: 'default',
        category: 'appointment',
        title: 'Monthly Vitals & BP Audit',
        message: 'Review monthly BP and blood sugar logs with doctor',
        channelId: 'appointments',
        style: 'full_alarm',
        recurrenceType: 'monthly',
        dayOfMonth: 1, // 1st of every month
        timeOfDay: '10:00',
        snoozeIntervalMinutes: 30,
        isEnabled: true,
        createdAt: Date.now()
      }
    ];

    defaultSchedules.forEach((s) => this.recurringSchedules.set(s.id, s));
    this.saveRecurringToStorage();
    this.replanRecurringSchedules();
  }

  private saveRecurringToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const list = Array.from(this.recurringSchedules.values());
        window.localStorage.setItem('lifetrack_recurring_schedules', JSON.stringify(list));
      }
    } catch {
      // Storage error ignored
    }
  }

  async createRecurringSchedule(schedule: Omit<RecurringSchedule, 'id' | 'createdAt'>): Promise<RecurringSchedule> {
    const fullSchedule: RecurringSchedule = {
      ...schedule,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now()
    };
    this.recurringSchedules.set(fullSchedule.id, fullSchedule);
    this.saveRecurringToStorage();
    await this.replanRecurringSchedules();

    await this.logAction({
      profileId: 'default',
      alarmId: fullSchedule.id,
      action: 'SCHEDULED',
      timestampMs: Date.now(),
      scheduledTimeMs: Date.now(),
      note: `Created recurring schedule: ${fullSchedule.title} (${fullSchedule.recurrenceType})`
    });

    return fullSchedule;
  }

  async getRecurringSchedules(): Promise<RecurringSchedule[]> {
    return Array.from(this.recurringSchedules.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async toggleRecurringSchedule(id: string, isEnabled: boolean): Promise<boolean> {
    const schedule = this.recurringSchedules.get(id);
    if (!schedule) return false;
    schedule.isEnabled = isEnabled;
    this.saveRecurringToStorage();
    await this.replanRecurringSchedules();
    return true;
  }

  async deleteRecurringSchedule(id: string): Promise<boolean> {
    const deleted = this.recurringSchedules.delete(id);
    if (deleted) {
      // Also remove all upcoming occurrences belonging to this schedule
      const alarms = await this.getScheduledAlarms();
      for (const a of alarms) {
        if (a.scheduleId === id) {
          await this.cancelAlarm(a.id);
        }
      }
      this.saveRecurringToStorage();
      await this.replanRecurringSchedules();
    }
    return deleted;
  }

  async replanRecurringSchedules(): Promise<void> {
    const nowMs = Date.now();
    for (const schedule of this.recurringSchedules.values()) {
      if (!schedule.isEnabled) continue;
      // Plan occurrences for next 14 days
      const occurrences = planOccurrencesForRecurringSchedule(schedule, nowMs, 5, 14);
      for (const occ of occurrences) {
        if (!this.fallbackAlarms.has(occ.id)) {
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
        }
      }
    }
  }

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

    // In web preview or if native module is not linked in JS environment, keep in memory
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
    this.fallbackAlarms.set(params.id, alarmItem);

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
    this.fallbackAlarms.delete(id);
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
    this.fallbackAlarms.clear();
    return true;
  }

  async getScheduledAlarms(): Promise<AlarmItem[]> {
    const nativeAlarms = await NativeAlarmEngine.getScheduledAlarms();
    if (nativeAlarms && nativeAlarms.length > 0) {
      return nativeAlarms.map((n) => ({
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
    }
    return Array.from(this.fallbackAlarms.values()).sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
  }

  async getHealthCheck(): Promise<HealthCheckStatus> {
    const exactAllowed = await this.canScheduleExactAlarms();
    const batteryIgnored = await this.isIgnoringBatteryOptimizations();
    const manufacturer = await this.getManufacturer();
    const alarms = await this.getScheduledAlarms();
    const lastFired = await NativeAlarmEngine.getLastFiredAlarm();

    const nextUpcoming = alarms.filter((a) => a.triggerTimeMs >= Date.now())[0];

    const channels = await this.getNotificationChannels();

    return {
      exactAlarmsAllowed: exactAllowed,
      notificationsAllowed: true,
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

  async logAction(entry: Omit<ReminderLogEntry, 'id'>): Promise<void> {
    const fullEntry: ReminderLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    };
    this.localLogs.unshift(fullEntry);
    if (this.localLogs.length > 200) {
      this.localLogs.pop();
    }
  }

  async getLogs(): Promise<ReminderLogEntry[]> {
    return [...this.localLogs];
  }
}

export const reminderService = new AlarmEngineService();

