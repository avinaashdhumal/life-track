/**
 * Pure TypeScript Domain Layer for Alarms and Reminders.
 * NO React, React Native, or Expo imports allowed in this folder.
 */

export type AlarmStyle = 'full_alarm' | 'notification';

export type NotificationChannelId =
  | 'medicines'
  | 'appointments'
  | 'routine'
  | 'exercise'
  | 'water_meals'
  | 'habits'
  | 'summaries';

export type ReminderActionType =
  | 'SCHEDULED'
  | 'FIRED'
  | 'TAKEN'
  | 'SNOOZED'
  | 'SKIPPED'
  | 'MISSED'
  | 'DISMISSED';

export type AlarmCategory =
  | 'medicine'
  | 'exercise'
  | 'reminder'
  | 'appointment'
  | 'hydration'
  | 'habit'
  | 'vitals';

export interface CategoryDefinition {
  id: AlarmCategory;
  label: string;
  description: string;
  color: string; // Hex color used by charts & badges
  bgClass: string;
  textClass: string;
  borderClass: string;
  iconName: string;
  defaultChannel: NotificationChannelId;
  defaultStyle: AlarmStyle;
}

export const ALARM_CATEGORIES: Record<AlarmCategory, CategoryDefinition> = {
  medicine: {
    id: 'medicine',
    label: 'Medicine',
    description: 'Prescriptions, pills, tablets, and doses',
    color: '#F43F5E', // Rose 500
    bgClass: 'bg-rose-500/10',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
    iconName: 'Pill',
    defaultChannel: 'medicines',
    defaultStyle: 'full_alarm'
  },
  exercise: {
    id: 'exercise',
    label: 'Exercise',
    description: 'Workouts, yoga, cardio, and pranayama',
    color: '#10B981', // Emerald 500
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    iconName: 'Dumbbell',
    defaultChannel: 'exercise',
    defaultStyle: 'notification'
  },
  reminder: {
    id: 'reminder',
    label: 'Reminder',
    description: 'General daily tasks, routine, and milestones',
    color: '#F59E0B', // Amber 500
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    iconName: 'Bell',
    defaultChannel: 'routine',
    defaultStyle: 'notification'
  },
  appointment: {
    id: 'appointment',
    label: 'Appointment',
    description: 'Doctor consultations, clinic visits, and lab tests',
    color: '#6366F1', // Indigo 500
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/30',
    iconName: 'Calendar',
    defaultChannel: 'appointments',
    defaultStyle: 'full_alarm'
  },
  hydration: {
    id: 'hydration',
    label: 'Hydration & Food',
    description: 'Water drinking intervals and meal timings',
    color: '#06B6D4', // Cyan 500
    bgClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/30',
    iconName: 'Droplet',
    defaultChannel: 'water_meals',
    defaultStyle: 'notification'
  },
  habit: {
    id: 'habit',
    label: 'Habit',
    description: 'Daily habit check-ins and streaks',
    color: '#8B5CF6', // Purple 500
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
    iconName: 'Sparkles',
    defaultChannel: 'habits',
    defaultStyle: 'notification'
  },
  vitals: {
    id: 'vitals',
    label: 'Vitals & BP',
    description: 'Blood pressure, glucose, weight, and pulse checks',
    color: '#14B8A6', // Teal 500
    bgClass: 'bg-teal-500/10',
    textClass: 'text-teal-400',
    borderClass: 'border-teal-500/30',
    iconName: 'Activity',
    defaultChannel: 'appointments',
    defaultStyle: 'notification'
  }
};

/**
 * Resolves category for an alarm or schedule, with automatic inference fallback.
 */
export function resolveAlarmCategory(item: {
  category?: AlarmCategory;
  channelId?: NotificationChannelId;
  title?: string;
}): CategoryDefinition {
  if (item.category && ALARM_CATEGORIES[item.category]) {
    return ALARM_CATEGORIES[item.category];
  }
  if (item.channelId === 'medicines') return ALARM_CATEGORIES.medicine;
  if (item.channelId === 'exercise') return ALARM_CATEGORIES.exercise;
  if (item.channelId === 'appointments') return ALARM_CATEGORIES.appointment;
  if (item.channelId === 'water_meals') return ALARM_CATEGORIES.hydration;
  if (item.channelId === 'habits') return ALARM_CATEGORIES.habit;

  const titleLower = (item.title || '').toLowerCase();
  if (titleLower.includes('bp') || titleLower.includes('sugar') || titleLower.includes('pressure') || titleLower.includes('vital')) {
    return ALARM_CATEGORIES.vitals;
  }
  if (titleLower.includes('water') || titleLower.includes('lunch') || titleLower.includes('dinner') || titleLower.includes('breakfast')) {
    return ALARM_CATEGORIES.hydration;
  }
  if (titleLower.includes('workout') || titleLower.includes('yoga') || titleLower.includes('gym')) {
    return ALARM_CATEGORIES.exercise;
  }
  if (titleLower.includes('pill') || titleLower.includes('dose') || titleLower.includes('mg') || titleLower.includes('tablet')) {
    return ALARM_CATEGORIES.medicine;
  }

  return ALARM_CATEGORIES.reminder;
}

