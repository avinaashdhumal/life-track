import {
  calculateSnoozeTime,
  isOccurrenceMissed,
  validateMinimumDoseGap,
  getNextUpcomingAlarms,
  AlarmItem,
  RecurringSchedule,
  ALARM_CATEGORIES,
  resolveAlarmCategory
} from '../alarm';
import {
  planRollingWindowOccurrences,
  reconcilePassedOccurrences,
  planOccurrencesForRecurringSchedule,
  ScheduleDefinition
} from '../reminderPlanner';

describe('Alarm and Reminder Domain Tests', () => {
  test('calculateSnoozeTime computes correct timestamp', () => {
    const baseTime = 1700000000000;
    const snooze10 = calculateSnoozeTime(baseTime, 10);
    expect(snooze10).toBe(baseTime + 10 * 60 * 1000);

    // Fallback for non-positive snooze
    const fallback = calculateSnoozeTime(baseTime, 0);
    expect(fallback).toBe(baseTime + 5 * 60 * 1000);
  });

  test('isOccurrenceMissed detects past grace period', () => {
    const scheduledTime = 1700000000000;
    const withinGrace = scheduledTime + 15 * 60 * 1000;
    const beyondGrace = scheduledTime + 35 * 60 * 1000;

    expect(isOccurrenceMissed(scheduledTime, withinGrace, 30 * 60 * 1000)).toBe(false);
    expect(isOccurrenceMissed(scheduledTime, beyondGrace, 30 * 60 * 1000)).toBe(true);
  });

  test('validateMinimumDoseGap enforces minimum safety gap between doses', () => {
    const dose1Time = 1700000000000;
    // 3 hours later (180 mins)
    const dose2TooSoon = dose1Time + 3 * 60 * 60 * 1000;
    // 5 hours later (300 mins)
    const dose2Safe = dose1Time + 5 * 60 * 60 * 1000;

    const minGap = 240; // 4 hours

    const resultTooSoon = validateMinimumDoseGap(dose1Time, dose2TooSoon, minGap);
    expect(resultTooSoon.isSafe).toBe(false);
    expect(resultTooSoon.differenceMinutes).toBe(180);

    const resultSafe = validateMinimumDoseGap(dose1Time, dose2Safe, minGap);
    expect(resultSafe.isSafe).toBe(true);
    expect(resultSafe.differenceMinutes).toBe(300);
  });

  test('planOccurrencesForRecurringSchedule - Daily rule', () => {
    const baseTime = new Date('2026-10-10T07:00:00Z').getTime();
    const dailySchedule: RecurringSchedule = {
      id: 'daily_bp',
      profileId: 'default',
      title: 'Blood Pressure Check',
      message: 'Log morning BP',
      channelId: 'appointments',
      style: 'full_alarm',
      recurrenceType: 'daily',
      timeOfDay: '08:00',
      snoozeIntervalMinutes: 10,
      isEnabled: true,
      createdAt: baseTime
    };

    const occurrences = planOccurrencesForRecurringSchedule(dailySchedule, baseTime, 5, 14);
    expect(occurrences.length).toBe(5);
    // Every consecutive occurrence is ~24 hours apart
    const dayMs = 24 * 60 * 60 * 1000;
    expect(occurrences[1].triggerTimeMs - occurrences[0].triggerTimeMs).toBe(dayMs);
  });

  test('planOccurrencesForRecurringSchedule - Every 2 Days rule', () => {
    const baseTime = new Date('2026-10-10T07:00:00Z').getTime();
    const every2DaysSchedule: RecurringSchedule = {
      id: 'wound_care',
      profileId: 'default',
      title: 'Dressing Change',
      message: 'Clean and inspect wound',
      channelId: 'routine',
      style: 'full_alarm',
      recurrenceType: 'every_n_days',
      intervalDays: 2,
      startDate: '2026-10-10',
      timeOfDay: '10:00',
      snoozeIntervalMinutes: 15,
      isEnabled: true,
      createdAt: baseTime
    };

    const occurrences = planOccurrencesForRecurringSchedule(every2DaysSchedule, baseTime, 4, 30);
    expect(occurrences.length).toBe(4);
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    expect(occurrences[1].triggerTimeMs - occurrences[0].triggerTimeMs).toBe(twoDaysMs);
  });

  test('planOccurrencesForRecurringSchedule - Weekly on Mon, Wed, Fri', () => {
    const baseTime = new Date('2026-10-10T07:00:00Z').getTime(); // Saturday Oct 10, 2026
    const weeklySchedule: RecurringSchedule = {
      id: 'gym_routine',
      profileId: 'default',
      title: 'Workout Session',
      message: 'Cardio & strength',
      channelId: 'exercise',
      style: 'notification',
      recurrenceType: 'weekly',
      weekdays: [1, 3, 5], // Mon, Wed, Fri
      timeOfDay: '07:30',
      snoozeIntervalMinutes: 10,
      isEnabled: true,
      createdAt: baseTime
    };

    const occurrences = planOccurrencesForRecurringSchedule(weeklySchedule, baseTime, 3, 30);
    expect(occurrences.length).toBe(3);
    for (const occ of occurrences) {
      const dayOfWeek = new Date(occ.triggerTimeMs).getDay();
      expect([1, 3, 5]).toContain(dayOfWeek);
    }
  });

  test('planOccurrencesForRecurringSchedule - Custom dates list', () => {
    const baseTime = new Date('2026-10-10T07:00:00Z').getTime();
    const customDatesSchedule: RecurringSchedule = {
      id: 'lab_tests',
      profileId: 'default',
      title: 'Blood Sample Lab Visit',
      message: 'Fasting test',
      channelId: 'appointments',
      style: 'full_alarm',
      recurrenceType: 'custom_dates',
      specificDates: ['2026-10-15', '2026-10-22', '2026-11-05'],
      timeOfDay: '08:30',
      snoozeIntervalMinutes: 20,
      isEnabled: true,
      createdAt: baseTime
    };

    const occurrences = planOccurrencesForRecurringSchedule(customDatesSchedule, baseTime, 5, 60);
    expect(occurrences.length).toBe(3);
    expect(occurrences[0].title).toBe('Blood Sample Lab Visit');
  });

  test('planOccurrencesForRecurringSchedule - Monthly on 1st of month', () => {
    const baseTime = new Date('2026-10-10T07:00:00Z').getTime();
    const monthlySchedule: RecurringSchedule = {
      id: 'monthly_audit',
      profileId: 'default',
      title: 'Monthly Specialist Review',
      message: 'Check prescription refills',
      channelId: 'medicines',
      style: 'full_alarm',
      recurrenceType: 'monthly',
      dayOfMonth: 1,
      timeOfDay: '11:00',
      snoozeIntervalMinutes: 30,
      isEnabled: true,
      createdAt: baseTime
    };

    const occurrences = planOccurrencesForRecurringSchedule(monthlySchedule, baseTime, 3, 180);
    expect(occurrences.length).toBe(3);
    // Should be Nov 1, Dec 1, Jan 1
    const firstDate = new Date(occurrences[0].triggerTimeMs);
    expect(firstDate.getDate()).toBe(1);
    expect(firstDate.getMonth()).toBe(10); // November (0-indexed: 10)
  });

  test('reconcilePassedOccurrences flags unacknowledged alarms as missed', () => {
    const now = 1700000000000;
    const alarms: AlarmItem[] = [
      {
        id: 'alarm_1',
        profileId: 'p1',
        title: 'Morning Meds',
        message: 'Take 1 pill',
        channelId: 'medicines',
        style: 'full_alarm',
        triggerTimeMs: now - 60 * 60 * 1000, // 1 hour ago
        snoozeIntervalMinutes: 10
      },
      {
        id: 'alarm_2',
        profileId: 'p1',
        title: 'Lunch Meds',
        message: 'Take with food',
        channelId: 'medicines',
        style: 'full_alarm',
        triggerTimeMs: now + 60 * 60 * 1000, // in 1 hour
        snoozeIntervalMinutes: 10
      }
    ];

    const loggedEvents = new Set<string>(); // none logged
    const { missedAlarmIds } = reconcilePassedOccurrences(alarms, loggedEvents, now, 30 * 60 * 1000);

    expect(missedAlarmIds).toContain('alarm_1');
    expect(missedAlarmIds).not.toContain('alarm_2');
  });

  test('category system assigns unique colors and resolves correctly', () => {
    // Unique colors for each category
    const colors = Object.values(ALARM_CATEGORIES).map((c) => c.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(colors.length);

    // Direct category resolution
    const medCat = resolveAlarmCategory({ category: 'medicine' });
    expect(medCat.id).toBe('medicine');
    expect(medCat.color).toBe('#F43F5E');

    // Channel fallback resolution
    const exerciseCat = resolveAlarmCategory({ channelId: 'exercise' });
    expect(exerciseCat.id).toBe('exercise');
    expect(exerciseCat.color).toBe('#10B981');

    // Title inference fallback
    const bpCat = resolveAlarmCategory({ title: 'Morning BP Reading' });
    expect(bpCat.id).toBe('vitals');
    expect(bpCat.color).toBe('#14B8A6');
  });
});
