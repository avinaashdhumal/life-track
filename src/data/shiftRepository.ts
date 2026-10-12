import { ShiftConfig, ShiftOverride, getDefaultShiftConfig } from '../domain/shift';
import { storageService } from '../services/StorageService';
import { ChangeEmitter } from './changeEmitter';

class ShiftRepository {
  readonly changes = new ChangeEmitter<{ config: ShiftConfig }>();

  getDefaultConfig(): ShiftConfig {
    return getDefaultShiftConfig();
  }

  async getConfig(): Promise<ShiftConfig> {
    try {
      return await storageService.getShiftConfig();
    } catch {
      return getDefaultShiftConfig();
    }
  }

  async saveConfig(config: ShiftConfig): Promise<ShiftConfig> {
    const updated = await storageService.updateShiftConfig(config);
    this.changes.emit({ config: updated });
    return updated;
  }

  async updateConfig(updates: Partial<ShiftConfig>): Promise<ShiftConfig> {
    const current = await this.getConfig();
    return this.saveConfig({ ...current, ...updates });
  }

  async addOverride(override: ShiftOverride): Promise<ShiftConfig> {
    const config = await this.getConfig();
    const overrides = { ...config.overrides, [override.date]: override };
    return this.saveConfig({ ...config, overrides });
  }

  async removeOverride(dateStr: string): Promise<ShiftConfig> {
    const config = await this.getConfig();
    const overrides = { ...config.overrides };
    delete overrides[dateStr];
    return this.saveConfig({ ...config, overrides });
  }

  /** The single on/off switch for the shift feature (onboarding and the Shift screen both use it). */
  async setEnabled(enable: boolean): Promise<ShiftConfig> {
    return this.updateConfig({ isEnabled: enable });
  }
}

export const shiftRepository = new ShiftRepository();