export type RecurrenceType =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'every_n_days'
  | 'custom_dates'
  | 'monthly';

export interface RecurringSchedule {
  id: string;
  profileId: string;
  category?: AlarmCategory;
  title: string;
  message: string;
  channelId: NotificationChannelId;
  style: AlarmStyle;
  recurrenceType: RecurrenceType;
  timeOfDay: string; // "HH:mm" (24h)
  weekdays?: number[]; // [0..6] (0=Sun, 1=Mon, ..., 6=Sat)
  intervalDays?: number; // e.g. 2 for every 2 days
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string; // "YYYY-MM-DD" optional cutoff
  dayOfMonth?: number; // 1..31
  monthsOfYear?: number[]; // [1..12] for selective months
  specificDates?: string[]; // ["2026-10-15", "2026-10-20"]
  snoozeIntervalMinutes: number;
  isEnabled: boolean;
  createdAt: number;
  payload?: Record<string, unknown>;
  shiftTypeId?: string | null;
}

export interface AlarmItem {
  id: string;
  scheduleId?: string;
  category?: AlarmCategory;
  profileId: string;
  title: string;
  message: string;
  channelId: NotificationChannelId;
  style: AlarmStyle;
  triggerTimeMs: number;
  snoozeIntervalMinutes: number;
  maxRepeats?: number;
  currentRepeatCount?: number;
  shiftTypeId?: string | null;
  payload?: Record<string, unknown>;
}

export interface ReminderLogEntry {
  id: string;
  profileId: string;
  alarmId: string;
  action: ReminderActionType;
  timestampMs: number;
  scheduledTimeMs: number;
  shiftTypeId?: string | null;
  note?: string;
}

export interface ChannelToneInfo {
  id: NotificationChannelId;
  name: string;
  description: string;
  importance: number;
  soundUri: string;
  hasCustomSound: boolean;
}

export interface HealthCheckStatus {
  exactAlarmsAllowed: boolean;
  notificationsAllowed: boolean;
  batteryOptimizationsIgnored: boolean;
  manufacturer: string;
  scheduledCount: number;
  nextScheduledTimeMs?: number;
  foregroundServiceActive?: boolean;
  notificationChannelsCount?: number;
  lastFiredAlarm?: {
    id: string;
    title: string;
    firedAtMs: number;
  } | null;
}

/**
 * Calculates a future snooze timestamp from current time and snooze interval.
 */
export function calculateSnoozeTime(currentMs: number, snoozeMinutes: number): number {
  if (snoozeMinutes <= 0) return currentMs + 5 * 60 * 1000;
  return currentMs + snoozeMinutes * 60 * 1000;
}

/**
 * Evaluates whether an unacknowledged reminder should be marked as missed.
 * Default grace period is 30 minutes after scheduled time.
 */
export function isOccurrenceMissed(
  scheduledTimeMs: number,
  nowMs: number,
  gracePeriodMs: number = 30 * 60 * 1000
): boolean {
  return nowMs > scheduledTimeMs + gracePeriodMs;
}

/**
 * Validates minimum dose gap between two doses of the same medicine.
 * Returns true if safe, false if the new dose is scheduled too close to previous dose.
 */
export function validateMinimumDoseGap(
  previousDoseTimeMs: number,
  newDoseTimeMs: number,
  minimumGapMinutes: number
): { isSafe: boolean; differenceMinutes: number; requiredGapMinutes: number } {
  const diffMinutes = Math.abs(newDoseTimeMs - previousDoseTimeMs) / (60 * 1000);
  return {
    isSafe: diffMinutes >= minimumGapMinutes,
    differenceMinutes: Math.round(diffMinutes),
    requiredGapMinutes: minimumGapMinutes
  };
}

/**
 * Filters the upcoming scheduled alarms, sorts by trigger time, and returns the next N alarms.
 */
export function getNextUpcomingAlarms(alarms: AlarmItem[], limit: number = 10): AlarmItem[] {
  const now = Date.now();
  return alarms
    .filter((a) => a.triggerTimeMs >= now)
    .sort((a, b) => a.triggerTimeMs - b.triggerTimeMs)
    .slice(0, limit);
}
