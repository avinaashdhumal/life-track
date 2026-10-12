import { kvStore } from './kvStore';
import { STORAGE_KEYS, routineKey, storageService } from './StorageService';
import { LEGACY_DB_TABLES, tableKey, databaseService } from './DatabaseService';
import { getDefaultDailyRoutine } from '../domain/routine';

/**
 * Versioned, idempotent storage migrations. Run once at startup before anything reads data.
 * Add a new step for every change to a stored shape (see docs/CONVENTIONS.md → Persistence).
 */

export const SCHEMA_VERSION_KEY = '@lifetrack:schema_version';
export const CURRENT_SCHEMA_VERSION = 2;

// Schema v1 loose keys (profileRepository wrote these directly).
const LEGACY_ONBOARDING_KEY = '@lifetrack:has_completed_onboarding';
const LEGACY_SHIFT_FLAG_KEY = '@lifetrack:shift_feature_enabled';
const LEGACY_PROFILE_KEY = '@lifetrack:user_profile:v1';
// Web-only duplicates of settings.language / settings.themeMode written by v1 i18n and ThemeContext.
const LEGACY_WEB_KEYS = ['lifetrack_user_language', 'lifetrack_theme_mode'];

export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  /** True when alarms should be fully re-planned (ids or ownership changed). */
  alarmsNeedRebuild: boolean;
}

/**
 * v1 → v2 (DEBT-001, DEBT-002):
 * - onboarding flag → settings.hasCompletedOnboarding
 * - onboarding "use shifts" flag (never read in v1, BUG-012) → shiftConfig.isEnabled, unless the user
 *   already configured shifts
 * - wake/sleep edited on the Profile screen (never reached the routine in v1) → routine, if the
 *   routine was never saved
 * - delete the duplicate DB tables and loose keys
 */
async function migrateV1ToV2(): Promise<void> {
  const legacySettingsRows = await kvStore.getJson<{ id?: string; key?: string; value?: unknown }[]>(
    tableKey('app_settings'),
    []
  );
  const legacySetting = (key: string) =>
    Array.isArray(legacySettingsRows)
      ? legacySettingsRows.find((r) => r && (r.key === key || r.id === key))?.value
      : undefined;

  // 1. Onboarding flag
  const settings = await kvStore.getJson<Record<string, unknown>>(STORAGE_KEYS.SETTINGS, {});
  if (typeof settings.hasCompletedOnboarding !== 'boolean') {
    const loose = await kvStore.get(LEGACY_ONBOARDING_KEY);
    const completed = loose !== null ? loose === 'true' : legacySetting('has_completed_onboarding') === true;
    await storageService.updateSettings({ hasCompletedOnboarding: completed });
  }

  // 2. Shift opt-in from onboarding
  const looseShift = await kvStore.get(LEGACY_SHIFT_FLAG_KEY);
  const wantedShifts = looseShift !== null ? looseShift === 'true' : legacySetting('shift_feature_enabled') === true;
  if (wantedShifts && !(await storageService.hasStoredShiftConfig())) {
    await storageService.updateShiftConfig({ isEnabled: true });
  }

  // 3. Wake/sleep from the profile record
  if (!(await kvStore.has(routineKey('default')))) {
    const profileRows = await kvStore.getJson<{ wakeTime?: string; sleepTime?: string }[]>(
      tableKey('user_profile'),
      []
    );
    const profile = Array.isArray(profileRows) ? profileRows[0] : undefined;
    const defaults = getDefaultDailyRoutine('default');
    const wake = profile?.wakeTime;
    const sleep = profile?.sleepTime;
    if ((wake && wake !== defaults.wakeTime) || (sleep && sleep !== defaults.sleepTime)) {
      await storageService.updateDailyRoutine({
        wakeTime: wake || defaults.wakeTime,
        sleepTime: sleep || defaults.sleepTime
      });
    }
  }

  // 4. Remove duplicates
  for (const table of LEGACY_DB_TABLES) {
    await kvStore.remove(tableKey(table));
  }
  await kvStore.remove(LEGACY_ONBOARDING_KEY);
  await kvStore.remove(LEGACY_SHIFT_FLAG_KEY);
  await kvStore.remove(LEGACY_PROFILE_KEY);
  for (const key of LEGACY_WEB_KEYS) {
    await kvStore.remove(key);
  }
  await databaseService.reload();
}

export async function runMigrations(): Promise<MigrationResult> {
  const raw = await kvStore.get(SCHEMA_VERSION_KEY);
  const fromVersion = raw ? parseInt(raw, 10) || 1 : 1;
  let version = fromVersion;
  let alarmsNeedRebuild = false;

  if (version < 2) {
    await migrateV1ToV2();
    version = 2;
    // Occurrence ids changed (local dates) and native alarms now carry scheduleId.
    alarmsNeedRebuild = true;
  }

  if (version !== fromVersion || raw === null) {
    await kvStore.set(SCHEMA_VERSION_KEY, String(version));
  }

  return { fromVersion, toVersion: version, alarmsNeedRebuild };
}
