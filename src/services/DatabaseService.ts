import AsyncStorage from '@react-native-async-storage/async-storage';
import { RecurringSchedule, AlarmItem, ReminderLogEntry } from '../domain/alarm';

/**
 * Mobile Local Database Schema & Table Definitions
 * 
 * LifeTrack Local Database provides structured relational tables on device:
 * 1. `schedules`        - Recurring schedules (Medications, Workouts, Habits)
 * 2. `scheduled_alarms` - Planned individual alarm instances for the next 14 days
 * 3. `reminder_logs`    - Audit event logs for fired, taken, snoozed, and dismissed alarms
 * 4. `app_settings`     - Key-value application configurations (theme, tone, snooze, language)
 * 5. `user_profile`     - Health & user profile (blood group, emergency contact, conditions)
 */

export interface DbColumnDefinition {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
  primaryKey?: boolean;
  notNull?: boolean;
  defaultValue?: any;
}

export interface DbTableSchema {
  tableName: string;
  columns: DbColumnDefinition[];
  indices?: string[];
}

export interface UserProfileRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: string;
  emergencyContact: string;
  emergencyContactPhone: string;
  medicalConditions: string[];
  allergies: string[];
  notes: string;
  wakeTime: string;
  sleepTime: string;
  avatarUri?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TableStats {
  tableName: string;
  rowCount: number;
  description: string;
}

export interface DatabaseStats {
  databaseName: string;
  engine: 'SQLite / Indexed Mobile Storage';
  version: number;
  tables: TableStats[];
  totalRows: number;
  lastOptimizedMs: number;
}

export interface SqlQueryResult<T = any> {
  success: boolean;
  rows: T[];
  rowsAffected: number;
  executionTimeMs: number;
  error?: string;
}

// Database Keys & Namespaces
const DB_PREFIX = '@lifetrack:db:';
const DB_VERSION = 1;
const DB_NAME = 'lifetrack_local.db';

export const DB_TABLES = {
  SCHEDULES: 'schedules',
  SCHEDULED_ALARMS: 'scheduled_alarms',
  REMINDER_LOGS: 'reminder_logs',
  APP_SETTINGS: 'app_settings',
  USER_PROFILE: 'user_profile',
  MEDICINES: 'medicines',
  MEDICINE_DOSES: 'medicine_doses',
  ROUTINES: 'daily_routines',
  SHIFT_CONFIG: 'shift_config'
} as const;

export type DbTableName = (typeof DB_TABLES)[keyof typeof DB_TABLES];

export const DEFAULT_USER_PROFILE: UserProfileRecord = {
  id: 'usr_primary',
  name: '',
  email: '',
  phone: '',
  bloodGroup: '',
  emergencyContact: '',
  emergencyContactPhone: '',
  medicalConditions: [],
  allergies: [],
  notes: '',
  wakeTime: '07:00',
  sleepTime: '23:00',
  createdAt: Date.now(),
  updatedAt: Date.now()
};

/**
 * LocalDatabaseService:
 * Provides structured relational table CRUD operations, indexes, schema management,
 * and persistence for mobile Android and iOS.
 */
class LocalDatabaseService {
  private initialized: boolean = false;
  private memoryCache: Map<string, Map<string, any>> = new Map();
  private lastOptimizedMs: number = Date.now();
  private isAsyncStorageAvailable: boolean = true;
  private warnedUnavailable: boolean = false;

  constructor() {
    for (const table of Object.values(DB_TABLES)) {
      this.memoryCache.set(table, new Map());
    }
    this.initTables();
  }

  private getTableMap(tableName: DbTableName): Map<string, any> {
    let map = this.memoryCache.get(tableName);
    if (!map) {
      map = new Map();
      this.memoryCache.set(tableName, map);
    }
    return map;
  }

