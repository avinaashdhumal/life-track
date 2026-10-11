/**
 * Pure TypeScript Domain Layer for Daily Routine & Routine-Relative Timing.
 * NO React, React Native, or Expo imports allowed in this folder.
 */

export type RoutineAnchor =
  | 'wake'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'sleep'
  | 'windDown'
  | 'exercise';

export interface RoutineCustomBlock {
  id: string;
  label: string;
  time: string; // "HH:mm" (24h)
}

export interface DailyRoutine {
  id: string;
  profileId: string;
  name?: string;
  wakeTime: string;      // "HH:mm" e.g. "07:00"
  sleepTime: string;     // "HH:mm" e.g. "23:00"
  breakfastTime: string; // "HH:mm" e.g. "08:30"
  lunchTime: string;     // "HH:mm" e.g. "13:00"
  dinnerTime: string;    // "HH:mm" e.g. "20:00"
  windDownTime?: string; // "HH:mm" e.g. "22:00"
  exerciseTime?: string; // "HH:mm" e.g. "18:00"
  customBlocks?: RoutineCustomBlock[];
  updatedAt: number;
}

export interface RoutineRelativeTiming {
  anchor: RoutineAnchor;
  offsetMinutes: number; // e.g. +30 for 30m after, -60 for 1h before, 0 for exactly at anchor
}

export const DEFAULT_DAILY_ROUTINE: DailyRoutine = {
  id: 'default_routine',
  profileId: 'default',
  name: 'Standard Daily Routine',
  wakeTime: '07:00',
  breakfastTime: '08:30',
  lunchTime: '13:00',
  dinnerTime: '20:00',
  windDownTime: '22:00',
  sleepTime: '23:00',
  exerciseTime: '18:00',
  customBlocks: [],
  updatedAt: Date.now()
};

/**
 * Returns a cloned default daily routine for a profile.
 */
export function getDefaultDailyRoutine(profileId: string = 'default'): DailyRoutine {
  return {
    ...DEFAULT_DAILY_ROUTINE,
    id: `routine_${profileId}`,
    profileId,
    updatedAt: Date.now()
  };
}

/**
 * Parses "HH:mm" string into minutes since midnight (0..1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return (h * 60 + m) % 1440;
}

/**
 * Converts minutes since midnight into a 24h formatted "HH:mm" string.
 */
