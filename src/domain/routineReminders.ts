/**
 * Pure planner for Daily Routine reminders (wake, meals, sleep… and custom blocks).
 * Each milestone sends a notification only if the user switched it on.
 * No React, React Native, storage, or native imports.
 */

import { AlarmItem, buildOccurrenceId } from './alarm';
import { DailyRoutine, RoutineAnchor } from './routine';
import { ROLLING_WINDOW_DAYS } from './reminderPlanner';
import { addLocalDays, localDateTimeToMs, toLocalDateString } from './dates';

export const ROUTINE_ALARM_KIND = 'routine';
export const ROUTINE_ALARM_PREFIX = 'routine_';

/** Milestones in day order, with the routine field that holds each one's time. */
export const ROUTINE_ANCHOR_FIELDS: { anchor: RoutineAnchor; field: keyof DailyRoutine }[] = [
  { anchor: 'wake', field: 'wakeTime' },
  { anchor: 'breakfast', field: 'breakfastTime' },
  { anchor: 'lunch', field: 'lunchTime' },
  { anchor: 'exercise', field: 'exerciseTime' },
  { anchor: 'dinner', field: 'dinnerTime' },
  { anchor: 'windDown', field: 'windDownTime' },
  { anchor: 'sleep', field: 'sleepTime' }
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** One routine item that should notify: a built-in milestone or a custom block. */
export interface RoutineReminderTarget {
  key: string; // "wake" | "block_<id>"
  time: string; // "HH:mm"
  anchor?: RoutineAnchor;
  label?: string; // custom blocks only
}

export interface RoutineReminderOptions {
  nowMs: number;
  windowDays?: number;
  /** Localized title and message for a target. */
  text: (target: RoutineReminderTarget) => { title: string; message: string };
}

/** The routine items the user turned notifications on for, with valid times. */
export function getRoutineReminderTargets(routine: DailyRoutine): RoutineReminderTarget[] {
  const enabled = new Set(routine.notifyAnchors ?? []);
  const targets: RoutineReminderTarget[] = [];
  for (const { anchor, field } of ROUTINE_ANCHOR_FIELDS) {
    const time = routine[field];
    if (enabled.has(anchor) && typeof time === 'string' && TIME_PATTERN.test(time)) {
      targets.push({ key: anchor, time, anchor });
    }
  }
  for (const block of routine.customBlocks ?? []) {
    if (block.notify && TIME_PATTERN.test(block.time)) {
      targets.push({ key: `block_${block.id}`, time: block.time, label: block.label });
    }
  }
  return targets;
}

/**
 * Notifications for the next `windowDays` days. Each carries a native repeat rule so the series
 * continues without the app being opened (same contract as medicines, see ADR-0004).
 */
export function planRoutineReminders(routine: DailyRoutine, options: RoutineReminderOptions): AlarmItem[] {
  const windowDays = options.windowDays ?? ROLLING_WINDOW_DAYS;
  const horizonEndMs = options.nowMs + windowDays * 24 * 60 * 60 * 1000;
  const today = toLocalDateString(options.nowMs);
  const result: AlarmItem[] = [];

  for (const target of getRoutineReminderTargets(routine)) {
    const { title, message } = options.text(target);
    const seriesPrefix = `${ROUTINE_ALARM_PREFIX}${target.key}`;
    const seriesSuffix = target.time.replace(':', '');
    for (let dayOffset = 0; dayOffset <= windowDays; dayOffset++) {
      const dateStr = addLocalDays(today, dayOffset);
      const triggerTimeMs = localDateTimeToMs(dateStr, target.time);
      if (triggerTimeMs <= options.nowMs || triggerTimeMs > horizonEndMs) continue;
      result.push({
        id: buildOccurrenceId(seriesPrefix, dateStr, seriesSuffix),
        category: 'reminder',
        profileId: routine.profileId || 'default',
        title,
        message,
        channelId: 'routine',
        style: 'notification',
        triggerTimeMs,
        snoozeIntervalMinutes: 10,
        payload: { kind: ROUTINE_ALARM_KIND, key: target.key },
        actions: 'info',
        repeat: { everyDays: windowDays, seriesPrefix, seriesSuffix }
      });
    }
  }

  return result.sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
}