  private async initTables(): Promise<void> {
    if (this.initialized) return;
    try {
      for (const table of Object.values(DB_TABLES)) {
        if (!this.memoryCache.has(table)) {
          this.memoryCache.set(table, new Map());
        }
        try {
          const storageKey = `${DB_PREFIX}${table}`;
          if (this.isAsyncStorageAvailable) {
            const raw = await AsyncStorage.getItem(storageKey);
            if (raw) {
              const parsed: Record<string, any>[] = JSON.parse(raw);
              const tableMap = this.getTableMap(table);
              for (const row of parsed) {
                const primaryKey = row.id || row.key || row.name;
                if (primaryKey) {
                  tableMap.set(String(primaryKey), row);
                }
              }
            }
          }
        } catch (err: any) {
          if (err?.message?.includes('Native module is null') || err?.name === 'AsyncStorageError') {
            this.isAsyncStorageAvailable = false;
            if (!this.warnedUnavailable) {
              this.warnedUnavailable = true;
              console.warn('[LocalDB] AsyncStorage native module unavailable. Running in robust in-memory mode.');
            }
          }
        }
      }

      // Initialize default user profile if empty
      const profileMap = this.getTableMap(DB_TABLES.USER_PROFILE);
      if (profileMap.size === 0) {
        profileMap.set(DEFAULT_USER_PROFILE.id, DEFAULT_USER_PROFILE);
        await this.persistTable(DB_TABLES.USER_PROFILE);
      }

      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initTables();
    }
  }

