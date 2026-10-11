import AsyncStorage from '@react-native-async-storage/async-storage';
import { RecurringSchedule, AlarmItem, ReminderLogEntry, NotificationChannelId, AlarmCategory } from '../domain/alarm';
import { AlarmToneType } from '../utils/audioAlarm';
import { DailyRoutine, getDefaultDailyRoutine } from '../domain/routine';
import { ShiftConfig, getDefaultShiftConfig } from '../domain/shift';

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
}

export interface UserProfile {
  id: string;
  name: string;
  emergencyContact?: string;
  notes?: string;
  updatedAt: number;
}

export interface StorageInfo {
  isPersistent: boolean;
  storageEngine: string;
  schedulesCount: number;
  alarmsCount: number;
  logsCount: number;
  hasSettings: boolean;
  lastUpdatedMs: number;
}

export interface ExportedAppData {
  version: number;
  exportedAt: number;
  settings: AppSettings;
  schedules: RecurringSchedule[];
  alarms: AlarmItem[];
  logs: ReminderLogEntry[];
  profile: UserProfile;
}

// Storage Keys with namespace and versioning
const STORAGE_KEYS = {
  SCHEDULES: '@lifetrack:schedules:v1',
  ALARMS: '@lifetrack:active_alarms:v1',
  LOGS: '@lifetrack:event_logs:v1',
  SETTINGS: '@lifetrack:settings:v1',
  PROFILE: '@lifetrack:user_profile:v1',
  ROUTINE: '@lifetrack:daily_routine:v1',
  SHIFT_CONFIG: '@lifetrack:shift_config:v1'
} as const;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themeMode: 'dark',
  language: 'en',
  alarmTone: 'default_siren',
  alarmVolume: 100,
  vibrationEnabled: true,
  fullScreenAlarmEnabled: true,
  defaultSnoozeMinutes: 10,
  autoDismissMinutes: 5,
  notificationsEnabled: true
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'default',
  name: '',
  notes: '',
  updatedAt: Date.now()
};

// Initial default starter schedules for first run
export const DEFAULT_STARTER_SCHEDULES: RecurringSchedule[] = [];

type StorageChangeListener = (key: string) => void;

