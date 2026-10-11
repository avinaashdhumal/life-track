import { ShiftConfig, ShiftOverride, getDefaultShiftConfig } from '../domain/shift';
import { storageService } from '../services/StorageService';
import { localDb, DB_TABLES } from '../services/DatabaseService';

class ShiftRepository {
  getDefaultConfig(): ShiftConfig {
    return getDefaultShiftConfig();
  }

  async getConfig(): Promise<ShiftConfig> {
    return this.getShiftConfig();
  }

  async saveConfig(config: ShiftConfig): Promise<ShiftConfig> {
    return this.saveShiftConfig(config);
  }

  async getShiftConfig(): Promise<ShiftConfig> {
    try {
      const config = await storageService.getShiftConfig();
      return config || getDefaultShiftConfig();
    } catch {
      return getDefaultShiftConfig();
    }
  }

  async saveShiftConfig(config: ShiftConfig): Promise<ShiftConfig> {
    const updated: ShiftConfig = {
      ...config,
      updatedAt: Date.now()
    };
    await storageService.updateShiftConfig(updated);
    try {
      await localDb.upsert(DB_TABLES.SHIFT_CONFIG, 'config_primary', updated);
    } catch {
      // Best-effort local relational DB sync
    }
    return updated;
  }

  async updateShiftConfig(updates: Partial<ShiftConfig>): Promise<ShiftConfig> {
    const current = await this.getShiftConfig();
    const updated: ShiftConfig = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };
    return this.saveShiftConfig(updated);
  }

  async addOverride(override: ShiftOverride): Promise<ShiftConfig> {
    const config = await this.getShiftConfig();
    const overrides = { ...config.overrides, [override.date]: override };
    return this.saveShiftConfig({ ...config, overrides });
  }

  async removeOverride(dateStr: string): Promise<ShiftConfig> {
    const config = await this.getShiftConfig();
    const overrides = { ...config.overrides };
    delete overrides[dateStr];
    return this.saveShiftConfig({ ...config, overrides });
  }

  async toggleShiftEngine(enable: boolean): Promise<ShiftConfig> {
    return this.updateShiftConfig({ isEnabled: enable });
  }
}

export const shiftRepository = new ShiftRepository();