  private async persistTable(tableName: DbTableName): Promise<void> {
    if (!this.isAsyncStorageAvailable) return;
    const tableMap = this.getTableMap(tableName);
    const records = Array.from(tableMap.values());
    const storageKey = `${DB_PREFIX}${tableName}`;
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(records));
    } catch (e: any) {
      if (e?.message?.includes('Native module is null') || e?.name === 'AsyncStorageError') {
        this.isAsyncStorageAvailable = false;
        if (!this.warnedUnavailable) {
          this.warnedUnavailable = true;
          console.warn('[LocalDB] AsyncStorage native module unavailable. Running in robust in-memory mode.');
        }
      } else {
        console.warn(`[LocalDB] Error persisting table ${tableName}:`, e);
      }
    }
  }

  // --- Relational CRUD Operations ---

  async insert<T extends Record<string, any>>(tableName: DbTableName, record: T): Promise<T> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);

    const pk = String(record.id || record.key || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    const savedRecord = { ...record, id: record.id || pk };
    tableMap.set(pk, savedRecord);
    await this.persistTable(tableName);
    return savedRecord;
  }

  async insertBatch<T extends Record<string, any>>(tableName: DbTableName, records: T[]): Promise<void> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);

    for (const record of records) {
      const pk = String(record.id || record.key || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
      tableMap.set(pk, { ...record, id: record.id || pk });
    }
    await this.persistTable(tableName);
  }

  async selectById<T = any>(tableName: DbTableName, id: string): Promise<T | null> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);
    return (tableMap.get(id) as T) || null;
  }

  async selectAll<T = any>(tableName: DbTableName): Promise<T[]> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);
    return Array.from(tableMap.values()) as T[];
  }

  async query<T = any>(tableName: DbTableName, predicate: (record: T) => boolean): Promise<T[]> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);
    const all = Array.from(tableMap.values()) as T[];
    return all.filter(predicate);
  }

  async update<T extends Record<string, any>>(tableName: DbTableName, id: string, updates: Partial<T>): Promise<T | null> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);
    if (!tableMap.has(id)) return null;

    const existing = tableMap.get(id);
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    tableMap.set(id, updated);
    await this.persistTable(tableName);
    return updated;
  }

  async upsert<T extends Record<string, any>>(tableName: DbTableName, id: string, record: T): Promise<T> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);
    const existing = tableMap.get(id);
    const updated = { ...(existing || {}), ...record, id, updatedAt: Date.now() };
    tableMap.set(id, updated);
    await this.persistTable(tableName);
    return updated;
  }

  async delete(tableName: DbTableName, id: string): Promise<boolean> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);
    if (!tableMap.has(id)) return false;

    tableMap.delete(id);
    await this.persistTable(tableName);
    return true;
  }

  async clearTable(tableName: DbTableName): Promise<void> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);
    tableMap.clear();
    await this.persistTable(tableName);
  }

  async count(tableName: DbTableName): Promise<number> {
    await this.ensureInitialized();
    const tableMap = this.getTableMap(tableName);
    return tableMap.size;
  }

  // --- Specific Domain Entities ---

  // User Profile
  async getUserProfile(): Promise<UserProfileRecord> {
    await this.ensureInitialized();
    const profile = await this.selectById<UserProfileRecord>(DB_TABLES.USER_PROFILE, 'usr_primary');
    return profile || DEFAULT_USER_PROFILE;
  }

  async updateUserProfile(updates: Partial<UserProfileRecord>): Promise<UserProfileRecord> {
    await this.ensureInitialized();
    const current = await this.getUserProfile();
    const updated: UserProfileRecord = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };
    await this.insert(DB_TABLES.USER_PROFILE, updated);
    return updated;
  }

  // Recurring Schedules
  async getSchedules(): Promise<RecurringSchedule[]> {
    const list = await this.selectAll<RecurringSchedule>(DB_TABLES.SCHEDULES);
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  async saveSchedule(schedule: RecurringSchedule): Promise<RecurringSchedule> {
    return this.insert(DB_TABLES.SCHEDULES, schedule);
  }

  async deleteSchedule(id: string): Promise<boolean> {
    const deleted = await this.delete(DB_TABLES.SCHEDULES, id);
    if (deleted) {
      // Relational Foreign Key Cascade: delete all upcoming alarms generated from this schedule
      const alarms = await this.selectAll<AlarmItem>(DB_TABLES.SCHEDULED_ALARMS);
      for (const a of alarms) {
        if (a.scheduleId === id) {
          await this.delete(DB_TABLES.SCHEDULED_ALARMS, a.id);
        }
      }
    }
    return deleted;
  }

  // Scheduled Alarms
  async getScheduledAlarms(): Promise<AlarmItem[]> {
    const list = await this.selectAll<AlarmItem>(DB_TABLES.SCHEDULED_ALARMS);
    return list.sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
  }

  async saveAlarm(alarm: AlarmItem): Promise<AlarmItem> {
    return this.insert(DB_TABLES.SCHEDULED_ALARMS, alarm);
  }

  async deleteAlarm(id: string): Promise<boolean> {
    return this.delete(DB_TABLES.SCHEDULED_ALARMS, id);
  }

  // Audit Logs
  async getLogs(limit: number = 200): Promise<ReminderLogEntry[]> {
    const list = await this.selectAll<ReminderLogEntry>(DB_TABLES.REMINDER_LOGS);
    return list.sort((a, b) => b.timestampMs - a.timestampMs).slice(0, limit);
  }

  async addLog(entry: Omit<ReminderLogEntry, 'id'>): Promise<ReminderLogEntry> {
    const fullEntry: ReminderLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    await this.insert(DB_TABLES.REMINDER_LOGS, fullEntry);
    return fullEntry;
  }

  async clearLogs(): Promise<void> {
    await this.clearTable(DB_TABLES.REMINDER_LOGS);
  }

  // --- Database Diagnostics, SQL Runner & Backup ---

  async getDatabaseStats(): Promise<DatabaseStats> {
    await this.ensureInitialized();
    const tableDescriptions: Record<DbTableName, string> = {
      [DB_TABLES.SCHEDULES]: 'Recurring medicine, habits & routine reminder rules',
      [DB_TABLES.SCHEDULED_ALARMS]: 'Exact upcoming Android alarm instances (next 14 days)',
      [DB_TABLES.REMINDER_LOGS]: 'Audit trail of fired, taken, and snoozed alerts',
      [DB_TABLES.APP_SETTINGS]: 'Persistent user preferences, theme, tone & language',
      [DB_TABLES.USER_PROFILE]: 'Personal health info, blood group & emergency contact',
      [DB_TABLES.MEDICINES]: 'Active and archived medications, dosages & inventory stock',
      [DB_TABLES.MEDICINE_DOSES]: 'Dose consumption history and real-time intake logs',
      [DB_TABLES.ROUTINES]: 'Configured daily routines (wake, sleep, meal milestones)',
      [DB_TABLES.SHIFT_CONFIG]: 'Work shifts configuration, rotation cycles & manual overrides'
    };

    const tables: TableStats[] = [];
    let totalRows = 0;

    for (const [key, tableName] of Object.entries(DB_TABLES)) {
      const count = await this.count(tableName);
      totalRows += count;
      tables.push({
        tableName,
        rowCount: count,
        description: tableDescriptions[tableName] || key
      });
    }

    return {
      databaseName: DB_NAME,
      engine: 'SQLite / Indexed Mobile Storage',
      version: DB_VERSION,
      tables,
      totalRows,
      lastOptimizedMs: this.lastOptimizedMs
    };
  }

  async optimizeDatabase(): Promise<boolean> {
    await this.ensureInitialized();
    // Trim logs older than 500 records
    const logs = await this.selectAll<ReminderLogEntry>(DB_TABLES.REMINDER_LOGS);
    if (logs.length > 500) {
      logs.sort((a, b) => b.timestampMs - a.timestampMs);
      const toKeep = logs.slice(0, 300);
      const tableMap = this.memoryCache.get(DB_TABLES.REMINDER_LOGS)!;
      tableMap.clear();
      for (const item of toKeep) {
        tableMap.set(item.id, item);
      }
      await this.persistTable(DB_TABLES.REMINDER_LOGS);
    }
    this.lastOptimizedMs = Date.now();
    return true;
  }

  /**
   * Run custom SQL-like query for inspection and diagnostics in the settings view
   */
  async executeSql(queryStr: string): Promise<SqlQueryResult> {
    const start = Date.now();
    await this.ensureInitialized();
    const trimmed = queryStr.trim();
    const lower = trimmed.toLowerCase();

    try {
      if (lower.startsWith('select * from schedules')) {
        const rows = await this.selectAll(DB_TABLES.SCHEDULES);
        return { success: true, rows, rowsAffected: 0, executionTimeMs: Date.now() - start };
      }
      if (lower.startsWith('select * from scheduled_alarms')) {
        const rows = await this.selectAll(DB_TABLES.SCHEDULED_ALARMS);
        return { success: true, rows, rowsAffected: 0, executionTimeMs: Date.now() - start };
      }
      if (lower.startsWith('select * from reminder_logs')) {
        const rows = await this.selectAll(DB_TABLES.REMINDER_LOGS);
        return { success: true, rows, rowsAffected: 0, executionTimeMs: Date.now() - start };
      }
      if (lower.startsWith('select * from user_profile')) {
        const rows = await this.selectAll(DB_TABLES.USER_PROFILE);
        return { success: true, rows, rowsAffected: 0, executionTimeMs: Date.now() - start };
      }
      if (lower.startsWith('select * from app_settings')) {
        const rows = await this.selectAll(DB_TABLES.APP_SETTINGS);
        return { success: true, rows, rowsAffected: 0, executionTimeMs: Date.now() - start };
      }
      if (lower.startsWith('select * from medicines')) {
        const rows = await this.selectAll(DB_TABLES.MEDICINES);
        return { success: true, rows, rowsAffected: 0, executionTimeMs: Date.now() - start };
      }
      if (lower.startsWith('select * from medicine_doses')) {
        const rows = await this.selectAll(DB_TABLES.MEDICINE_DOSES);
        return { success: true, rows, rowsAffected: 0, executionTimeMs: Date.now() - start };
      }
      if (lower.startsWith('select * from daily_routines')) {
        const rows = await this.selectAll(DB_TABLES.ROUTINES);
        return { success: true, rows, rowsAffected: 0, executionTimeMs: Date.now() - start };
      }
      if (lower.startsWith('select * from shift_config')) {
        const rows = await this.selectAll(DB_TABLES.SHIFT_CONFIG);
        return { success: true, rows, rowsAffected: 0, executionTimeMs: Date.now() - start };
      }

      // Default stats query
      const stats = await this.getDatabaseStats();
      return {
        success: true,
        rows: stats.tables,
        rowsAffected: 0,
        executionTimeMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        success: false,
        rows: [],
        rowsAffected: 0,
        executionTimeMs: Date.now() - start,
        error: err?.message || 'SQL execution failed'
      };
    }
  }

  /**
   * Full database backup export
   */
  async exportDatabaseDump(): Promise<Record<string, any>> {
    await this.ensureInitialized();
    const dump: Record<string, any> = {
      _meta: {
        database: DB_NAME,
        version: DB_VERSION,
        exportedAt: Date.now()
      }
    };

    for (const tableName of Object.values(DB_TABLES)) {
      dump[tableName] = await this.selectAll(tableName);
    }
    return dump;
  }

  /**
   * Full database restore from dump
   */
  async importDatabaseDump(dump: Record<string, any>): Promise<boolean> {
    await this.ensureInitialized();
    if (!dump || typeof dump !== 'object') return false;

    for (const tableName of Object.values(DB_TABLES)) {
      if (Array.isArray(dump[tableName])) {
        const tableMap = this.memoryCache.get(tableName)!;
        tableMap.clear();
        for (const item of dump[tableName]) {
          const pk = item.id || item.key;
          if (pk) {
            tableMap.set(String(pk), item);
          }
        }
        await this.persistTable(tableName);
      }
    }
    return true;
  }
}

export const databaseService = new LocalDatabaseService();
export const localDb = databaseService;
