/**
 * Pure TypeScript Domain Layer for Shift & Schedule Engine.
 * NO React, React Native, or Expo imports allowed in this folder.
 */

import {
  DailyRoutine,
  getDefaultDailyRoutine,
  timeStringToMinutes,
  findClosestRoutineAnchor,
  calculateRoutineRelativeClockTime
} from './routine';
import { Medicine } from './medicine';
import { toLocalDateString, addLocalDays } from './dates';

export interface ShiftType {
  id: string;
  name: string;
  shortCode: string;
  color: string;     // Hex color code (e.g. "#F59E0B")
  startTime: string; // "HH:mm" (24h)
  endTime: string;   // "HH:mm" (24h)
  wakeTime: string;  // "HH:mm"
  sleepTime: string; // "HH:mm"
  isOffDay: boolean;
  crossesMidnight: boolean;
  routine: DailyRoutine;
}

export type ShiftOverrideType = 'swap' | 'leave' | 'overtime' | 'holiday';

export interface ShiftOverride {
  date: string; // "YYYY-MM-DD"
  shiftTypeId: string;
  overrideType: ShiftOverrideType;
  notes?: string;
  createdAt: number;
}

export interface RotationCycleStep {
  shiftTypeId: string;
  count: number; // e.g. 5 days of Morning
}

export interface ShiftConfig {
  isEnabled: boolean; // OFF by default as per specification
  workMode: 'fixed' | 'rotating';
  fixedShiftTypeId: string;
  cycleStartDate: string; // "YYYY-MM-DD"
  rotationPattern: RotationCycleStep[];
  customShiftTypes: ShiftType[];
  overrides: Record<string, ShiftOverride>; // key: "YYYY-MM-DD"
  eveningNotificationTime: string; // "20:00"
  updatedAt: number;
}

export interface DayShiftAssignment {
  date: string; // "YYYY-MM-DD"
  shiftType: ShiftType;
  isOverride: boolean;
  overrideDetails?: ShiftOverride;
  routine: DailyRoutine;
}

/**
 * Checks whether a shift's working hours cross midnight.
 * e.g. 22:00 to 06:00 -> true
 * e.g. 06:00 to 14:00 -> false
 */
export function isShiftCrossingMidnight(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const startMin = timeStringToMinutes(startTime);
  const endMin = timeStringToMinutes(endTime);
  return endMin < startMin;
}

/**
 * Standard built-in default shift types.
 */
export const DEFAULT_SHIFT_TYPES: ShiftType[] = [
  {
    id: 'shift_morning',
    name: 'Morning Shift',
    shortCode: 'M',
    color: '#F59E0B', // Amber
    startTime: '06:00',
    endTime: '14:00',
    wakeTime: '05:00',
    sleepTime: '21:30',
    isOffDay: false,
    crossesMidnight: false,
    routine: {
      id: 'routine_shift_morning',
      profileId: 'default',
      name: 'Morning Shift Routine',
      wakeTime: '05:00',
      breakfastTime: '05:30',
      lunchTime: '11:30',
      dinnerTime: '18:30',
      windDownTime: '20:30',
      sleepTime: '21:30',
      exerciseTime: '15:30',
      customBlocks: [],
      updatedAt: Date.now()
    }
  },
  {
    id: 'shift_afternoon',
    name: 'Afternoon Shift',
    shortCode: 'A',
    color: '#3B82F6', // Blue
    startTime: '14:00',
    endTime: '22:00',
    wakeTime: '08:30',
    sleepTime: '00:30',
    isOffDay: false,
    crossesMidnight: false,
    routine: {
      id: 'routine_shift_afternoon',
      profileId: 'default',
      name: 'Afternoon Shift Routine',
      wakeTime: '08:30',
      breakfastTime: '09:00',
      lunchTime: '13:00',
      dinnerTime: '18:00',
      windDownTime: '23:30',
      sleepTime: '00:30',
      exerciseTime: '10:30',
      customBlocks: [],
      updatedAt: Date.now()
    }
  },
  {
    id: 'shift_night',
    name: 'Night Shift',
    shortCode: 'N',
    color: '#8B5CF6', // Purple
    startTime: '22:00',
    endTime: '06:00',
    wakeTime: '19:00',
    sleepTime: '08:30',
    isOffDay: false,
    crossesMidnight: true, // 22:00 -> 06:00 crosses midnight!
    routine: {
      id: 'routine_shift_night',
      profileId: 'default',
      name: 'Night Shift Routine',
      wakeTime: '19:00',
      breakfastTime: '20:00', // meal before night work
      lunchTime: '02:00',     // mid-shift meal
      dinnerTime: '07:30',    // meal before day sleep
      windDownTime: '08:00',
      sleepTime: '08:30',     // sleep during daytime
      exerciseTime: '17:30',
      customBlocks: [],
      updatedAt: Date.now()
    }
  },
  {
    id: 'shift_general',
    name: 'General Shift',
    shortCode: 'G',
    color: '#10B981', // Emerald
    startTime: '09:00',
    endTime: '18:00',
    wakeTime: '07:00',
    sleepTime: '23:00',
    isOffDay: false,
    crossesMidnight: false,
    routine: {
      id: 'routine_shift_general',
      profileId: 'default',
      name: 'General Shift Routine',
      wakeTime: '07:00',
      breakfastTime: '08:00',
      lunchTime: '13:00',
      dinnerTime: '20:00',
      windDownTime: '22:00',
      sleepTime: '23:00',
      exerciseTime: '06:30',
      customBlocks: [],
      updatedAt: Date.now()
    }
  },
  {
    id: 'shift_off',
    name: 'Off Day',
    shortCode: 'OFF',
    color: '#64748B', // Slate
    startTime: '',
    endTime: '',
    wakeTime: '08:30',
    sleepTime: '23:30',
    isOffDay: true,
    crossesMidnight: false,
    routine: {
      id: 'routine_shift_off',
      profileId: 'default',
      name: 'Off Day Routine',
      wakeTime: '08:30',
      breakfastTime: '09:30',
      lunchTime: '13:30',
      dinnerTime: '20:30',
      windDownTime: '22:30',
      sleepTime: '23:30',
      exerciseTime: '17:00',
      customBlocks: [],
      updatedAt: Date.now()
    }
  }
];

