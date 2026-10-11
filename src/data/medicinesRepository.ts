import AsyncStorage from '@react-native-async-storage/async-storage';
import { databaseService, DB_TABLES } from '../services/DatabaseService';
import {
  Medicine,
  MedicineSchema,
  DoseLogEntry,
  DoseLogEntrySchema,
  checkMinimumDoseGap,
  checkMaxDailyDoses,
  decrementStock,
  incrementStock,
  calculateStockLevel,
  DoseSafetyCheckResult,
  DailyDoseLimitCheckResult
} from '../domain/medicine';

export interface LogDoseResult {
  success: boolean;
  log: DoseLogEntry;
  updatedStock: number;
  safetyWarning?: string;
  isLowStock: boolean;
}

export class MedicinesRepository {
  private seeded: boolean = false;

  private async ensureSeed(): Promise<void> {
    this.seeded = true;
  }

  async getAll(profileId: string = 'default'): Promise<Medicine[]> {
    await this.ensureSeed();
    const list = await databaseService.query<Medicine>(
      DB_TABLES.MEDICINES,
      (m) => m.profileId === profileId
    );
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getActive(profileId: string = 'default'): Promise<Medicine[]> {
    await this.ensureSeed();
    const list = await databaseService.query<Medicine>(
      DB_TABLES.MEDICINES,
      (m) => m.profileId === profileId && m.isActive
    );
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id: string): Promise<Medicine | null> {
    await this.ensureSeed();
    return databaseService.selectById<Medicine>(DB_TABLES.MEDICINES, id);
  }

  async upsert(medicineData: Partial<Medicine> & { name: string }): Promise<Medicine> {
    await this.ensureSeed();
    const now = Date.now();
    const existing = medicineData.id ? await this.getById(medicineData.id) : null;
    const id = medicineData.id || `med_${now}_${Math.random().toString(36).substring(2, 7)}`;

    const candidate: Medicine = {
      id,
      profileId: medicineData.profileId || existing?.profileId || 'default',
      name: medicineData.name.trim(),
      form: medicineData.form || existing?.form || 'tablet',
      strength: medicineData.strength !== undefined ? medicineData.strength : (existing?.strength || ''),
      foodRelation: medicineData.foodRelation || existing?.foodRelation || 'no_relation',
      scheduleType: medicineData.scheduleType || existing?.scheduleType || 'fixed_time',
      timesOfDay: medicineData.timesOfDay || existing?.timesOfDay || ['08:00'],
      intervalHours: medicineData.intervalHours ?? existing?.intervalHours,
      minGapMinutes:
        medicineData.minGapMinutes !== undefined ? medicineData.minGapMinutes : existing?.minGapMinutes,
      maxDailyDoses:
        medicineData.maxDailyDoses !== undefined ? medicineData.maxDailyDoses : existing?.maxDailyDoses,
      stockCount:
        medicineData.stockCount !== undefined
          ? Math.max(0, medicineData.stockCount)
          : (existing?.stockCount ?? 30),
      refillThreshold:
        medicineData.refillThreshold !== undefined
          ? Math.max(0, medicineData.refillThreshold)
          : (existing?.refillThreshold ?? 5),
      unit: medicineData.unit || existing?.unit || 'tablets',
      missedDoseAdvice:
        medicineData.missedDoseAdvice !== undefined
          ? medicineData.missedDoseAdvice
          : existing?.missedDoseAdvice,
      instructions:
        medicineData.instructions !== undefined ? medicineData.instructions : existing?.instructions,
      color: medicineData.color || existing?.color || '#10b981',
      icon: medicineData.icon || existing?.icon || 'pill',
      isActive:
        medicineData.isActive !== undefined ? medicineData.isActive : (existing?.isActive ?? true),
      createdAt: existing?.createdAt || medicineData.createdAt || now,
      updatedAt: now
    };

    const validated = MedicineSchema.parse(candidate);
    await databaseService.insert(DB_TABLES.MEDICINES, validated);
    return validated;
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureSeed();
    const deleted = await databaseService.delete(DB_TABLES.MEDICINES, id);
    if (deleted) {
      // Remove all dose logs associated with this medicine
      const logs = await databaseService.query<DoseLogEntry>(
        DB_TABLES.MEDICINE_DOSES,
        (l) => l.medicineId === id
      );
      for (const log of logs) {
        await databaseService.delete(DB_TABLES.MEDICINE_DOSES, log.id);
      }
    }
    return deleted;
  }

  async refillStock(medicineId: string, quantityToAdd: number): Promise<Medicine | null> {
    await this.ensureSeed();
    const current = await this.getById(medicineId);
    if (!current) return null;

    const newStock = incrementStock(current.stockCount, quantityToAdd);
    const updated = await databaseService.update<Medicine>(DB_TABLES.MEDICINES, medicineId, {
      stockCount: newStock,
      updatedAt: Date.now()
    });
    return updated;
  }

  /**
   * Log a Dose with safety verification and automatic stock decrement
   */
  async logDose(
    entry: Omit<DoseLogEntry, 'id' | 'createdAt'>
  ): Promise<LogDoseResult> {
    await this.ensureSeed();
    const medicine = await this.getById(entry.medicineId);
    if (!medicine) {
      throw new Error(`Medicine with id ${entry.medicineId} not found`);
    }

    const now = Date.now();
    const takenTime = entry.takenTimestampMs || now;
    let safetyWarning: string | undefined;

    // Safety Check 1: Minimum Dose Gap
    if (entry.status === 'taken' && medicine.minGapMinutes) {
      const recentLogs = await databaseService.query<DoseLogEntry>(
        DB_TABLES.MEDICINE_DOSES,
        (l) => l.medicineId === medicine.id && l.status === 'taken'
      );
      if (recentLogs.length > 0) {
        recentLogs.sort((a, b) => b.takenTimestampMs - a.takenTimestampMs);
        const lastTaken = recentLogs[0].takenTimestampMs;
        const gapCheck: DoseSafetyCheckResult = checkMinimumDoseGap(
          lastTaken,
          takenTime,
          medicine.minGapMinutes
        );
        if (!gapCheck.isSafe && gapCheck.warning) {
          safetyWarning = gapCheck.warning;
        }
      }
    }

    // Safety Check 2: Max Daily Doses
    if (entry.status === 'taken' && medicine.maxDailyDoses) {
      const startOfDay = new Date(takenTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(takenTime);
      endOfDay.setHours(23, 59, 59, 999);

      const takenToday = await databaseService.query<DoseLogEntry>(
        DB_TABLES.MEDICINE_DOSES,
        (l) =>
          l.medicineId === medicine.id &&
          l.status === 'taken' &&
          l.takenTimestampMs >= startOfDay.getTime() &&
          l.takenTimestampMs <= endOfDay.getTime()
      );

      const dailyCheck: DailyDoseLimitCheckResult = checkMaxDailyDoses(
        takenToday.length,
        medicine.maxDailyDoses
      );
      if (!dailyCheck.isAllowed && dailyCheck.warning) {
        safetyWarning = safetyWarning
          ? `${safetyWarning} | ${dailyCheck.warning}`
          : dailyCheck.warning;
      }
    }

    // Auto-decrement stock if dose was taken
    let updatedStock = medicine.stockCount;
    if (entry.status === 'taken') {
      updatedStock = decrementStock(medicine.stockCount, entry.quantityTaken || 1);
      await databaseService.update<Medicine>(DB_TABLES.MEDICINES, medicine.id, {
        stockCount: updatedStock,
        updatedAt: now
      });
    }

    const logRecord: DoseLogEntry = {
      ...entry,
      id: `dose_${now}_${Math.random().toString(36).substring(2, 7)}`,
      takenTimestampMs: takenTime,
      createdAt: now
    };

    const validatedLog = DoseLogEntrySchema.parse(logRecord);
    await databaseService.insert(DB_TABLES.MEDICINE_DOSES, validatedLog);

    const stockStatus = calculateStockLevel(updatedStock, medicine.refillThreshold);

    return {
      success: true,
      log: validatedLog,
      updatedStock,
      safetyWarning,
      isLowStock: stockStatus.isLowStock || stockStatus.isOutOfStock
    };
  }

  async getDosesForDay(profileId: string = 'default', dateStr: string): Promise<DoseLogEntry[]> {
    await this.ensureSeed();
    const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
    const dayEnd = new Date(`${dateStr}T23:59:59.999`).getTime();

    const list = await databaseService.query<DoseLogEntry>(
      DB_TABLES.MEDICINE_DOSES,
      (l) =>
        l.profileId === profileId &&
        l.takenTimestampMs >= dayStart &&
        l.takenTimestampMs <= dayEnd
    );

    return list.sort((a, b) => a.takenTimestampMs - b.takenTimestampMs);
  }

  async getHistoryForMedicine(medicineId: string, limit: number = 50): Promise<DoseLogEntry[]> {
    await this.ensureSeed();
    const list = await databaseService.query<DoseLogEntry>(
      DB_TABLES.MEDICINE_DOSES,
      (l) => l.medicineId === medicineId
    );
    return list.sort((a, b) => b.takenTimestampMs - a.takenTimestampMs).slice(0, limit);
  }

  async getLowStockMedicines(profileId: string = 'default'): Promise<Medicine[]> {
    await this.ensureSeed();
    const list = await this.getActive(profileId);
    return list.filter((m) => m.stockCount <= m.refillThreshold);
  }
}

export const medicinesRepository = new MedicinesRepository();
