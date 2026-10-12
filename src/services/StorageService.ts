import { RecurringSchedule, AlarmItem, ReminderLogEntry } from '../domain/alarm';
import { AlarmToneType } from '../utils/audioAlarm';
import { DailyRoutine, getDefaultDailyRoutine } from '../domain/routine';
import { ShiftConfig, getDefaultShiftConfig } from '../domain/shift';
import { kvStore } from './kvStore';

/**
 * Document store: one JSON document per key. Owns settings, reminder schedules, reminder logs,
 * the daily routine, and the shift configuration. Medicines, doses, and the health profile live
 * in DatabaseService tables. Both sit on the same `kvStore` engine. See docs/ARCHITECTURE.md §3.
 */

export interface AppSettings {
  themeMode: 'light' | 'dark' | 'system';
  language: 'en' | 'hi' | 'mr' | 'es';
  alarmTone: AlarmToneType;
  alarmVolume: number; // 0 to 100
  vibrationEnabled: boolean;
  fullScreenAlarmEnabled: boolean;
  defaultSnoozeMinutes: number;
  autoDismissMinutes: number;
  notificationsEnabled: boolean;
  hasCompletedOnboarding: boolean;
}

export const STORAGE_KEYS = {
  SCHEDULES: '@lifetrack:schedules:v1',
  ALARMS: '@lifetrack:active_alarms:v1',
  LOGS: '@lifetrack:event_logs:v1',
  SETTINGS: '@lifetrack:settings:v1',
  ROUTINE: '@lifetrack:daily_routine:v1',
  SHIFT_CONFIG: '@lifetrack:shift_config:v1'
} as const;

export const MAX_LOG_ENTRIES = 300;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themeMode: 'dark',
  language: 'en',
  alarmTone: 'default_siren',
  alarmVolume: 100,
  vibrationEnabled: true,
  fullScreenAlarmEnabled: true,
  defaultSnoozeMinutes: 10,
  autoDismissMinutes: 5,
  notificationsEnabled: true,
  hasCompletedOnboarding: false
};

export function routineKey(profileId: string = 'default'): string {
  return `${STORAGE_KEYS.ROUTINE}:${profileId}`;
}

type StorageChangeListener = (key: string) => void;

class AppStorageService {
  private listeners: Set<StorageChangeListener> = new Set();

  private notify(key: string) {
    this.listeners.forEach((listener) => {
      try {
        listener(key);
      } catch (err) {
        console.warn('[StorageService] Error in storage listener:', err);
      }
    });
  }

  public subscribe(listener: StorageChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async write(key: string, value: unknown): Promise<void> {
    await kvStore.setJson(key, value);
    this.notify(key);
  }

  /** Loads settings into the synchronous cache so theme and language render on the first frame. */
  public async preload(): Promise<void> {
    await kvStore.preload([STORAGE_KEYS.SETTINGS]);
  }

  public getSyncSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.getSyncSettings()[key];
  }

  public getSyncSettings(): AppSettings {
    const saved = kvStore.getJsonSync<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
    return { ...DEFAULT_APP_SETTINGS, ...saved };
  }

  // --- RECURRING SCHEDULES ---

  public async createRecurringSchedule(
    schedule: Omit<RecurringSchedule, 'id' | 'createdAt'>
  ): Promise<RecurringSchedule> {
    const schedules = await this.getRecurringSchedules();
    const newSchedule: RecurringSchedule = {
      ...schedule,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now()
    };
    schedules.unshift(newSchedule);
    await this.saveRecurringSchedules(schedules);
    return newSchedule;
  }

  public async getRecurringSchedules(): Promise<RecurringSchedule[]> {
    return kvStore.getJson<RecurringSchedule[]>(STORAGE_KEYS.SCHEDULES, []);
  }

  public async saveRecurringSchedules(schedules: RecurringSchedule[]): Promise<void> {
    await this.write(STORAGE_KEYS.SCHEDULES, schedules);
  }

  public async getRecurringScheduleById(id: string): Promise<RecurringSchedule | null> {
    const schedules = await this.getRecurringSchedules();
    return schedules.find((s) => s.id === id) || null;
  }

  public async updateRecurringSchedule(
    id: string,
    updates: Partial<Omit<RecurringSchedule, 'id' | 'createdAt'>>
  ): Promise<RecurringSchedule | null> {
    const schedules = await this.getRecurringSchedules();
    const index = schedules.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const updated: RecurringSchedule = { ...schedules[index], ...updates };
    schedules[index] = updated;
    await this.saveRecurringSchedules(schedules);
    return updated;
  }

  public async toggleRecurringSchedule(id: string, isEnabled: boolean): Promise<boolean> {
    const updated = await this.updateRecurringSchedule(id, { isEnabled });
    return updated !== null;
  }

  public async deleteRecurringSchedule(id: string): Promise<boolean> {
    const schedules = await this.getRecurringSchedules();
    const filtered = schedules.filter((s) => s.id !== id);
    if (filtered.length === schedules.length) return false;
    await this.saveRecurringSchedules(filtered);
    return true;
  }