export const DEFAULT_ROTATION_PATTERN: RotationCycleStep[] = [
  { shiftTypeId: 'shift_morning', count: 5 },
  { shiftTypeId: 'shift_off', count: 2 },
  { shiftTypeId: 'shift_afternoon', count: 5 },
  { shiftTypeId: 'shift_off', count: 2 },
  { shiftTypeId: 'shift_night', count: 5 },
  { shiftTypeId: 'shift_off', count: 2 }
];

export function getDefaultShiftConfig(): ShiftConfig {
  const todayStr = toLocalDateString(new Date());
  return {
    isEnabled: false, // Default is strictly OFF as per specification
    workMode: 'rotating',
    fixedShiftTypeId: 'shift_general',
    cycleStartDate: todayStr,
    rotationPattern: DEFAULT_ROTATION_PATTERN,
    customShiftTypes: DEFAULT_SHIFT_TYPES,
    overrides: {},
    eveningNotificationTime: '20:00',
    updatedAt: Date.now()
  };
}

/**
 * Expands an array of RotationCycleSteps into a flat sequence of shiftTypeIds.
 * Example: [{ shiftTypeId: 'A', count: 2 }, { shiftTypeId: 'B', count: 1 }] -> ['A', 'A', 'B']
 */
export function flattenRotationCycle(pattern: RotationCycleStep[]): string[] {
  const result: string[] = [];
  for (const step of pattern) {
    for (let i = 0; i < Math.max(1, step.count); i++) {
      result.push(step.shiftTypeId);
    }
  }
  return result.length > 0 ? result : ['shift_general'];
}

/**
 * Calculates calendar day difference between two "YYYY-MM-DD" date strings.
 * Result is positive if targetDateStr is after startDateStr.
 */
export function getDaysDifference(startDateStr: string, targetDateStr: string): number {
  const [sY, sM, sD] = startDateStr.split('-').map(Number);
  const [tY, tM, tD] = targetDateStr.split('-').map(Number);

  const startUtc = Date.UTC(sY, sM - 1, sD);
  const targetUtc = Date.UTC(tY, tM - 1, tD);

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((targetUtc - startUtc) / msPerDay);
}

/**
 * Adds N days to a "YYYY-MM-DD" string and returns resulting "YYYY-MM-DD".
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  return addLocalDays(dateStr, days);
}

/**
 * Resolves the active ShiftType by ID from configured shifts.
 */
export function resolveShiftType(config: ShiftConfig, shiftTypeId: string): ShiftType {
  const allShifts = config.customShiftTypes && config.customShiftTypes.length > 0
    ? config.customShiftTypes
    : DEFAULT_SHIFT_TYPES;
  const match = allShifts.find((s) => s.id === shiftTypeId);
  return match || DEFAULT_SHIFT_TYPES[0];
}

/**
 * Computes the shift assignment and daily routine for any target date ("YYYY-MM-DD").
 * Handles:
 * 1. Single date overrides (swaps, leave, overtime, holiday) without breaking rotation.
 * 2. Fixed work mode.
 * 3. Rotating shift cycles starting from cycleStartDate.
 */
