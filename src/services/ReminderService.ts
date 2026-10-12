import { AlarmCategory, AlarmItem, AlarmRepeat, HealthCheckStatus, RecurringSchedule, ReminderLogEntry } from '../domain/alarm';

export interface ScheduleAlarmParams {
  id: string;
  scheduleId?: string;
  category?: AlarmCategory;
  triggerTimeMs: number;
  title: string;
  message: string;
  channelId?: 'medicines' | 'appointments' | 'routine' | 'exercise' | 'water_meals' | 'habits' | 'summaries';
  isFullAlarm?: boolean;
  snoozeIntervalMinutes?: number;
  payload?: Record<string, unknown>;
  repeat?: AlarmRepeat;
}

export interface IReminderService {
  /**
   * Schedule an exact alarm natively using AlarmManager.setAlarmClock.
   */
  scheduleAlarm(params: ScheduleAlarmParams): Promise<boolean>;

  /**
   * Cancel an existing alarm by id.
   */
  cancelAlarm(id: string): Promise<boolean>;

  /**
   * Cancel all scheduled alarms.
   */
  cancelAll(): Promise<boolean>;

  /**
   * Retrieve all currently active alarms stored natively.
   */
  getScheduledAlarms(): Promise<AlarmItem[]>;

  /**
   * Add a recurring alarm schedule (daily, weekly, every N days, monthly, custom dates).
   */
  createRecurringSchedule(schedule: Omit<RecurringSchedule, 'id' | 'createdAt'>): Promise<RecurringSchedule>;

  /**
   * Retrieve all configured recurring schedules.
   */
  getRecurringSchedules(): Promise<RecurringSchedule[]>;

  /**
   * Toggle enabling/disabling a recurring schedule.
   */
  toggleRecurringSchedule(id: string, isEnabled: boolean): Promise<boolean>;

  /**
   * Delete a recurring schedule and cancel its occurrences.
   */
  deleteRecurringSchedule(id: string): Promise<boolean>;

  /**
   * Re-plans recurring schedule occurrences for their rolling window and syncs them with scheduled alarms.
   */
  replanRecurringSchedules(options?: { force?: boolean }): Promise<void>;

  /**
   * Get reminder health check diagnostics.
   */
  getHealthCheck(): Promise<HealthCheckStatus>;

  /**
   * Check if exact alarms permission is granted (Android 12+).
   */
  canScheduleExactAlarms(): Promise<boolean>;

  /**
   * Open Android system settings to grant SCHEDULE_EXACT_ALARM.
   */
  openExactAlarmSettings(): Promise<boolean>;

  /**
   * Check if battery optimization exemption is active.
   */
  isIgnoringBatteryOptimizations(): Promise<boolean>;

  /**
   * Request battery optimization exemption dialog.
   */
  requestIgnoreBatteryOptimizations(): Promise<boolean>;

  /**
   * Detect phone manufacturer (e.g. xiaomi, samsung, oneplus).
   */
  getManufacturer(): Promise<string>;

  /**
   * Open brand-specific autostart/background manager settings.
   */
  openAutostartSettings(): Promise<boolean>;

  /**
   * Update an existing recurring schedule and re-plan occurrences.
   */
  updateRecurringSchedule(id: string, updates: Partial<Omit<RecurringSchedule, 'id' | 'createdAt'>>): Promise<RecurringSchedule | null>;

  /**
   * Get a single recurring schedule by id.
   */
  getRecurringScheduleById(id: string): Promise<RecurringSchedule | null>;

  /**
   * Log a reminder action (Taken, Snoozed, Skipped, etc.).
   */
  logAction(entry: Omit<ReminderLogEntry, 'id'>): Promise<void>;

  /**
   * Retrieve logged reminder events.
   */
  getLogs(limit?: number): Promise<ReminderLogEntry[]>;

  /**
   * Clear all reminder event logs.
   */
  clearLogs(): Promise<void>;

  /**
   * Delete a specific event log by id.
   */
  deleteLog(id: string): Promise<boolean>;
}
