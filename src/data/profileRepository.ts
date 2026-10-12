import { databaseService, UserProfileRecord } from '../services/DatabaseService';
import { storageService } from '../services/StorageService';

export class ProfileRepository {
  async getProfile(): Promise<UserProfileRecord> {
    return databaseService.getUserProfile();
  }

  async updateProfile(updates: Partial<UserProfileRecord>): Promise<UserProfileRecord> {
    return databaseService.updateUserProfile(updates);
  }

  async hasCompletedOnboarding(): Promise<boolean> {
    const settings = await storageService.getSettings();
    return settings.hasCompletedOnboarding;
  }

  async setCompletedOnboarding(completed: boolean): Promise<void> {
    await storageService.updateSettings({ hasCompletedOnboarding: completed });
  }
}

export const profileRepository = new ProfileRepository();