export function getShiftForDate(config: ShiftConfig, targetDateStr: string): DayShiftAssignment {
  // If Shift feature is disabled, return standard daily routine
  if (!config.isEnabled) {
    const generalShift = DEFAULT_SHIFT_TYPES.find((s) => s.id === 'shift_general') || DEFAULT_SHIFT_TYPES[0];
    return {
      date: targetDateStr,
      shiftType: generalShift,
      isOverride: false,
      routine: generalShift.routine || getDefaultDailyRoutine()
    };
  }

  // Check 1: Manual single-date override
  if (config.overrides && config.overrides[targetDateStr]) {
    const override = config.overrides[targetDateStr];
    const shift = resolveShiftType(config, override.shiftTypeId);
    return {
      date: targetDateStr,
      shiftType: shift,
      isOverride: true,
      overrideDetails: override,
      routine: shift.routine || getDefaultDailyRoutine()
    };
  }

  // Check 2: Fixed schedule mode
  if (config.workMode === 'fixed') {
    const shift = resolveShiftType(config, config.fixedShiftTypeId || 'shift_general');
    return {
      date: targetDateStr,
      shiftType: shift,
      isOverride: false,
      routine: shift.routine || getDefaultDailyRoutine()
    };
  }

  // Check 3: Rotating shift cycle
  const flatCycle = flattenRotationCycle(config.rotationPattern);
  const cycleLength = flatCycle.length;
  const daysDiff = getDaysDifference(config.cycleStartDate, targetDateStr);

  // Safe modulo for positive and negative day offsets
  const cycleIndex = ((daysDiff % cycleLength) + cycleLength) % cycleLength;
  const activeShiftId = flatCycle[cycleIndex];
  const shift = resolveShiftType(config, activeShiftId);

  return {
    date: targetDateStr,
    shiftType: shift,
    isOverride: false,
    routine: shift.routine || getDefaultDailyRoutine()
  };
}

/**
 * Generates an array of day-by-day shift assignments for a future window (default 90 days).
 */
export function generateShiftCalendar(
  config: ShiftConfig,
  startDateStr: string,
  numDays: number = 90
): DayShiftAssignment[] {
  const result: DayShiftAssignment[] = [];
  for (let i = 0; i < numDays; i++) {
    const dateStr = addDaysToDateString(startDateStr, i);
    result.push(getShiftForDate(config, dateStr));
  }
  return result;
}

export interface DoseGapViolation {
  time1: number;
  time2: number;
  gapMinutes: number;
  requiredGapMinutes: number;
}

/**
 * Validates that no two consecutive medicine doses are closer than minimumGapMinutes
 * when schedules transition across shift boundary changes.
 */
export function validateShiftTransitionDoseGaps(
  doseTimestampsMs: number[],
  minGapMinutes: number
): { isSafe: boolean; violations: DoseGapViolation[] } {
  if (doseTimestampsMs.length < 2 || minGapMinutes <= 0) {
    return { isSafe: true, violations: [] };
  }

  const sorted = [...doseTimestampsMs].sort((a, b) => a - b);
  const violations: DoseGapViolation[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const t1 = sorted[i];
    const t2 = sorted[i + 1];
    const gapMinutes = Math.round((t2 - t1) / (60 * 1000));
    if (gapMinutes < minGapMinutes) {
      violations.push({
        time1: t1,
        time2: t2,
        gapMinutes,
        requiredGapMinutes: minGapMinutes
      });
    }
  }

  return {
    isSafe: violations.length === 0,
    violations
  };
}

/**
 * Detects whether tomorrow's shift type is different from today's.
 * Used for sending the evening-before transition reminder.
 */
export function detectShiftChange(
  config: ShiftConfig,
  todayDateStr: string,
  tomorrowDateStr: string
): { changed: boolean; previousShift: ShiftType; nextShift: ShiftType; message?: string } {
  const todayAssignment = getShiftForDate(config, todayDateStr);
  const tomorrowAssignment = getShiftForDate(config, tomorrowDateStr);

  const changed = todayAssignment.shiftType.id !== tomorrowAssignment.shiftType.id;
  return {
    changed,
    previousShift: todayAssignment.shiftType,
    nextShift: tomorrowAssignment.shiftType,
    message: changed
      ? `Tomorrow is ${tomorrowAssignment.shiftType.name}. Your reminders have been adjusted.`
      : undefined
  };
}

/**
 * Converts a medicine with fixed times to routine-relative timing based on a given routine.
 */
export function convertMedicineToRoutineRelative(
  med: Medicine,
  routine: DailyRoutine
): Medicine {
  if (med.scheduleType === 'routine_relative') return med;
  const targetTime = med.timesOfDay && med.timesOfDay.length > 0 ? med.timesOfDay[0] : '08:00';
  const match = findClosestRoutineAnchor(targetTime, routine);
  return {
    ...med,
    scheduleType: 'routine_relative',
    routineTiming: {
      anchor: match.anchor,
      offsetMinutes: match.offsetMinutes
    },
    updatedAt: Date.now()
  };
}

/**
 * Converts a routine-relative medicine back to fixed clock times based on a given routine.
 */
export function convertMedicineToFixedTime(
  med: Medicine,
  routine: DailyRoutine
): Medicine {
  if (med.scheduleType !== 'routine_relative' || !med.routineTiming) return med;
  const resolvedClockTime = calculateRoutineRelativeClockTime(routine, med.routineTiming);
  return {
    ...med,
    scheduleType: 'fixed_time',
    timesOfDay: [resolvedClockTime],
    routineTiming: undefined,
    updatedAt: Date.now()
  };
}
