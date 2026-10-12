import { z } from 'zod';
import { DoseLogEntrySchema, MedicineSchema, Medicine, DoseLogEntry } from '../domain/medicine';
import { RecurringSchedule, ReminderLogEntry } from '../domain/alarm';
import { DailyRoutine } from '../domain/routine';
import { ShiftConfig } from '../domain/shift';
import { kvStore } from './kvStore';
import { AppSettings, DEFAULT_APP_SETTINGS, STORAGE_KEYS, routineKey, storageService } from './StorageService';
import { DB_TABLES, PRIMARY_PROFILE_ID, UserProfileRecord, createDefaultUserProfile, databaseService } from './DatabaseService';

/**
 * Backup, restore, and "delete all my data" for every LifeTrack store (BUG-003).
 * Alarms are not backed up: they are derived from medicines and schedules and get re-planned
 * after a restore (the caller runs `reminderCoordinator.rebuildAll()`).
 */

export const BACKUP_FORMAT = 'lifetrack-backup';
export const BACKUP_SCHEMA_VERSION = 2;

export interface BackupData {
  settings: Partial<AppSettings>;
  profile: UserProfileRecord | null;
  routine: DailyRoutine | null;
  shiftConfig: ShiftConfig | null;
  schedules: RecurringSchedule[];
  medicines: Medicine[];
  doses: DoseLogEntry[];
  logs: ReminderLogEntry[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: number;
  data: BackupData;
}

export interface RestoreResult {
  ok: boolean;
  error?: string;
  counts?: { medicines: number; doses: number; schedules: number; logs: number };
}

// Loose schemas: required identity fields are checked, unknown fields are kept (forward compatible).
const SettingsSchema = z.object({}).passthrough();
const ProfileSchema = z
  .object({
    name: z.string().optional(),
    bloodGroup: z.string().optional(),
    medicalConditions: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional()
  })
  .passthrough();
const RoutineSchema = z.object({ wakeTime: z.string(), sleepTime: z.string() }).passthrough();
const ShiftConfigSchema = z.object({ isEnabled: z.boolean(), workMode: z.string() }).passthrough();
const ScheduleSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    recurrenceType: z.string(),
    timeOfDay: z.string(),
    isEnabled: z.boolean()
  })
  .passthrough();
const LogSchema = z.object({ id: z.string().min(1), action: z.string(), timestampMs: z.number() }).passthrough();

const BackupDataSchema = z.object({
  settings: SettingsSchema.default({}),
  profile: ProfileSchema.nullable().default(null),
  routine: RoutineSchema.nullable().default(null),
  shiftConfig: ShiftConfigSchema.nullable().default(null),
  schedules: z.array(ScheduleSchema).default([]),
  medicines: z.array(MedicineSchema).default([]),
  doses: z.array(DoseLogEntrySchema).default([]),
  logs: z.array(LogSchema).default([])
});

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

/** Schema v1 table dump from the old Profile "Backup" button (`databaseService.exportDatabaseDump`). */
function fromLegacyDbDump(dump: Record<string, any>): Record<string, unknown> {
  const settingsRows = asArray(dump.app_settings);
  const onboarding = settingsRows.find((r) => r?.key === 'has_completed_onboarding' || r?.id === 'has_completed_onboarding');
  return {
    settings: onboarding?.value === true ? { hasCompletedOnboarding: true } : {},
    profile: asArray(dump.user_profile)[0] ?? null,
    routine: asArray(dump.daily_routines)[0] ?? null,
    shiftConfig: asArray(dump.shift_config)[0] ?? null,
    schedules: asArray(dump.schedules),
    medicines: asArray(dump.medicines),
    doses: asArray(dump.medicine_doses),
    logs: asArray(dump.reminder_logs)
  };
}

/** Schema v1 StorageService export (`version: 1`). */
function fromLegacyStorageExport(data: Record<string, any>): Record<string, unknown> {
  return {
    settings: data.settings ?? {},
    schedules: asArray(data.schedules),
    logs: asArray(data.logs)
  };
}

