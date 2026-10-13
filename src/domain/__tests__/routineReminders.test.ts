import assert from 'node:assert';
import { getDefaultDailyRoutine } from '../routine';
import { planRoutineReminders, getRoutineReminderTargets, ROUTINE_ALARM_KIND } from '../routineReminders';
import { planNextInSeries } from '../reminderPlanner';
import { getDefaultShiftConfig, getShiftForDate } from '../shift';
import { planShiftChangeNotices, SHIFT_NOTICE_KIND } from '../shiftNotices';
import { addLocalDays, toLocalDateString } from '../dates';

console.log(`🧪 Starting Routine Reminder & Shift Notice Tests (TZ=${process.env.TZ || 'system'})...`);

const now = new Date(2026, 9, 13, 10, 0).getTime(); // 13 Oct 2026, 10:00 local
const text = (target: { key: string; label?: string }) => ({ title: target.label || target.key, message: 'msg' });

// 1. Nothing is sent unless the user switches it on
{
  const routine = getDefaultDailyRoutine('default');
  assert.strictEqual(getRoutineReminderTargets(routine).length, 0);
  assert.strictEqual(planRoutineReminders(routine, { nowMs: now, text }).length, 0);
  console.log('✅ Routine reminders are off by default');
}

// 2. Switched-on milestones and custom blocks get 14 days of notifications
{
  const routine = {
    ...getDefaultDailyRoutine('default'),
    notifyAnchors: ['wake' as const, 'dinner' as const],
    customBlocks: [
      { id: 'walk', label: 'Evening walk', time: '18:30', notify: true },
      { id: 'read', label: 'Reading', time: '21:00' }, // not switched on
      { id: 'bad', label: 'Broken', time: '25:99', notify: true } // invalid time is ignored
    ]
  };
  const targets = getRoutineReminderTargets(routine);
  assert.deepStrictEqual(targets.map((t) => t.key), ['wake', 'dinner', 'block_walk']);

  const alarms = planRoutineReminders(routine, { nowMs: now, text });
  assert.strictEqual(alarms.length, 3 * 14);
  const walk = alarms.find((a) => a.id.startsWith('routine_block_walk_'))!;
  assert.strictEqual(walk.title, 'Evening walk');
  assert.strictEqual(walk.style, 'notification');
  assert.strictEqual(walk.channelId, 'routine');
  assert.strictEqual(walk.actions, 'info');
  assert.strictEqual(walk.payload?.kind, ROUTINE_ALARM_KIND);
  assert.strictEqual(new Date(walk.triggerTimeMs).getHours(), 18);
  assert.strictEqual(new Date(walk.triggerTimeMs).getMinutes(), 30);
  assert.ok(alarms.every((a) => a.repeat?.everyDays === 14));
  console.log('✅ Switched-on milestones and custom blocks notify for 14 days');
}

// 3. Native roll-forward matches the next JS plan (same contract as medicines)
{
  const routine = { ...getDefaultDailyRoutine('default'), notifyAnchors: ['wake' as const, 'lunch' as const] };
  const window = planRoutineReminders(routine, { nowMs: now, text });
  const first = window[0];
  const firedAt = first.triggerTimeMs + 60_000;
  const next = planNextInSeries(first, firedAt)!;
  const ids = new Set(window.map((a) => a.id));
  assert.ok(!ids.has(next.id));
  const expected = new Set([...ids].filter((id) => id !== first.id));
  expected.add(next.id);
  const after = planRoutineReminders(routine, { nowMs: firedAt, text }).map((a) => a.id);
  assert.deepStrictEqual([...after].sort(), [...expected].sort());
  console.log('✅ Routine series roll forward consistently');
}

// 4. Changing a milestone time moves its reminders (new ids)
{
  const base = { ...getDefaultDailyRoutine('default'), notifyAnchors: ['wake' as const] };
  const at7 = planRoutineReminders(base, { nowMs: now, text });
  const at6 = planRoutineReminders({ ...base, wakeTime: '06:00' }, { nowMs: now, text });
  assert.notStrictEqual(at7[0].id, at6[0].id);
  assert.strictEqual(new Date(at6[0].triggerTimeMs).getHours(), 6);
  console.log('✅ Editing a routine time moves its reminders');
}

// 5. Shift notices: only the evening before the shift changes, and only when enabled
{
  const off = getDefaultShiftConfig(); // shifts disabled by default
  const noticeText = (shift: { name: string }) => ({ title: `Tomorrow: ${shift.name}`, message: 'm' });
  assert.strictEqual(planShiftChangeNotices(off, { nowMs: now, text: noticeText }).length, 0);

  const config = { ...getDefaultShiftConfig(), isEnabled: true, cycleStartDate: '2026-10-01' };
  const notices = planShiftChangeNotices(config, { nowMs: now, text: noticeText });
  assert.ok(notices.length > 0, 'rotating pattern has changes');
  for (const notice of notices) {
    const dateStr = toLocalDateString(notice.triggerTimeMs);
    const today = getShiftForDate(config, dateStr).shiftType.id;
    const tomorrow = getShiftForDate(config, addLocalDays(dateStr, 1)).shiftType.id;
    assert.notStrictEqual(today, tomorrow, `notice on ${dateStr} precedes a change`);
    assert.strictEqual(new Date(notice.triggerTimeMs).getHours(), 20);
    assert.strictEqual(notice.payload?.kind, SHIFT_NOTICE_KIND);
    assert.strictEqual(notice.actions, 'info');
    assert.strictEqual(notice.repeat, undefined);
  }
  // Every change within the horizon gets exactly one notice
  let changes = 0;
  for (let d = 0; d < 30; d++) {
    const dateStr = addLocalDays(toLocalDateString(now), d);
    const evening = new Date(`${dateStr}T20:00:00`).getTime();
    if (evening <= now) continue;
    if (getShiftForDate(config, dateStr).shiftType.id !== getShiftForDate(config, addLocalDays(dateStr, 1)).shiftType.id) changes++;
  }
  assert.strictEqual(notices.length, changes);

  assert.strictEqual(
    planShiftChangeNotices({ ...config, shiftChangeNotice: false }, { nowMs: now, text: noticeText }).length,
    0,
    'user can turn notices off'
  );
  const late = planShiftChangeNotices({ ...config, eveningNotificationTime: '21:30' }, { nowMs: now, text: noticeText });
  assert.ok(late.every((n) => new Date(n.triggerTimeMs).getHours() === 21 && new Date(n.triggerTimeMs).getMinutes() === 30));
  console.log('✅ Shift notices fire only before changes, respect the switch and time');
}

console.log('🎉 ALL ROUTINE REMINDER & SHIFT NOTICE TESTS PASSED!');