export function minutesToTimeString(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${hStr}:${mStr}`;
}

/**
 * Resolves the clock time string ("HH:mm") of a routine anchor event.
 */
export function resolveAnchorTime(routine: DailyRoutine, anchor: RoutineAnchor): string {
  switch (anchor) {
    case 'wake':
      return routine.wakeTime || '07:00';
    case 'breakfast':
      return routine.breakfastTime || '08:30';
    case 'lunch':
      return routine.lunchTime || '13:00';
    case 'dinner':
      return routine.dinnerTime || '20:00';
    case 'sleep':
      return routine.sleepTime || '23:00';
    case 'windDown':
      return routine.windDownTime || '22:00';
    case 'exercise':
      return routine.exerciseTime || '18:00';
    default:
      return routine.wakeTime || '07:00';
  }
}

/**
 * Calculates the resulting "HH:mm" clock time given a daily routine and a relative timing rule.
 * Example: anchor="wake", offset=+30 with wake="07:00" -> "07:30"
 * Example: anchor="sleep", offset=-60 with sleep="23:00" -> "22:00"
 */
export function calculateRoutineRelativeClockTime(
  routine: DailyRoutine,
  timing: RoutineRelativeTiming
): string {
  const anchorTimeStr = resolveAnchorTime(routine, timing.anchor);
  const anchorMinutes = timeStringToMinutes(anchorTimeStr);
  const targetMinutes = anchorMinutes + timing.offsetMinutes;
  return minutesToTimeString(targetMinutes);
}

/**
 * Calculates exact unix timestamp (milliseconds) for a routine-relative reminder on a given date.
 * dateStr is "YYYY-MM-DD".
 */
export function calculateRoutineRelativeTimestamp(
  routine: DailyRoutine,
  timing: RoutineRelativeTiming,
  dateStr: string
): number {
  const clockTime = calculateRoutineRelativeClockTime(routine, timing);
  const [hStr, mStr] = clockTime.split(':');
  const targetDate = new Date(`${dateStr}T${hStr}:${mStr}:00`);
  return targetDate.getTime();
}

export interface RoutineTimelineItem {
  id: string;
  label: string;
  time: string; // "HH:mm"
  minutes: number;
  anchor: RoutineAnchor;
  iconName: string;
}

/**
 * Returns an ordered array of daily routine milestones from wake to sleep.
 */
export function getOrderedRoutineTimeline(routine: DailyRoutine): RoutineTimelineItem[] {
  const items: RoutineTimelineItem[] = [
    {
      id: 'wake',
      label: 'Wake Up',
      time: routine.wakeTime,
      minutes: timeStringToMinutes(routine.wakeTime),
      anchor: 'wake',
      iconName: 'Sun'
    },
    {
      id: 'breakfast',
      label: 'Breakfast',
      time: routine.breakfastTime,
      minutes: timeStringToMinutes(routine.breakfastTime),
      anchor: 'breakfast',
      iconName: 'Utensils'
    },
    {
      id: 'lunch',
      label: 'Lunch',
      time: routine.lunchTime,
      minutes: timeStringToMinutes(routine.lunchTime),
      anchor: 'lunch',
      iconName: 'Coffee'
    },
    ...(routine.exerciseTime
      ? [
          {
            id: 'exercise',
            label: 'Exercise / Workout',
            time: routine.exerciseTime,
            minutes: timeStringToMinutes(routine.exerciseTime),
            anchor: 'exercise' as RoutineAnchor,
            iconName: 'Dumbbell'
          }
        ]
      : []),
    {
      id: 'dinner',
      label: 'Dinner',
      time: routine.dinnerTime,
      minutes: timeStringToMinutes(routine.dinnerTime),
      anchor: 'dinner',
      iconName: 'Moon'
    },
    ...(routine.windDownTime
      ? [
          {
            id: 'windDown',
            label: 'Wind Down',
            time: routine.windDownTime,
            minutes: timeStringToMinutes(routine.windDownTime),
            anchor: 'windDown' as RoutineAnchor,
            iconName: 'Sparkles'
          }
        ]
      : []),
    {
      id: 'sleep',
      label: 'Sleep',
      time: routine.sleepTime,
      minutes: timeStringToMinutes(routine.sleepTime),
      anchor: 'sleep',
      iconName: 'Bed'
    }
  ];

  // Also include any custom blocks
  if (routine.customBlocks && routine.customBlocks.length > 0) {
    for (const block of routine.customBlocks) {
      items.push({
        id: block.id,
        label: block.label,
        time: block.time,
        minutes: timeStringToMinutes(block.time),
        anchor: 'wake', // fallback
        iconName: 'Clock'
      });
    }
  }

  // Sort chronologically by minutes from morning wake time
  return items.sort((a, b) => a.minutes - b.minutes);
}

/**
 * Finds the closest routine anchor for a given fixed clock time "HH:mm".
 * Helpful when converting fixed reminders into routine-relative reminders during Shift setup.
 */
export function findClosestRoutineAnchor(
  clockTime: string,
  routine: DailyRoutine
): { anchor: RoutineAnchor; offsetMinutes: number; differenceAbsMinutes: number } {
  const targetMinutes = timeStringToMinutes(clockTime);
  const candidates: RoutineAnchor[] = ['wake', 'breakfast', 'lunch', 'dinner', 'sleep'];

  let closestAnchor: RoutineAnchor = 'wake';
  let bestOffset = 0;
  let smallestDiff = Infinity;

  for (const anchor of candidates) {
    const anchorMin = timeStringToMinutes(resolveAnchorTime(routine, anchor));
    const offset = targetMinutes - anchorMin;
    const diffAbs = Math.abs(offset);
    if (diffAbs < smallestDiff) {
      smallestDiff = diffAbs;
      closestAnchor = anchor;
      bestOffset = offset;
    }
  }

  return {
    anchor: closestAnchor,
    offsetMinutes: bestOffset,
    differenceAbsMinutes: smallestDiff
  };
}
