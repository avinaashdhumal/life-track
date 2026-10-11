import { z } from 'zod';

/**
 * LifeTrack Medicine Domain Models & Safety Rules
 * 
 * Strict Domain Layer:
 * - Pure TypeScript + Zod schema validation
 * - Zero React / React Native / Expo imports
 * - Offline-first, multi-profile ready (profileId: 'default')
 * - Safety checks: minimum dose gap, max daily doses ceiling, stock auto-decrement,
 *   and doctor advice for missed doses.
 */

export const MedicineFormSchema = z.enum([
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'drops',
  'inhaler',
  'patch',
  'ointment',
  'other'
]);
export type MedicineForm = z.infer<typeof MedicineFormSchema>;

export const FoodRelationSchema = z.enum([
  'before',
  'with',
  'after',
  'empty_stomach',
  'no_relation'
]);
export type FoodRelation = z.infer<typeof FoodRelationSchema>;

export const MedicineScheduleTypeSchema = z.enum([
  'fixed_time',
  'interval',
  'prn_as_needed'
]);
export type MedicineScheduleType = z.infer<typeof MedicineScheduleTypeSchema>;

export const DoseStatusSchema = z.enum([
  'taken',
  'snoozed',
  'skipped',
  'missed'
]);
export type DoseStatus = z.infer<typeof DoseStatusSchema>;

export const MedicineSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().default('default'),
  name: z.string().min(1, 'Medicine name is required'),
  form: MedicineFormSchema.default('tablet'),
  strength: z.string().default(''), // e.g. "500 mg", "10 ml"
  foodRelation: FoodRelationSchema.default('no_relation'),
  scheduleType: MedicineScheduleTypeSchema.default('fixed_time'),
  timesOfDay: z.array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)).default(['08:00']),
  intervalHours: z.number().int().positive().optional(),
  minGapMinutes: z.number().int().nonnegative().optional(), // Safety rule: min gap between doses
  maxDailyDoses: z.number().int().positive().optional(), // Safety rule: max doses in 24 hours (PRN ceiling)
  stockCount: z.number().int().nonnegative().default(30),
  refillThreshold: z.number().int().nonnegative().default(5),
  unit: z.string().default('tablets'),
  missedDoseAdvice: z.string().optional(), // Doctor advice if a dose is missed
  instructions: z.string().optional(), // e.g. "Take with plenty of water"
  color: z.string().default('#10b981'),
  icon: z.string().default('pill'),
  isActive: z.boolean().default(true),
  createdAt: z.number().int(),
  updatedAt: z.number().int()
});
export type Medicine = z.infer<typeof MedicineSchema>;

export const DoseLogEntrySchema = z.object({
  id: z.string().min(1),
  profileId: z.string().default('default'),
  medicineId: z.string().min(1),
  medicineName: z.string().min(1),
  scheduledTime: z.string().optional(), // e.g. "08:00"
  scheduledTimestampMs: z.number().int().optional(),
  takenTimestampMs: z.number().int(), // Actual real-time timestamp when taken/logged
  status: DoseStatusSchema,
  quantityTaken: z.number().int().nonnegative().default(1),
  skipReason: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.number().int()
});
export type DoseLogEntry = z.infer<typeof DoseLogEntrySchema>;

export interface TodayDoseSlot {
  slotId: string;
  medicineId: string;
  medicineName: string;
  form: MedicineForm;
  strength: string;
  foodRelation: FoodRelation;
  scheduleType: MedicineScheduleType;
  scheduledTime: string; // "08:00" or "PRN"
  scheduledTimestampMs: number;
  status: 'pending' | 'taken' | 'snoozed' | 'skipped' | 'overdue';
  logEntry?: DoseLogEntry;
  minGapMinutes?: number;
  maxDailyDoses?: number;
  missedDoseAdvice?: string;
  stockCount: number;
  refillThreshold: number;
}

export interface DoseSafetyCheckResult {
  isSafe: boolean;
  differenceMinutes: number;
  minGapMinutes: number;
  warning?: string;
}

export interface DailyDoseLimitCheckResult {
  isAllowed: boolean;
  dosesTakenToday: number;
  maxDailyDoses?: number;
  warning?: string;
}

export interface StockLevelResult {
  stockCount: number;
  refillThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  message: string;
}

// --- Safety Rules & Pure Logic Functions ---

/**
 * Minimum Dose Gap Safety Rule:
 * Ensures the patient doesn't accidentally double-dose or take medication too soon
 * after the previous dose.
 */
export function checkMinimumDoseGap(
  lastTakenMs: number | null | undefined,
  currentTimestampMs: number,
  minGapMinutes?: number | null
): DoseSafetyCheckResult {
  if (!lastTakenMs || !minGapMinutes || minGapMinutes <= 0) {
    return {
      isSafe: true,
      differenceMinutes: Infinity,
      minGapMinutes: minGapMinutes || 0
    };
  }

  const diffMs = currentTimestampMs - lastTakenMs;
  const differenceMinutes = Math.floor(diffMs / (60 * 1000));

  if (differenceMinutes < minGapMinutes) {
    const remainingMinutes = minGapMinutes - differenceMinutes;
    return {
      isSafe: false,
      differenceMinutes,
      minGapMinutes,
      warning: `Minimum gap between doses is ${minGapMinutes} min. Last dose was taken ${differenceMinutes} min ago (${remainingMinutes} min remaining).`
    };
  }

  return {
    isSafe: true,
    differenceMinutes,
    minGapMinutes
  };
}

