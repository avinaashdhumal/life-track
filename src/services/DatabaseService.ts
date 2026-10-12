import { kvStore } from './kvStore';

/**
 * Table store on top of `kvStore`. Each table is one JSON array under `@lifetrack:db:<table>`,
 * loaded into a Map on first use.
 *
 * Owns: medicines, medicine dose history, and the health profile. Everything else (settings,
 * schedules, logs, routine, shifts) is a document in StorageService. See docs/ARCHITECTURE.md §3.
 */

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
  engine: string;
  version: number;
  tables: TableStats[];
  totalRows: number;
  lastOptimizedMs: number;
}

export const DB_PREFIX = '@lifetrack:db:';
const DB_VERSION = 2;
const DB_NAME = 'lifetrack_local';

export const DB_TABLES = {
  USER_PROFILE: 'user_profile',
  MEDICINES: 'medicines',
  MEDICINE_DOSES: 'medicine_doses'
} as const;

export type DbTableName = (typeof DB_TABLES)[keyof typeof DB_TABLES];

/** Tables from schema v1 that duplicated StorageService data. Removed by migration v2. */
export const LEGACY_DB_TABLES = [
  'schedules',
  'scheduled_alarms',
  'reminder_logs',
  'app_settings',
  'daily_routines',
  'shift_config'
] as const;

export const PRIMARY_PROFILE_ID = 'usr_primary';

export function createDefaultUserProfile(): UserProfileRecord {
  const now = Date.now();
  return {
    id: PRIMARY_PROFILE_ID,
    name: '',
    email: '',
    phone: '',
    bloodGroup: '',
    emergencyContact: '',
    emergencyContactPhone: '',
    medicalConditions: [],
    allergies: [],
    notes: '',
    createdAt: now,
    updatedAt: now
  };
}

export const DEFAULT_USER_PROFILE: UserProfileRecord = createDefaultUserProfile();

export function tableKey(tableName: string): string {
  return `${DB_PREFIX}${tableName}`;
}

class LocalDatabaseService {
  private tables: Map<DbTableName, Map<string, any>> = new Map();
  private initPromise: Promise<void> | null = null;
  private lastOptimizedMs: number = Date.now();

