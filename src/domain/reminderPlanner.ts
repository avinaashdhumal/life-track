/**
 * Pure domain planner for rolling window reminder occurrences.
 * No React or native imports.
 */

import { AlarmItem, AlarmRepeat, AlarmStyle, NotificationChannelId, RecurringSchedule, buildOccurrenceId } from './alarm';
import { DailyRoutine, calculateRoutineRelativeClockTime } from './routine';
import { toLocalDateString, toCompactDateString } from './dates';

/** Days of reminders kept scheduled ahead. The native engine rolls each series forward by this. */
export const ROLLING_WINDOW_DAYS = 14;

export interface SchedulePlanPolicy {
  /** How far ahead to plan. */
  horizonDays: number;
  /** Safety cap on occurrences per schedule. */
  maxCount: number;
  /** Native roll-forward period in days (0 = JS replans this schedule; no native repeat). */
  repeatEveryDays: number;
}

/**
 * How far ahead each recurrence type is planned, and how the native engine continues it.
 * Periodic rules (daily, weekly, every N days) plan exactly one roll period, so when occurrence D
 * fires, native schedules D + period, which is never already in the planned set. Irregular rules
 * (monthly, custom dates, once) are planned far enough ahead that they don't need native help.
 */
export function getSchedulePlanPolicy(schedule: RecurringSchedule): SchedulePlanPolicy {
  switch (schedule.recurrenceType) {
    case 'daily':
    case 'weekly':
      return { horizonDays: ROLLING_WINDOW_DAYS, maxCount: 100, repeatEveryDays: ROLLING_WINDOW_DAYS };
    case 'every_n_days': {
      const n = Math.max(1, schedule.intervalDays || 2);
      const period = n * Math.ceil(ROLLING_WINDOW_DAYS / n);
      return { horizonDays: period, maxCount: 100, repeatEveryDays: period };
    }
    case 'monthly':
      return { horizonDays: 366, maxCount: 13, repeatEveryDays: 0 };
    case 'custom_dates':
      return { horizonDays: 3 * 366, maxCount: 200, repeatEveryDays: 0 };
    case 'once':
    default:
      return { horizonDays: 10 * 366, maxCount: 1, repeatEveryDays: 0 };
  }
}

/** Plans the occurrences that should currently be scheduled for a schedule, using its policy. */
export function planScheduleWindow(
  schedule: RecurringSchedule,
  nowMs: number,
  routineResolver?: (dateStr: string) => DailyRoutine | undefined
): AlarmItem[] {
  const policy = getSchedulePlanPolicy(schedule);
  return planOccurrencesForRecurringSchedule(schedule, nowMs, policy.maxCount, policy.horizonDays, routineResolver);
}

export interface ScheduleDefinition {
  id: string;
  profileId: string;
  title: string;
  message: string;
  channelId: NotificationChannelId;
  style: AlarmStyle;
  // Clock time in "HH:mm" (24h)
  timeOfDay: string;
  // Days of week 0 (Sunday) to 6 (Saturday). Empty means every day.
  daysOfWeek?: number[];
  snoozeIntervalMinutes?: number;
  payload?: Record<string, unknown>;
  shiftTypeId?: string | null;
}

/**
 * Parses "HH:mm" string into hours and minutes integers.
 */
export function parseTimeOfDay(timeStr: string): { hours: number; minutes: number } {
  const [hStr, mStr] = (timeStr || '08:00').split(':');
  const hours = parseInt(hStr, 10) || 0;
  const minutes = parseInt(mStr, 10) || 0;
  return { hours, minutes };
}

/**
 * Resolves the effective hour and minute for a given schedule on a specific date string,
 * taking into account routine-relative offsets if configured.
 */
export function resolveScheduleTimeForDate(
  schedule: RecurringSchedule,
  dateStr: string,
  routineResolver?: (dateStr: string) => DailyRoutine | undefined
): { hours: number; minutes: number } {
  if (schedule.isRoutineRelative && schedule.routineTiming && routineResolver) {
    const routine = routineResolver(dateStr);
    if (routine) {
      const clockTime = calculateRoutineRelativeClockTime(routine, schedule.routineTiming);
      return parseTimeOfDay(clockTime);
    }
  }
  return parseTimeOfDay(schedule.timeOfDay);
}

/**
 * Calculates future alarm occurrences for a single recurring schedule.
 * Handles:
 * - 'daily': Every day at timeOfDay (or routine-relative anchor)
 * - 'weekly': Specified days of the week [0..6]
 * - 'every_n_days': Every N days starting from startDate (e.g. 2 days after)
 * - 'custom_dates': Explicit list of dates ("YYYY-MM-DD")
 * - 'monthly': Day of month (e.g. 1st or 15th) and optional selective months
 * - 'once': Single date & time
 */