class DataManagementService {
  async createBackup(): Promise<BackupFile> {
    const [settings, profile, routine, shiftConfig, schedules, medicines, doses, logs] = await Promise.all([
      storageService.getSettings(),
      databaseService.getUserProfile(),
      kvStore.getJson<DailyRoutine | null>(routineKey('default'), null),
      kvStore.getJson<ShiftConfig | null>(STORAGE_KEYS.SHIFT_CONFIG, null),
      storageService.getRecurringSchedules(),
      databaseService.selectAll<Medicine>(DB_TABLES.MEDICINES),
      databaseService.selectAll<DoseLogEntry>(DB_TABLES.MEDICINE_DOSES),
      storageService.getLogs(Number.MAX_SAFE_INTEGER)
    ]);

    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: Date.now(),
      data: { settings, profile, routine, shiftConfig, schedules, medicines, doses, logs }
    };
  }

  async exportBackupJson(): Promise<string> {
    return JSON.stringify(await this.createBackup(), null, 2);
  }

  /** Accepts a v2 backup or either v1 legacy format. Nothing is written unless the whole file is valid. */
  parseBackup(json: string): { data?: BackupData; error?: string } {
    let raw: any;
    try {
      raw = JSON.parse(json);
    } catch {
      return { error: 'not_json' };
    }
    if (!raw || typeof raw !== 'object') return { error: 'not_object' };

    let candidate: unknown;
    if (raw.format === BACKUP_FORMAT) {
      if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
        return { error: 'newer_version' };
      }
      candidate = raw.data;
    } else if (raw._meta && typeof raw._meta === 'object') {
      candidate = fromLegacyDbDump(raw);
    } else if (raw.version === 1 && (raw.settings || raw.schedules)) {
      candidate = fromLegacyStorageExport(raw);
    } else {
      return { error: 'unknown_format' };
    }

    const parsed = BackupDataSchema.safeParse(candidate);
    if (!parsed.success) {
      return { error: 'invalid_data' };
    }
    return { data: parsed.data as unknown as BackupData };
  }

  /** Replaces all app data with the backup. Callers must re-plan alarms afterwards. */
  async restoreBackupJson(json: string): Promise<RestoreResult> {
    const { data, error } = this.parseBackup(json);
    if (!data) return { ok: false, error };

    const currentSettings = await storageService.getSettings();
    await kvStore.setJson(STORAGE_KEYS.SETTINGS, {
      ...DEFAULT_APP_SETTINGS,
      ...data.settings,
      // Restoring happens inside an onboarded app; never send the user back to onboarding.
      hasCompletedOnboarding: currentSettings.hasCompletedOnboarding || data.settings.hasCompletedOnboarding === true
    });

    const profile = data.profile ? { ...createDefaultUserProfile(), ...data.profile, id: PRIMARY_PROFILE_ID } : null;
    await databaseService.replaceTable(DB_TABLES.USER_PROFILE, profile ? [profile] : []);
    await databaseService.replaceTable(DB_TABLES.MEDICINES, data.medicines);
    await databaseService.replaceTable(DB_TABLES.MEDICINE_DOSES, data.doses);

    if (data.routine) {
      await kvStore.setJson(routineKey('default'), data.routine);
    } else {
      await kvStore.remove(routineKey('default'));
    }
    if (data.shiftConfig) {
      await kvStore.setJson(STORAGE_KEYS.SHIFT_CONFIG, data.shiftConfig);
    } else {
      await kvStore.remove(STORAGE_KEYS.SHIFT_CONFIG);
    }

    await storageService.saveRecurringSchedules(data.schedules);
    await storageService.saveLogs(data.logs);
    await storageService.updateSettings({});

    return {
      ok: true,
      counts: {
        medicines: data.medicines.length,
        doses: data.doses.length,
        schedules: data.schedules.length,
        logs: data.logs.length
      }
    };
  }

  /** Deletes every stored LifeTrack value (the caller also cancels native alarms). */
  async clearAllData(): Promise<void> {
    await kvStore.clearAll();
    await databaseService.reload();
    await storageService.resetSettings();
  }
}

export const dataManagementService = new DataManagementService();
