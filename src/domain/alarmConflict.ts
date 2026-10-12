/**
 * Pure TypeScript Domain Logic for Alarm Conflict Detection.
 * Strictly NO React, React Native, or Expo imports allowed.
 */

import { AlarmItem, resolveAlarmCategory } from './alarm';

export interface ConflictingAlarmDetail {
  alarm: AlarmItem;
  differenceMinutes: number;
  differenceSeconds: number;
  isExactOverlap: boolean;
  categoryLabel: string;
}

export interface ConflictResolutionSuggestion {
  label: string;
  suggestedTimeMs: number;
  formattedTime: string;
  offsetMinutes: number;
}

export interface AlarmConflictResult {
  hasConflict: boolean;
  conflictingAlarms: ConflictingAlarmDetail[];
  windowMinutes: number;
  warningSummary: string;
  suggestions: ConflictResolutionSuggestion[];
}

/**
 * Checks if a candidate alarm trigger time falls within the conflict window
 * (default: 5 minutes) of any existing scheduled alarm.
 */
export function detectAlarmConflict(
  newAlarmTriggerMs: number,
  existingAlarms: AlarmItem[],
  windowMinutes: number = 5,
  excludeAlarmId?: string
): AlarmConflictResult {
  const windowMs = windowMinutes * 60 * 1000;
  const conflicts: ConflictingAlarmDetail[] = [];

  for (const alarm of existingAlarms) {
    if (excludeAlarmId && alarm.id === excludeAlarmId) {
      continue;
    }

    const diffMs = Math.abs(alarm.triggerTimeMs - newAlarmTriggerMs);
    if (diffMs <= windowMs) {
      const diffSecs = Math.round(diffMs / 1000);
      const diffMins = Math.round(diffMs / (60 * 1000));
      const cat = resolveAlarmCategory(alarm);

      conflicts.push({
        alarm,
        differenceMinutes: diffMins,
        differenceSeconds: diffSecs,
        isExactOverlap: diffMs === 0,
        categoryLabel: cat.label
      });
    }
  }

  // Sort conflicts with closest time first
  conflicts.sort((a, b) => a.differenceSeconds - b.differenceSeconds);

  if (conflicts.length === 0) {
    return {
      hasConflict: false,
      conflictingAlarms: [],
      windowMinutes,
      warningSummary: '',
      suggestions: []
    };
  }

  // Generate warning text
  const primary = conflicts[0];
  const primaryTimeStr = new Date(primary.alarm.triggerTimeMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const diffLabel =
    primary.differenceMinutes === 0
      ? 'at the exact same time'
      : primary.differenceMinutes === 1
      ? 'just 1 minute apart'
      : `only ${primary.differenceMinutes} minutes apart`;

  const warningSummary = `Overlaps with "${primary.alarm.title}" (${primaryTimeStr}): Scheduled ${diffLabel} (within ${windowMinutes}-min window).`;

  // Generate intelligent suggestions: Shift forward or backwards outside the conflict window
  const suggestions: ConflictResolutionSuggestion[] = [];
  const offsetSteps = [windowMinutes + 2, windowMinutes + 5, 15]; // e.g. +7m, +10m, +15m

  for (const step of offsetSteps) {
    const forwardTimeMs = newAlarmTriggerMs + step * 60 * 1000;
    // Check if forward time is clear
    const forwardConflict = existingAlarms.some(
      (a) => Math.abs(a.triggerTimeMs - forwardTimeMs) <= windowMs
    );
    if (!forwardConflict) {
      suggestions.push({
        label: `Shift +${step} min`,
        suggestedTimeMs: forwardTimeMs,
        formattedTime: new Date(forwardTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        offsetMinutes: step
      });
      break;
    }
  }

  for (const step of offsetSteps) {
    const backwardTimeMs = newAlarmTriggerMs - step * 60 * 1000;
    // Only suggest backwards if it's still in the future (at least 30 seconds from now)
    if (backwardTimeMs > Date.now() + 30 * 1000) {
      const backwardConflict = existingAlarms.some(
        (a) => Math.abs(a.triggerTimeMs - backwardTimeMs) <= windowMs
      );
      if (!backwardConflict) {
        suggestions.push({
          label: `Shift -${step} min`,
          suggestedTimeMs: backwardTimeMs,
          formattedTime: new Date(backwardTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          offsetMinutes: -step
        });
        break;
      }
    }
  }

  return {
    hasConflict: true,
    conflictingAlarms: conflicts,
    windowMinutes,
    warningSummary,
    suggestions
  };
}