class AppStorageService {
  private inMemoryCache: Map<string, string> = new Map();
  private listeners: Set<StorageChangeListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.initSyncMemoryFallback();
  }

  private initSyncMemoryFallback() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (const k of Object.values(STORAGE_KEYS)) {
          const val = window.localStorage.getItem(k);
          if (val) {
            this.inMemoryCache.set(k, val);
          }
        }
      } catch {
        // Ignore localStorage access restrictions
      }
    }
  }

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

  // --- RAW PERSISTENCE PRIMITIVES ---

  private async setItem<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    this.inMemoryCache.set(key, serialized);

    try {
      await AsyncStorage.setItem(key, serialized);
    } catch (err) {
      console.warn(`[StorageService] AsyncStorage.setItem failed for ${key}, falling back:`, err);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(key, serialized);
        } catch {
          // ignore
        }
      }
    }

    this.notify(key);
  }

  private async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const fromAsync = await AsyncStorage.getItem(key);
      if (fromAsync !== null) {
        this.inMemoryCache.set(key, fromAsync);
        return JSON.parse(fromAsync) as T;
      }
    } catch (err) {
      console.warn(`[StorageService] AsyncStorage.getItem failed for ${key}, checking fallback:`, err);
    }

    // Fallback to cache or localStorage
    const cached = this.inMemoryCache.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        // Fallback
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const fromLocal = window.localStorage.getItem(key);
        if (fromLocal !== null) {
          this.inMemoryCache.set(key, fromLocal);
          return JSON.parse(fromLocal) as T;
        }
      } catch {
        // ignore
      }
    }

    return defaultValue;
  }

  private async removeItem(key: string): Promise<void> {
    this.inMemoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // ignore
        }
      }
    }
    this.notify(key);
  }

  // Synchronous read from cache for instant component render initialization
  public getSyncSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    const raw = this.inMemoryCache.get(STORAGE_KEYS.SETTINGS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed[key] !== undefined) return parsed[key];
      } catch {
        // ignore
      }
    }
    return DEFAULT_APP_SETTINGS[key];
  }

  public getSyncSettings(): AppSettings {
    const raw = this.inMemoryCache.get(STORAGE_KEYS.SETTINGS);
    if (raw) {
      try {
        return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
      } catch {
        // Fallback
      }
    }
    return DEFAULT_APP_SETTINGS;
  }

  // --- RECURRING SCHEDULES CRUD ---

  /**
   * CREATE: Adds and persists a new recurring schedule.
   */
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
    await this.setItem(STORAGE_KEYS.SCHEDULES, schedules);
    return newSchedule;
  }

  /**
   * READ: Returns all recurring schedules stored on the phone.
   */
  public async getRecurringSchedules(): Promise<RecurringSchedule[]> {
    const raw = await this.getItem<RecurringSchedule[] | null>(STORAGE_KEYS.SCHEDULES, null);
    if (!raw || raw.length === 0) {
      // First boot: populate and persist default starter schedules
      if (!this.isInitialized) {
        this.isInitialized = true;
        await this.setItem(STORAGE_KEYS.SCHEDULES, DEFAULT_STARTER_SCHEDULES);
        return [...DEFAULT_STARTER_SCHEDULES];
      }
      return [];
    }
    this.isInitialized = true;
    return raw;
  }

  /**
   * READ ONE: Retrieves a single recurring schedule by its unique ID.
   */
  public async getRecurringScheduleById(id: string): Promise<RecurringSchedule | null> {
    const schedules = await this.getRecurringSchedules();
    return schedules.find((s) => s.id === id) || null;
  }

  /**
   * UPDATE: Updates an existing recurring schedule and persists changes immediately.
   */
  public async updateRecurringSchedule(
    id: string,
    updates: Partial<Omit<RecurringSchedule, 'id' | 'createdAt'>>
  ): Promise<RecurringSchedule | null> {
    const schedules = await this.getRecurringSchedules();
    const index = schedules.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const updated: RecurringSchedule = {
      ...schedules[index],
      ...updates
    };
    schedules[index] = updated;
    await this.setItem(STORAGE_KEYS.SCHEDULES, schedules);
    return updated;
  }

  /**
   * TOGGLE: Quickly toggle schedule isEnabled state and persist.
   */
  public async toggleRecurringSchedule(id: string, isEnabled: boolean): Promise<boolean> {
    const updated = await this.updateRecurringSchedule(id, { isEnabled });
    return updated !== null;
  }

  /**
   * DELETE: Removes a recurring schedule from persistent storage.
   */
  public async deleteRecurringSchedule(id: string): Promise<boolean> {
    const schedules = await this.getRecurringSchedules();
    const filtered = schedules.filter((s) => s.id !== id);
    if (filtered.length === schedules.length) return false;
    await this.setItem(STORAGE_KEYS.SCHEDULES, filtered);
    return true;
  }

  // --- SCHEDULED ALARMS CRUD ---

  /**
   * CREATE / UPDATE: Saves or updates an active scheduled alarm.
   */
  public async saveScheduledAlarm(alarm: AlarmItem): Promise<void> {
    const alarms = await this.getScheduledAlarms();
    const existingIndex = alarms.findIndex((a) => a.id === alarm.id);
    if (existingIndex >= 0) {
      alarms[existingIndex] = alarm;
    } else {
      alarms.push(alarm);
    }
    alarms.sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
    await this.setItem(STORAGE_KEYS.ALARMS, alarms);
  }

  /**
   * BATCH SAVE: Persists an entire list of scheduled alarms.
   */
  public async saveScheduledAlarms(newAlarms: AlarmItem[]): Promise<void> {
    const sorted = [...newAlarms].sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
    await this.setItem(STORAGE_KEYS.ALARMS, sorted);
  }

  /**
   * READ: Returns all active scheduled alarms saved on device.
   */
  public async getScheduledAlarms(): Promise<AlarmItem[]> {
    return this.getItem<AlarmItem[]>(STORAGE_KEYS.ALARMS, []);
  }

  /**
   * READ ONE: Retrieves a single scheduled alarm by ID.
   */
  public async getScheduledAlarmById(id: string): Promise<AlarmItem | null> {
    const alarms = await this.getScheduledAlarms();
    return alarms.find((a) => a.id === id) || null;
  }

  /**
   * UPDATE: Modifies attributes of a scheduled alarm.
   */
  public async updateScheduledAlarm(id: string, updates: Partial<AlarmItem>): Promise<AlarmItem | null> {
    const alarms = await this.getScheduledAlarms();
    const index = alarms.findIndex((a) => a.id === id);
    if (index === -1) return null;

    const updated = { ...alarms[index], ...updates };
    alarms[index] = updated;
    await this.setItem(STORAGE_KEYS.ALARMS, alarms);
    return updated;
  }

  /**
   * DELETE: Removes an alarm from device persistent storage.
   */
  public async deleteScheduledAlarm(id: string): Promise<boolean> {
    const alarms = await this.getScheduledAlarms();
    const filtered = alarms.filter((a) => a.id !== id);
    if (filtered.length === alarms.length) return false;
    await this.setItem(STORAGE_KEYS.ALARMS, filtered);
    return true;
  }

  /**
   * CLEAR ALL: Clears all scheduled alarms.
   */
  public async clearAllScheduledAlarms(): Promise<void> {
    await this.setItem(STORAGE_KEYS.ALARMS, []);
  }

  // --- ACTION & AUDIT LOGS CRUD ---

  /**
   * CREATE: Appends an audit log entry to device storage.
   */
  public async addLog(entry: Omit<ReminderLogEntry, 'id'>): Promise<ReminderLogEntry> {
    const logs = await this.getLogs(500);
    const fullEntry: ReminderLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    };
    logs.unshift(fullEntry);
    // Maintain maximum 300 logs on phone to prevent memory bloat
    if (logs.length > 300) {
      logs.length = 300;
    }
    await this.setItem(STORAGE_KEYS.LOGS, logs);
    return fullEntry;
  }

  /**
   * READ: Returns logs, sorted newest first.
   */
  public async getLogs(limit: number = 200): Promise<ReminderLogEntry[]> {
    const list = await this.getItem<ReminderLogEntry[]>(STORAGE_KEYS.LOGS, []);
    return list.slice(0, limit);
  }

  /**
   * DELETE: Removes a single log entry.
   */
  public async deleteLogById(id: string): Promise<boolean> {
    const logs = await this.getLogs(500);
    const filtered = logs.filter((l) => l.id !== id);
    if (filtered.length === logs.length) return false;
    await this.setItem(STORAGE_KEYS.LOGS, filtered);
    return true;
  }

  /**
   * CLEAR: Wipes all event logs.
   */
  public async clearLogs(): Promise<void> {
    await this.setItem(STORAGE_KEYS.LOGS, []);
  }

  // --- APP SETTINGS CRUD ---

  /**
   * READ: Reads current settings, merging with default values.
   */
  public async getSettings(): Promise<AppSettings> {
    const saved = await this.getItem<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
    return {
      ...DEFAULT_APP_SETTINGS,
      ...saved
    };
  }

  /**
   * UPDATE: Updates settings partially or completely.
   */
  public async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const merged: AppSettings = {
      ...current,
      ...updates
    };
    await this.setItem(STORAGE_KEYS.SETTINGS, merged);
    return merged;
  }

  /**
   * RESET: Reverts settings to defaults.
   */
  public async resetSettings(): Promise<AppSettings> {
    await this.setItem(STORAGE_KEYS.SETTINGS, DEFAULT_APP_SETTINGS);
    return { ...DEFAULT_APP_SETTINGS };
  }

  // --- USER PROFILE CRUD ---

  public async getProfile(): Promise<UserProfile> {
    return this.getItem<UserProfile>(STORAGE_KEYS.PROFILE, DEFAULT_USER_PROFILE);
  }

  public async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getProfile();
    const updated: UserProfile = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };
    await this.setItem(STORAGE_KEYS.PROFILE, updated);
    return updated;
  }

  // --- DAILY ROUTINE CRUD ---

  public async getDailyRoutine(profileId: string = 'default'): Promise<DailyRoutine> {
    const key = `${STORAGE_KEYS.ROUTINE}:${profileId}`;
    return this.getItem<DailyRoutine>(key, getDefaultDailyRoutine(profileId));
  }

  public async updateDailyRoutine(
    updates: Partial<DailyRoutine>,
    profileId: string = 'default'
  ): Promise<DailyRoutine> {
    const current = await this.getDailyRoutine(profileId);
    const updated: DailyRoutine = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };
    const key = `${STORAGE_KEYS.ROUTINE}:${profileId}`;
    await this.setItem(key, updated);
    return updated;
  }

  // --- SHIFT CONFIG CRUD ---

  public async getShiftConfig(): Promise<ShiftConfig> {
    return this.getItem<ShiftConfig>(STORAGE_KEYS.SHIFT_CONFIG, getDefaultShiftConfig());
  }

  public async updateShiftConfig(updates: Partial<ShiftConfig>): Promise<ShiftConfig> {
    const current = await this.getShiftConfig();
    const updated: ShiftConfig = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };
    await this.setItem(STORAGE_KEYS.SHIFT_CONFIG, updated);
    return updated;
  }

  // --- STORAGE DIAGNOSTICS & MANAGEMENT ---

  /**
   * Returns storage diagnostics for health check and user verification.
   */
  public async getStorageInfo(): Promise<StorageInfo> {
    const schedules = await this.getRecurringSchedules();
    const alarms = await this.getScheduledAlarms();
    const logs = await this.getLogs(500);
    const hasSettings = this.inMemoryCache.has(STORAGE_KEYS.SETTINGS) || (await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS)) !== null;

    return {
      isPersistent: true,
      storageEngine: 'AsyncStorage (Phone On-Device SQLite / SharedPreferences)',
      schedulesCount: schedules.length,
      alarmsCount: alarms.length,
      logsCount: logs.length,
      hasSettings,
      lastUpdatedMs: Date.now()
    };
  }

  /**
   * Exports full app data as JSON string for backup/export.
   */
  public async exportAllData(): Promise<string> {
    const [settings, schedules, alarms, logs, profile] = await Promise.all([
      this.getSettings(),
      this.getRecurringSchedules(),
      this.getScheduledAlarms(),
      this.getLogs(500),
      this.getProfile()
    ]);

    const exportData: ExportedAppData = {
      version: 1,
      exportedAt: Date.now(),
      settings,
      schedules,
      alarms,
      logs,
      profile
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Imports JSON data into device storage.
   */
  public async importAllData(jsonString: string): Promise<boolean> {
    try {
      const data: Partial<ExportedAppData> = JSON.parse(jsonString);
      if (!data) return false;

      if (data.settings) {
        await this.setItem(STORAGE_KEYS.SETTINGS, { ...DEFAULT_APP_SETTINGS, ...data.settings });
      }
      if (Array.isArray(data.schedules)) {
        await this.setItem(STORAGE_KEYS.SCHEDULES, data.schedules);
      }
      if (Array.isArray(data.alarms)) {
        await this.setItem(STORAGE_KEYS.ALARMS, data.alarms);
      }
      if (Array.isArray(data.logs)) {
        await this.setItem(STORAGE_KEYS.LOGS, data.logs);
      }
      if (data.profile) {
        await this.setItem(STORAGE_KEYS.PROFILE, data.profile);
      }
      return true;
    } catch (err) {
      console.error('[StorageService] importAllData failed:', err);
      return false;
    }
  }

  /**
   * Clear all app data (factory reset).
   */
  public async clearAllData(): Promise<void> {
    for (const k of Object.values(STORAGE_KEYS)) {
      await this.removeItem(k);
    }
    // Re-populate defaults
    await this.setItem(STORAGE_KEYS.SETTINGS, DEFAULT_APP_SETTINGS);
    await this.setItem(STORAGE_KEYS.SCHEDULES, DEFAULT_STARTER_SCHEDULES);
    await this.setItem(STORAGE_KEYS.PROFILE, DEFAULT_USER_PROFILE);
    await this.setItem(STORAGE_KEYS.ALARMS, []);
    await this.setItem(STORAGE_KEYS.LOGS, []);
  }
}

export const storageService = new AppStorageService();
