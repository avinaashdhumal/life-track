import { databaseService, DB_TABLES, UserProfileRecord, DEFAULT_USER_PROFILE } from '../services/DatabaseService';

export interface AppSettingsRecord {
  key: string;
  value: any;
  updatedAt: number;
}

export interface ProfileSettingsState {
  profile: UserProfileRecord;
  hasCompletedOnboarding: boolean;
  shiftFeatureEnabled: boolean; // OFF by default
  defaultSnoozeMinutes: number;
  alarmVolume: number;
}

const SETTING_ONBOARDING_KEY = 'has_completed_onboarding';
const SETTING_SHIFT_FEATURE_KEY = 'shift_feature_enabled';
const SETTING_DEFAULT_SNOOZE_KEY = 'default_snooze_minutes';

export class ProfileRepository {
  async getProfile(): Promise<UserProfileRecord> {
    return databaseService.getUserProfile();
  }

  async updateProfile(updates: Partial<UserProfileRecord>): Promise<UserProfileRecord> {
    return databaseService.updateUserProfile(updates);
  }

  async hasCompletedOnboarding(): Promise<boolean> {
    const setting = await databaseService.selectById<AppSettingsRecord>(
      DB_TABLES.APP_SETTINGS,
      SETTING_ONBOARDING_KEY
    );
    return setting?.value === true;
  }

  async setCompletedOnboarding(completed: boolean): Promise<void> {
    await databaseService.insert(DB_TABLES.APP_SETTINGS, {
      id: SETTING_ONBOARDING_KEY,
      key: SETTING_ONBOARDING_KEY,
      value: completed,
      updatedAt: Date.now()
    });
  }

  /**
   * Shift & Schedule feature toggle.
   * Strictly FALSE by default unless user explicitly chose "Yes".
   */
  async isShiftFeatureEnabled(): Promise<boolean> {
    const setting = await databaseService.selectById<AppSettingsRecord>(
      DB_TABLES.APP_SETTINGS,
      SETTING_SHIFT_FEATURE_KEY
    );
    return setting?.value === true; // Default false
  }

  async setShiftFeatureEnabled(enabled: boolean): Promise<void> {
    await databaseService.insert(DB_TABLES.APP_SETTINGS, {
      id: SETTING_SHIFT_FEATURE_KEY,
      key: SETTING_SHIFT_FEATURE_KEY,
      value: enabled,
      updatedAt: Date.now()
    });
  }

  async getDefaultSnoozeMinutes(): Promise<number> {
    const setting = await databaseService.selectById<AppSettingsRecord>(
      DB_TABLES.APP_SETTINGS,
      SETTING_DEFAULT_SNOOZE_KEY
    );
    return typeof setting?.value === 'number' ? setting.value : 10;
  }

  async setDefaultSnoozeMinutes(minutes: number): Promise<void> {
    await databaseService.insert(DB_TABLES.APP_SETTINGS, {
      id: SETTING_DEFAULT_SNOOZE_KEY,
      key: SETTING_DEFAULT_SNOOZE_KEY,
      value: minutes,
      updatedAt: Date.now()
    });
  }
}

export const profileRepository = new ProfileRepository();