  private getTableMap(tableName: DbTableName): Map<string, any> {
    let map = this.tables.get(tableName);
    if (!map) {
      map = new Map();
      this.tables.set(tableName, map);
    }
    return map;
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.loadTables();
    }
    return this.initPromise;
  }

  private async loadTables(): Promise<void> {
    for (const table of Object.values(DB_TABLES)) {
      const rows = await kvStore.getJson<Record<string, any>[]>(tableKey(table), []);
      const map = this.getTableMap(table);
      map.clear();
      for (const row of Array.isArray(rows) ? rows : []) {
        if (row && row.id) {
          map.set(String(row.id), row);
        }
      }
    }
  }

  /** Drops the in-memory copy so the next read reloads from storage (after restore or wipe). */
  async reload(): Promise<void> {
    this.initPromise = this.loadTables();
    await this.initPromise;
  }

  private async persistTable(tableName: DbTableName): Promise<void> {
    const records = Array.from(this.getTableMap(tableName).values());
    await kvStore.setJson(tableKey(tableName), records);
  }

  // --- CRUD ---

  async insert<T extends Record<string, any>>(tableName: DbTableName, record: T): Promise<T> {
    await this.ensureInitialized();
    const id = String(record.id || `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    const savedRecord = { ...record, id };
    this.getTableMap(tableName).set(id, savedRecord);
    await this.persistTable(tableName);
    return savedRecord;
  }

  async selectById<T = any>(tableName: DbTableName, id: string): Promise<T | null> {
    await this.ensureInitialized();
    return (this.getTableMap(tableName).get(id) as T) || null;
  }

  async selectAll<T = any>(tableName: DbTableName): Promise<T[]> {
    await this.ensureInitialized();
    return Array.from(this.getTableMap(tableName).values()) as T[];
  }

  async query<T = any>(tableName: DbTableName, predicate: (record: T) => boolean): Promise<T[]> {
    const all = await this.selectAll<T>(tableName);
    return all.filter(predicate);
  }

  async update<T extends Record<string, any>>(
    tableName: DbTableName,
    id: string,
    updates: Partial<T>
  ): Promise<T | null> {
    await this.ensureInitialized();
    const map = this.getTableMap(tableName);
    if (!map.has(id)) return null;
    const updated = { ...map.get(id), ...updates, updatedAt: Date.now() };
    map.set(id, updated);
    await this.persistTable(tableName);
    return updated;
  }

  async delete(tableName: DbTableName, id: string): Promise<boolean> {
    await this.ensureInitialized();
    const map = this.getTableMap(tableName);
    if (!map.has(id)) return false;
    map.delete(id);
    await this.persistTable(tableName);
    return true;
  }

  /** Deletes every row matching the predicate with a single write. Returns the number removed. */
  async deleteWhere<T = any>(tableName: DbTableName, predicate: (record: T) => boolean): Promise<number> {
    await this.ensureInitialized();
    const map = this.getTableMap(tableName);
    let removed = 0;
    for (const [id, row] of Array.from(map.entries())) {
      if (predicate(row as T)) {
        map.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      await this.persistTable(tableName);
    }
    return removed;
  }

  /** Replaces a whole table (used by backup restore). */
  async replaceTable<T extends Record<string, any>>(tableName: DbTableName, rows: T[]): Promise<void> {
    await this.ensureInitialized();
    const map = this.getTableMap(tableName);
    map.clear();
    for (const row of rows) {
      if (row && row.id) {
        map.set(String(row.id), row);
      }
    }
    await this.persistTable(tableName);
  }

  async clearTable(tableName: DbTableName): Promise<void> {
    await this.replaceTable(tableName, []);
  }

  async count(tableName: DbTableName): Promise<number> {
    await this.ensureInitialized();
    return this.getTableMap(tableName).size;
  }

  // --- Health profile ---

  async getUserProfile(): Promise<UserProfileRecord> {
    const profile = await this.selectById<UserProfileRecord>(DB_TABLES.USER_PROFILE, PRIMARY_PROFILE_ID);
    return profile ? { ...createDefaultUserProfile(), ...profile } : createDefaultUserProfile();
  }

  async updateUserProfile(updates: Partial<UserProfileRecord>): Promise<UserProfileRecord> {
    const current = await this.getUserProfile();
    const updated: UserProfileRecord = {
      ...current,
      ...updates,
      id: PRIMARY_PROFILE_ID,
      updatedAt: Date.now()
    };
    await this.insert(DB_TABLES.USER_PROFILE, updated);
    return updated;
  }

  // --- Diagnostics ---

  async getDatabaseStats(): Promise<DatabaseStats> {
    const tableDescriptions: Record<DbTableName, string> = {
      [DB_TABLES.USER_PROFILE]: 'Personal health info, blood group & emergency contact',
      [DB_TABLES.MEDICINES]: 'Active and archived medications, dosages & inventory stock',
      [DB_TABLES.MEDICINE_DOSES]: 'Dose consumption history and real-time intake logs'
    };

    const tables: TableStats[] = [];
    let totalRows = 0;
    for (const tableName of Object.values(DB_TABLES)) {
      const count = await this.count(tableName);
      totalRows += count;
      tables.push({ tableName, rowCount: count, description: tableDescriptions[tableName] });
    }

    return {
      databaseName: DB_NAME,
      engine: kvStore.isPersistent() ? 'AsyncStorage (on-device)' : 'In-memory (not persisted)',
      version: DB_VERSION,
      tables,
      totalRows,
      lastOptimizedMs: this.lastOptimizedMs
    };
  }

  /** Drops dose rows that point to medicines that no longer exist. */
  async optimizeDatabase(): Promise<boolean> {
    const medicineIds = new Set(
      (await this.selectAll<{ id: string }>(DB_TABLES.MEDICINES)).map((m) => m.id)
    );
    await this.deleteWhere<{ medicineId: string }>(
      DB_TABLES.MEDICINE_DOSES,
      (d) => !medicineIds.has(d.medicineId)
    );
    this.lastOptimizedMs = Date.now();
    return true;
  }
}

export const databaseService = new LocalDatabaseService();
export const localDb = databaseService;
