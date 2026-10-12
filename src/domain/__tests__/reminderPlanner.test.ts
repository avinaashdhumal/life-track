import assert from 'node:assert';
import { RecurringSchedule, AlarmItem, buildOccurrenceId, snoozeAlarmId, isSnoozeAlarmId } from '../alarm';
import {
  planScheduleWindow,
  planNextInSeries,
  getSchedulePlanPolicy,
  ROLLING_WINDOW_DAYS
} from '../reminderPlanner';
import { toLocalDateString, toCompactDateString, addLocalDays, localDateTimeToMs } from '../dates';

console.log(`🧪 Starting Reminder Planner & Date Tests (TZ=${process.env.TZ || 'system'})...`);

const baseSchedule = (overrides: Partial<RecurringSchedule>): RecurringSchedule => ({
  id: 'rec_test',
  profileId: 'default',
  title: 'Test',
  message: 'Msg',
  channelId: 'medicines',
  style: 'full_alarm',
  recurrenceType: 'daily',
  timeOfDay: '08:00',
  snoozeIntervalMinutes: 10,
  isEnabled: true,
  createdAt: new Date(2026, 0, 1).getTime(),
  ...overrides
});

/**
 * The contract between the JS planner and the native roll-forward: after the first occurrence
 * fires and native schedules its successor, a fresh JS plan must contain exactly the same ids.
 * Otherwise every app start would add duplicates or cancel valid alarms.
 */
function assertRollConsistent(schedule: RecurringSchedule, nowMs: number) {
  const window = planScheduleWindow(schedule, nowMs);
  assert.ok(window.length > 0, 'window not empty');
  const first = window[0];
  const firedAt = first.triggerTimeMs + 60_000;
  const next = planNextInSeries(first, firedAt);
  assert.ok(next, 'periodic schedule rolls forward');
  const ids = new Set(window.map((a) => a.id));
  assert.ok(!ids.has(next!.id), 'rolled occurrence is new');
  const expected = new Set([...ids].filter((id) => id !== first.id));
  expected.add(next!.id);
  const after = new Set(planScheduleWindow(schedule, firedAt).map((a) => a.id));
  assert.deepStrictEqual([...after].sort(), [...expected].sort());
}

