import { DailyRoutine, getDefaultDailyRoutine } from '../domain/routine';
import { storageService } from '../services/StorageService';
import { localDb, DB_TABLES } from '../services/DatabaseService';

class RoutineRepository {
  async getRoutine(profileId: string = 'default'): Promise<DailyRoutine> {
    try {
      const routine = await storageService.getDailyRoutine(profileId);
      return routine || getDefaultDailyRoutine(profileId);
    } catch {
      return getDefaultDailyRoutine(profileId);
    }
  }

  async saveRoutine(routine: DailyRoutine): Promise<DailyRoutine> {
    const updated: DailyRoutine = {
      ...routine,
      updatedAt: Date.now()
    };
    await storageService.updateDailyRoutine(updated, routine.profileId || 'default');
    try {
      await localDb.upsert(DB_TABLES.ROUTINES, updated.id, updated);
    } catch {
      // Local DB sync is best-effort alongside AsyncStorage
    }
    return updated;
  }

  async updateRoutine(
    updates: Partial<DailyRoutine>,
    profileId: string = 'default'
  ): Promise<DailyRoutine> {
    const current = await this.getRoutine(profileId);
    const updated: DailyRoutine = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };
    return this.saveRoutine(updated);
  }
}

export const routineRepository = new RoutineRepository();
