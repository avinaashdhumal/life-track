import { DailyRoutine, getDefaultDailyRoutine } from '../domain/routine';
import { storageService } from '../services/StorageService';
import { ChangeEmitter } from './changeEmitter';

class RoutineRepository {
  /** Fires after the routine is saved. Medicine reminders anchored to the routine re-sync on this. */
  readonly changes = new ChangeEmitter<{ profileId: string }>();

  async getRoutine(profileId: string = 'default'): Promise<DailyRoutine> {
    try {
      return await storageService.getDailyRoutine(profileId);
    } catch {
      return getDefaultDailyRoutine(profileId);
    }
  }

  async saveRoutine(routine: DailyRoutine): Promise<DailyRoutine> {
    const profileId = routine.profileId || 'default';
    const updated = await storageService.updateDailyRoutine(routine, profileId);
    this.changes.emit({ profileId });
    return updated;
  }

  async updateRoutine(
    updates: Partial<DailyRoutine>,
    profileId: string = 'default'
  ): Promise<DailyRoutine> {
    const current = await this.getRoutine(profileId);
    return this.saveRoutine({ ...current, ...updates });
  }
}

export const routineRepository = new RoutineRepository();