export function planOccurrencesForRecurringSchedule(
  schedule: RecurringSchedule,
  startFromMs: number,
  maxCount: number = 20,
  horizonDays: number = 90,
  routineResolver?: (dateStr: string) => DailyRoutine | undefined
): AlarmItem[] {
  if (!schedule.isEnabled) return [];

  const results: AlarmItem[] = [];
  const defaultTime = parseTimeOfDay(schedule.timeOfDay);
  const { hours, minutes } = defaultTime;
  // Without a start date, anchor to creation (not "now"), so every-N-days doesn't shift phase on each replan.
  const startDateObj = schedule.startDate
    ? new Date(schedule.startDate + 'T00:00:00')
    : new Date(schedule.createdAt || startFromMs);
  const endDateMs = schedule.endDate ? new Date(schedule.endDate + 'T23:59:59').getTime() : Infinity;

  const horizonEndMs = startFromMs + horizonDays * 24 * 60 * 60 * 1000;
  const effectiveEndMs = Math.min(endDateMs, horizonEndMs);

  switch (schedule.recurrenceType) {
    case 'once': {
      const dateStr = schedule.startDate || toLocalDateString(startFromMs);
      const trigger = new Date(dateStr + 'T00:00:00');
      trigger.setHours(hours, minutes, 0, 0);
      const timeMs = trigger.getTime();
      if (timeMs > startFromMs && timeMs <= effectiveEndMs) {
        results.push(createAlarmOccurrence(schedule, timeMs, dateStr));
      }
      break;
    }

    case 'daily': {
      let cursor = new Date(startFromMs);
      cursor.setHours(hours, minutes, 0, 0);
      if (cursor.getTime() <= startFromMs) {
        cursor.setDate(cursor.getDate() + 1);
      }

      while (cursor.getTime() <= effectiveEndMs && results.length < maxCount) {
        const dateStr = toLocalDateString(cursor);
        const effectiveTime = resolveScheduleTimeForDate(schedule, dateStr, routineResolver);
        const trigger = new Date(cursor);
        trigger.setHours(effectiveTime.hours, effectiveTime.minutes, 0, 0);
        const timeMs = trigger.getTime();
        if (timeMs > startFromMs && timeMs <= effectiveEndMs) {
          results.push(createAlarmOccurrence(schedule, timeMs, dateStr));
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      break;
    }

    case 'weekly': {
      const targetDays = schedule.weekdays && schedule.weekdays.length > 0 ? schedule.weekdays : [1, 2, 3, 4, 5]; // default weekdays
      let cursor = new Date(startFromMs);
      cursor.setHours(hours, minutes, 0, 0);
      if (cursor.getTime() <= startFromMs) {
        cursor.setDate(cursor.getDate() + 1);
      }

      while (cursor.getTime() <= effectiveEndMs && results.length < maxCount) {
        if (targetDays.includes(cursor.getDay())) {
          const timeMs = cursor.getTime();
          const dateStr = toLocalDateString(cursor);
          results.push(createAlarmOccurrence(schedule, timeMs, dateStr));
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      break;
    }

    case 'every_n_days': {
      const interval = Math.max(1, schedule.intervalDays || 2);
      const baseAnchor = new Date(startDateObj);
      baseAnchor.setHours(hours, minutes, 0, 0);

      // Advance in interval steps
      let cursor = new Date(baseAnchor);
      while (cursor.getTime() <= startFromMs) {
        cursor.setDate(cursor.getDate() + interval);
      }

      while (cursor.getTime() <= effectiveEndMs && results.length < maxCount) {
        const timeMs = cursor.getTime();
        const dateStr = toLocalDateString(cursor);
        results.push(createAlarmOccurrence(schedule, timeMs, dateStr));
        cursor.setDate(cursor.getDate() + interval);
      }
      break;
    }

    case 'custom_dates': {
      if (schedule.specificDates && schedule.specificDates.length > 0) {
        const sortedDates = [...schedule.specificDates].sort();
        for (const dStr of sortedDates) {
          const dt = new Date(dStr + 'T00:00:00');
          dt.setHours(hours, minutes, 0, 0);
          const timeMs = dt.getTime();
          if (timeMs > startFromMs && timeMs <= effectiveEndMs) {
            results.push(createAlarmOccurrence(schedule, timeMs, dStr));
            if (results.length >= maxCount) break;
          }
        }
      }
      break;
    }

    case 'monthly': {
      const targetDay = Math.min(31, Math.max(1, schedule.dayOfMonth || 1));
      const targetMonths = schedule.monthsOfYear && schedule.monthsOfYear.length > 0
        ? schedule.monthsOfYear
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

      const start = new Date(startFromMs);
      let year = start.getFullYear();
      let month = start.getMonth() + 1; // 1-12

      while (results.length < maxCount) {
        if (targetMonths.includes(month)) {
          // Determine days in this specific month
          const daysInMonth = new Date(year, month, 0).getDate();
          const clampedDay = Math.min(targetDay, daysInMonth);
          const candidate = new Date(year, month - 1, clampedDay, hours, minutes, 0, 0);
          const timeMs = candidate.getTime();

          if (timeMs > startFromMs && timeMs <= effectiveEndMs) {
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${clampedDay.toString().padStart(2, '0')}`;
            results.push(createAlarmOccurrence(schedule, timeMs, dateStr));
          } else if (timeMs > effectiveEndMs) {
            break;
          }
        }

        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
        // Safety bail out after 3 years
        if (year > start.getFullYear() + 3) break;
      }
      break;
    }
  }

  return results.sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
}

function createAlarmOccurrence(schedule: RecurringSchedule, triggerTimeMs: number, dateStr: string): AlarmItem {
  const seriesSuffix = schedule.timeOfDay.replace(':', '');
  const policy = getSchedulePlanPolicy(schedule);
  const repeat: AlarmRepeat | undefined =
    policy.repeatEveryDays > 0
      ? {
          everyDays: policy.repeatEveryDays,
          untilMs: schedule.endDate ? new Date(schedule.endDate + 'T23:59:59').getTime() : undefined,
          seriesPrefix: schedule.id,
          seriesSuffix
        }
      : undefined;
  return {
    id: buildOccurrenceId(schedule.id, dateStr, seriesSuffix),
    scheduleId: schedule.id,
    category: schedule.category,
    profileId: schedule.profileId || 'default',
    title: schedule.title,
    message: schedule.message,
    channelId: schedule.channelId,
    style: schedule.style,
    triggerTimeMs,
    snoozeIntervalMinutes: schedule.snoozeIntervalMinutes || 10,
    payload: schedule.payload,
    shiftTypeId: schedule.shiftTypeId || null,
    repeat
  };
}

/**
 * Plans reminder occurrences for the next N days (default 7 days) starting from a base timestamp.
 */
export function planRollingWindowOccurrences(
  schedules: ScheduleDefinition[],
  startFromMs: number,
  daysToPlan: number = 7
): AlarmItem[] {
  const result: AlarmItem[] = [];
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (let dayOffset = 0; dayOffset < daysToPlan; dayOffset++) {
    const currentTargetDay = new Date(startFromMs + dayOffset * oneDayMs);
    const dayOfWeek = currentTargetDay.getDay();

    for (const schedule of schedules) {
      if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
        if (!schedule.daysOfWeek.includes(dayOfWeek)) {
          continue;
        }
      }

      const [hoursStr, minutesStr] = schedule.timeOfDay.split(':');
      const hours = parseInt(hoursStr, 10) || 0;
      const minutes = parseInt(minutesStr, 10) || 0;

      const triggerDate = new Date(currentTargetDay);
      triggerDate.setHours(hours, minutes, 0, 0);
      const triggerTimeMs = triggerDate.getTime();

      // Only include occurrences in the future
      if (triggerTimeMs > startFromMs) {
        result.push({
          id: `${schedule.id}_${toCompactDateString(triggerDate)}_${hoursStr}${minutesStr}`,
          profileId: schedule.profileId,
          title: schedule.title,
          message: schedule.message,
          channelId: schedule.channelId,
          style: schedule.style,
          triggerTimeMs,
          snoozeIntervalMinutes: schedule.snoozeIntervalMinutes ?? 10,
          payload: schedule.payload,
          shiftTypeId: schedule.shiftTypeId ?? null
        });
      }
    }
  }

  // Return sorted chronologically
  return result.sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
}

/**
 * Reconciles passed occurrences that had no recorded action.
 */
export function reconcilePassedOccurrences(
  scheduledAlarms: AlarmItem[],
  loggedEventAlarmIds: Set<string>,
  nowMs: number,
  gracePeriodMs: number = 30 * 60 * 1000
): { missedAlarmIds: string[] } {
  const missedAlarmIds: string[] = [];

  for (const alarm of scheduledAlarms) {
    if (alarm.triggerTimeMs + gracePeriodMs < nowMs && !loggedEventAlarmIds.has(alarm.id)) {
      missedAlarmIds.push(alarm.id);
    }
  }

  return { missedAlarmIds };
}

/**
 * JS twin of the native `AlarmSchedulerHelper.scheduleNextInSeries`: the occurrence that should be
 * scheduled after `alarm` fires, or null if it doesn't repeat or the series has ended.
 * Used by the in-app engine (web / no native module) so both behave the same.
 */
export function planNextInSeries(alarm: AlarmItem, nowMs: number): AlarmItem | null {
  const repeat = alarm.repeat;
  if (!repeat || repeat.everyDays <= 0 || !repeat.seriesPrefix) return null;

  const next = new Date(alarm.triggerTimeMs);
  do {
    next.setDate(next.getDate() + repeat.everyDays);
  } while (next.getTime() <= nowMs);

  if (repeat.untilMs && next.getTime() > repeat.untilMs) return null;

  return {
    ...alarm,
    id: buildOccurrenceId(repeat.seriesPrefix, toLocalDateString(next), repeat.seriesSuffix),
    triggerTimeMs: next.getTime()
  };
}