/**
 * Daily PRN / Ceiling Dose Limit Check:
 * Enforces safety ceilings on as-needed pain relief or symptomatic drugs.
 */
export function checkMaxDailyDoses(
  dosesTakenToday: number,
  maxDailyDoses?: number | null
): DailyDoseLimitCheckResult {
  if (!maxDailyDoses || maxDailyDoses <= 0) {
    return {
      isAllowed: true,
      dosesTakenToday
    };
  }

  if (dosesTakenToday >= maxDailyDoses) {
    return {
      isAllowed: false,
      dosesTakenToday,
      maxDailyDoses,
      warning: `Daily safety limit reached: ${dosesTakenToday}/${maxDailyDoses} doses already recorded for today.`
    };
  }

  return {
    isAllowed: true,
    dosesTakenToday,
    maxDailyDoses
  };
}

/**
 * Stock Level Calculation & Refill Alert:
 */
export function calculateStockLevel(
  currentStock: number,
  refillThreshold: number
): StockLevelResult {
  const stockCount = Math.max(0, currentStock);
  const isOutOfStock = stockCount === 0;
  const isLowStock = !isOutOfStock && stockCount <= refillThreshold;

  let message = 'In stock';
  if (isOutOfStock) {
    message = 'Out of stock - Refill immediately';
  } else if (isLowStock) {
    message = `Low stock: ${stockCount} remaining (Threshold: ${refillThreshold})`;
  }

  return {
    stockCount,
    refillThreshold,
    isLowStock,
    isOutOfStock,
    message
  };
}

/**
 * Calculate updated stock count upon taking a dose.
 * Never drops below 0.
 */
export function decrementStock(currentStock: number, amount: number = 1): number {
  return Math.max(0, currentStock - amount);
}

/**
 * Increment stock upon refilling inventory.
 */
export function incrementStock(currentStock: number, amount: number): number {
  return Math.max(0, currentStock + Math.max(0, amount));
}

/**
 * Generate Today's Dose Slots for a given medicine:
 * Merges scheduled times with dose logs recorded today.
 */
export function generateTodayDoseSlots(
  medicine: Medicine,
  todayDateStr: string, // YYYY-MM-DD
  todayLogs: DoseLogEntry[]
): TodayDoseSlot[] {
  if (!medicine.isActive) {
    return [];
  }

  const logsForMed = todayLogs.filter((l) => l.medicineId === medicine.id);
  const now = Date.now();

  if (medicine.scheduleType === 'prn_as_needed') {
    // For PRN, we show one active PRN card plus any logged entries
    return [
      {
        slotId: `${medicine.id}_prn_today`,
        medicineId: medicine.id,
        medicineName: medicine.name,
        form: medicine.form,
        strength: medicine.strength,
        foodRelation: medicine.foodRelation,
        scheduleType: 'prn_as_needed',
        scheduledTime: 'PRN',
        scheduledTimestampMs: now,
        status: 'pending',
        minGapMinutes: medicine.minGapMinutes,
        maxDailyDoses: medicine.maxDailyDoses,
        missedDoseAdvice: medicine.missedDoseAdvice,
        stockCount: medicine.stockCount,
        refillThreshold: medicine.refillThreshold
      }
    ];
  }

  // Fixed time or interval schedules:
  const slots: TodayDoseSlot[] = [];
  const times = medicine.timesOfDay.length > 0 ? medicine.timesOfDay : ['08:00'];

  for (const timeStr of times) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const scheduledDate = new Date(`${todayDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    const scheduledTimestampMs = scheduledDate.getTime();

    // Check if there is an existing log for this scheduled time
    const matchingLog = logsForMed.find(
      (l) => l.scheduledTime === timeStr || (l.scheduledTimestampMs && Math.abs(l.scheduledTimestampMs - scheduledTimestampMs) < 60 * 60 * 1000)
    );

    let status: TodayDoseSlot['status'] = 'pending';
    if (matchingLog) {
      if (matchingLog.status === 'taken') status = 'taken';
      else if (matchingLog.status === 'snoozed') status = 'snoozed';
      else if (matchingLog.status === 'skipped') status = 'skipped';
      else if (matchingLog.status === 'missed') status = 'overdue';
    } else if (now > scheduledTimestampMs + 60 * 60 * 1000) {
      // If more than 1 hour past scheduled time and not logged, it's overdue
      status = 'overdue';
    }

    slots.push({
      slotId: `${medicine.id}_${todayDateStr}_${timeStr}`,
      medicineId: medicine.id,
      medicineName: medicine.name,
      form: medicine.form,
      strength: medicine.strength,
      foodRelation: medicine.foodRelation,
      scheduleType: medicine.scheduleType,
      scheduledTime: timeStr,
      scheduledTimestampMs,
      status,
      logEntry: matchingLog,
      minGapMinutes: medicine.minGapMinutes,
      maxDailyDoses: medicine.maxDailyDoses,
      missedDoseAdvice: medicine.missedDoseAdvice,
      stockCount: medicine.stockCount,
      refillThreshold: medicine.refillThreshold
    });
  }

  return slots.sort((a, b) => a.scheduledTimestampMs - b.scheduledTimestampMs);
}