  // --- SCHEDULED ALARMS (JS-side list; the source of truth only when the native engine is absent) ---

  public async saveScheduledAlarm(alarm: AlarmItem): Promise<void> {
    const alarms = await this.getScheduledAlarms();
    const existingIndex = alarms.findIndex((a) => a.id === alarm.id);
    if (existingIndex >= 0) {
      alarms[existingIndex] = alarm;
    } else {
      alarms.push(alarm);
    }
    await this.saveScheduledAlarms(alarms);
  }

  public async saveScheduledAlarms(newAlarms: AlarmItem[]): Promise<void> {
    const sorted = [...newAlarms].sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
    await this.write(STORAGE_KEYS.ALARMS, sorted);
  }

  public async getScheduledAlarms(): Promise<AlarmItem[]> {
    return kvStore.getJson<AlarmItem[]>(STORAGE_KEYS.ALARMS, []);
  }

  public async getScheduledAlarmById(id: string): Promise<AlarmItem | null> {
    const alarms = await this.getScheduledAlarms();
    return alarms.find((a) => a.id === id) || null;
  }

  public async deleteScheduledAlarm(id: string): Promise<boolean> {
    const alarms = await this.getScheduledAlarms();
    const filtered = alarms.filter((a) => a.id !== id);
    if (filtered.length === alarms.length) return false;
    await this.saveScheduledAlarms(filtered);
    return true;
  }

  public async clearAllScheduledAlarms(): Promise<void> {
    await this.write(STORAGE_KEYS.ALARMS, []);
  }

  // --- REMINDER EVENT LOGS ---

  public async addLog(entry: Omit<ReminderLogEntry, 'id'>): Promise<ReminderLogEntry> {
    const logs = await this.getLogs(MAX_LOG_ENTRIES);
    const fullEntry: ReminderLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    };
    logs.unshift(fullEntry);
    await this.saveLogs(logs);
    return fullEntry;
  }

  /** Returns logs, newest first. */
  public async getLogs(limit: number = 200): Promise<ReminderLogEntry[]> {
    const list = await kvStore.getJson<ReminderLogEntry[]>(STORAGE_KEYS.LOGS, []);
    return list.slice(0, limit);
  }

  public async saveLogs(logs: ReminderLogEntry[]): Promise<void> {
    await this.write(STORAGE_KEYS.LOGS, logs.slice(0, MAX_LOG_ENTRIES));
  }

  public async deleteLogById(id: string): Promise<boolean> {
    const logs = await this.getLogs(MAX_LOG_ENTRIES);
    const filtered = logs.filter((l) => l.id !== id);
    if (filtered.length === logs.length) return false;
    await this.saveLogs(filtered);
    return true;
  }

  public async clearLogs(): Promise<void> {
    await this.write(STORAGE_KEYS.LOGS, []);
  }

  // --- APP SETTINGS ---

  public async getSettings(): Promise<AppSettings> {
    const saved = await kvStore.getJson<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
    return { ...DEFAULT_APP_SETTINGS, ...saved };
  }

  public async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const merged: AppSettings = { ...current, ...updates };
    await this.write(STORAGE_KEYS.SETTINGS, merged);
    return merged;
  }

  public async resetSettings(): Promise<AppSettings> {
    await this.write(STORAGE_KEYS.SETTINGS, DEFAULT_APP_SETTINGS);
    return { ...DEFAULT_APP_SETTINGS };
  }

  // --- DAILY ROUTINE ---

  public async getDailyRoutine(profileId: string = 'default'): Promise<DailyRoutine> {
    const saved = await kvStore.getJson<DailyRoutine | null>(routineKey(profileId), null);
    return saved ? { ...getDefaultDailyRoutine(profileId), ...saved } : getDefaultDailyRoutine(profileId);
  }

  public async updateDailyRoutine(
    updates: Partial<DailyRoutine>,
    profileId: string = 'default'
  ): Promise<DailyRoutine> {
    const current = await this.getDailyRoutine(profileId);
    const updated: DailyRoutine = { ...current, ...updates, updatedAt: Date.now() };
    await this.write(routineKey(profileId), updated);
    return updated;
  }

  // --- SHIFT CONFIG ---

  public async hasStoredShiftConfig(): Promise<boolean> {
    return kvStore.has(STORAGE_KEYS.SHIFT_CONFIG);
  }

  public async getShiftConfig(): Promise<ShiftConfig> {
    const saved = await kvStore.getJson<ShiftConfig | null>(STORAGE_KEYS.SHIFT_CONFIG, null);
    return saved ? { ...getDefaultShiftConfig(), ...saved } : getDefaultShiftConfig();
  }

  public async updateShiftConfig(updates: Partial<ShiftConfig>): Promise<ShiftConfig> {
    const current = await this.getShiftConfig();
    const updated: ShiftConfig = { ...current, ...updates, updatedAt: Date.now() };
    await this.write(STORAGE_KEYS.SHIFT_CONFIG, updated);
    return updated;
  }
}

export const storageService = new AppStorageService();