// 1. Local dates, not UTC (BUG-008): 03:00 local is the previous day in UTC for UTC+ zones
{
  const early = new Date(2026, 9, 13, 3, 0, 0);
  assert.strictEqual(toLocalDateString(early), '2026-10-13');
  assert.strictEqual(toCompactDateString(early), '20261013');
  assert.strictEqual(addLocalDays('2026-10-31', 1), '2026-11-01');
  assert.strictEqual(addLocalDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(new Date(localDateTimeToMs('2026-10-13', '03:00')).getHours(), 3);
  console.log('✅ Local date helpers use local time');
}

// 2. Occurrence ids use the local date of the trigger (shared format with native)
{
  const nowMs = new Date(2026, 9, 12, 10, 0).getTime();
  const window = planScheduleWindow(baseSchedule({ timeOfDay: '03:00' }), nowMs);
  for (const occ of window) {
    assert.strictEqual(occ.id, buildOccurrenceId('rec_test', toLocalDateString(occ.triggerTimeMs), '0300'));
    assert.strictEqual(new Date(occ.triggerTimeMs).getHours(), 3);
  }
  console.log('✅ Early-morning occurrence ids carry the local date');
}

// 3. Daily: exactly one roll period (14 occurrences), with native repeat metadata (BUG-009: was 5)
{
  const nowMs = new Date(2026, 9, 12, 10, 0).getTime();
  const window = planScheduleWindow(baseSchedule({}), nowMs);
  assert.strictEqual(window.length, ROLLING_WINDOW_DAYS);
  assert.deepStrictEqual(window[0].repeat, {
    everyDays: ROLLING_WINDOW_DAYS,
    untilMs: undefined,
    seriesPrefix: 'rec_test',
    seriesSuffix: '0800'
  });
  assertRollConsistent(baseSchedule({}), nowMs);
  assertRollConsistent(baseSchedule({ timeOfDay: '23:30' }), nowMs);
  console.log('✅ Daily schedules plan 14 days and roll forward consistently');
}

// 4. Weekly and every-N-days roll consistently
{
  const nowMs = new Date(2026, 9, 12, 10, 0).getTime();
  const weekly = baseSchedule({ recurrenceType: 'weekly', weekdays: [1, 3, 5] });
  assert.strictEqual(planScheduleWindow(weekly, nowMs).length, 6);
  assertRollConsistent(weekly, nowMs);

  const everyThree = baseSchedule({ recurrenceType: 'every_n_days', intervalDays: 3, startDate: '2026-10-01' });
  assert.strictEqual(getSchedulePlanPolicy(everyThree).repeatEveryDays, 15);
  assertRollConsistent(everyThree, nowMs);
  console.log('✅ Weekly and every-N-days schedules roll forward consistently');
}

// 5. Every-N-days without a start date keeps its phase across replans
{
  const schedule = baseSchedule({ recurrenceType: 'every_n_days', intervalDays: 2, startDate: undefined });
  const day1 = planScheduleWindow(schedule, new Date(2026, 9, 12, 10, 0).getTime()).map((a) => a.id);
  const day2 = planScheduleWindow(schedule, new Date(2026, 9, 13, 10, 0).getTime()).map((a) => a.id);
  // Every id planned on day 2 that falls inside day 1's window must also be in day 1's plan.
  const overlap = day2.filter((id) => id <= day1[day1.length - 1]);
  assert.ok(overlap.every((id) => day1.includes(id)), 'phase is stable');
  console.log('✅ Every-N-days phase does not drift between replans');
}

// 6. End date stops the native series
{
  const nowMs = new Date(2026, 9, 12, 10, 0).getTime();
  const schedule = baseSchedule({ endDate: '2026-10-20' });
  const window = planScheduleWindow(schedule, nowMs);
  assert.ok(window.every((a) => a.triggerTimeMs <= new Date('2026-10-20T23:59:59').getTime()));
  const last = window[window.length - 1];
  assert.strictEqual(planNextInSeries(last, last.triggerTimeMs + 1000), null);
  console.log('✅ End date caps planning and native roll-forward');
}

// 7. Irregular rules are planned far ahead and never roll natively
{
  const nowMs = new Date(2026, 9, 12, 10, 0).getTime();
  const monthly = planScheduleWindow(baseSchedule({ recurrenceType: 'monthly', dayOfMonth: 31 }), nowMs);
  assert.ok(monthly.length >= 12, 'a year of monthly reminders');
  assert.ok(monthly.every((a) => a.repeat === undefined));
  // Day 31 clamps to the month's last day
  assert.ok(monthly.some((a) => new Date(a.triggerTimeMs).getMonth() === 10 && new Date(a.triggerTimeMs).getDate() === 30));

  const custom = planScheduleWindow(
    baseSchedule({ recurrenceType: 'custom_dates', specificDates: ['2026-12-25', '2027-03-01'] }),
    nowMs
  );
  assert.strictEqual(custom.length, 2);
  assert.ok(custom.every((a) => a.repeat === undefined));
  console.log('✅ Monthly and custom-date schedules plan ahead without native repeat');
}

// 8. Daylight saving: wall-clock time is kept across the change (meaningful under America/New_York)
{
  const nowMs = new Date(2026, 9, 25, 10, 0).getTime(); // window crosses Nov 1
  const window = planScheduleWindow(baseSchedule({}), nowMs);
  assert.ok(window.every((a) => new Date(a.triggerTimeMs).getHours() === 8 && new Date(a.triggerTimeMs).getMinutes() === 0));
  const next = planNextInSeries(window[0], window[0].triggerTimeMs + 1000)!;
  assert.strictEqual(new Date(next.triggerTimeMs).getHours(), 8);
  console.log('✅ Occurrences keep 08:00 local across daylight-saving changes');
}

// 9. Snooze ids don't grow on repeated snoozes
{
  const snoozed = snoozeAlarmId('rec_test_20261012_0800');
  assert.strictEqual(snoozed, 'rec_test_20261012_0800_snooze');
  assert.strictEqual(snoozeAlarmId(snoozed), snoozed);
  assert.ok(isSnoozeAlarmId(snoozed));
  const notRepeating: AlarmItem = { ...planScheduleWindow(baseSchedule({}), Date.now())[0], repeat: undefined };
  assert.strictEqual(planNextInSeries(notRepeating, Date.now()), null);
  console.log('✅ Snooze ids are stable and one-off alarms never roll');
}

console.log('🎉 ALL REMINDER PLANNER TESTS PASSED!');
