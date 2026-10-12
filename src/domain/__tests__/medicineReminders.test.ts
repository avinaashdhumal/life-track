import assert from 'node:assert';
import { Medicine, MedicineSchema, getMedicineDoseTimes, generateTodayDoseSlots, DoseLogEntry } from '../medicine';
import {
  planMedicineReminders,
  handledSlotKeysFromLogs,
  medicineAlarmId,
  slotKey,
  getMedicineIdFromPayload,
  MEDICINE_ALARM_KIND
} from '../medicineReminders';
import { planNextInSeries } from '../reminderPlanner';
import { getDefaultDailyRoutine } from '../routine';
import { addLocalDays, toLocalDateString, localDateTimeToMs } from '../dates';

console.log(`🧪 Starting Medicine Reminder Tests (TZ=${process.env.TZ || 'system'})...`);

const now = new Date(2026, 9, 12, 10, 0).getTime(); // 12 Oct 2026, 10:00 local
const today = toLocalDateString(now);

const med = (overrides: Partial<Medicine>): Medicine =>
  MedicineSchema.parse({
    id: 'med_1',
    name: 'Metformin',
    strength: '500 mg',
    createdAt: now,
    updatedAt: now,
    ...overrides
  });

const text = (m: Medicine, time: string) => ({ title: `Time for ${m.name}`, message: time });
const opts = { nowMs: now, style: 'full_alarm' as const, snoozeMinutes: 10, text };

// 1. Dose times per schedule type (BUG-006: interval was ignored)
{
  assert.deepStrictEqual(getMedicineDoseTimes(med({ timesOfDay: ['20:00', '08:00'] })), ['08:00', '20:00']);
  assert.deepStrictEqual(
    getMedicineDoseTimes(med({ scheduleType: 'interval', intervalHours: 8, timesOfDay: ['06:00'] })),
    ['06:00', '14:00', '22:00']
  );
  assert.deepStrictEqual(
    getMedicineDoseTimes(med({ scheduleType: 'interval', intervalHours: 6, timesOfDay: ['08:00'] })),
    ['02:00', '08:00', '14:00', '20:00']
  );
  const routine = { ...getDefaultDailyRoutine('default'), wakeTime: '07:00' };
  assert.deepStrictEqual(
    getMedicineDoseTimes(
      med({ scheduleType: 'routine_relative', routineTiming: { anchor: 'wake', offsetMinutes: 30 } }),
      routine
    ),
    ['07:30']
  );
  assert.deepStrictEqual(getMedicineDoseTimes(med({ scheduleType: 'prn_as_needed' })), []);
  console.log('✅ Dose times for fixed, interval, routine-relative, and PRN');
}

// 2. Today slots use the same times (interval medicines show every dose)
{
  const slots = generateTodayDoseSlots(
    med({ scheduleType: 'interval', intervalHours: 8, timesOfDay: ['06:00'] }),
    today,
    []
  );
  assert.deepStrictEqual(slots.map((s) => s.scheduledTime), ['06:00', '14:00', '22:00']);
  console.log('✅ Today shows every interval dose');
}

// 3. Medicine reminders are planned (BUG-001)
{
  const alarms = planMedicineReminders(med({ timesOfDay: ['08:00', '20:00'] }), opts);
  assert.strictEqual(alarms.length, 28, 'two doses a day for 14 days');
  const first = alarms[0];
  assert.strictEqual(first.id, medicineAlarmId('med_1', today, '20:00'), 'first is tonight (08:00 already passed)');
  assert.strictEqual(first.title, 'Time for Metformin');
  assert.strictEqual(first.channelId, 'medicines');
  assert.strictEqual(getMedicineIdFromPayload(first.payload), 'med_1');
  assert.strictEqual(first.payload?.kind, MEDICINE_ALARM_KIND);
  assert.strictEqual(first.payload?.scheduledTime, '20:00');
  assert.strictEqual(first.repeat?.everyDays, 14);
  assert.strictEqual(new Date(first.triggerTimeMs).getHours(), 20);
  console.log('✅ Fixed-time medicines get 14 days of alarms with dose payloads');
}

// 4. No reminders for paused or as-needed medicines
{
  assert.strictEqual(planMedicineReminders(med({ isActive: false }), opts).length, 0);
  assert.strictEqual(planMedicineReminders(med({ scheduleType: 'prn_as_needed' }), opts).length, 0);
  console.log('✅ Paused and PRN medicines have no alarms');
}

// 5. A dose already taken gets no alarm, but its series successor is scheduled
{
  const taken: DoseLogEntry = {
    id: 'dose_x',
    profileId: 'default',
    medicineId: 'med_1',
    medicineName: 'Metformin',
    scheduledTime: '20:00',
    scheduledTimestampMs: localDateTimeToMs(today, '20:00'),
    takenTimestampMs: now,
    status: 'taken',
    quantityTaken: 1,
    createdAt: now
  };
  const handled = handledSlotKeysFromLogs([taken]);
  assert.ok(handled.has(slotKey(today, '20:00')));
  const alarms = planMedicineReminders(med({ timesOfDay: ['20:00'] }), { ...opts, handledSlotKeys: handled });
  const ids = alarms.map((a) => a.id);
  assert.ok(!ids.includes(medicineAlarmId('med_1', today, '20:00')), 'no alarm for the taken dose');
  assert.ok(ids.includes(medicineAlarmId('med_1', addLocalDays(today, 14), '20:00')), 'successor scheduled');
  assert.strictEqual(alarms.length, 14);

  const snoozedOnly = handledSlotKeysFromLogs([{ ...taken, status: 'snoozed' }]);
  assert.strictEqual(snoozedOnly.size, 0, 'snoozed does not settle a slot by default');
  assert.strictEqual(handledSlotKeysFromLogs([{ ...taken, status: 'snoozed' }], ['snoozed']).size, 1);
  console.log('✅ Taken doses are skipped without breaking the series');
}

// 6. Native roll-forward matches the next JS plan
{
  const medicine = med({ timesOfDay: ['08:00', '21:00'] });
  const window = planMedicineReminders(medicine, opts);
  const first = window[0];
  const firedAt = first.triggerTimeMs + 60_000;
  const next = planNextInSeries(first, firedAt)!;
  const ids = new Set(window.map((a) => a.id));
  assert.ok(!ids.has(next.id));
  const expected = new Set([...ids].filter((id) => id !== first.id));
  expected.add(next.id);
  const after = planMedicineReminders(medicine, { ...opts, nowMs: firedAt }).map((a) => a.id);
  assert.deepStrictEqual([...after].sort(), [...expected].sort());
  console.log('✅ Medicine series roll forward consistently');
}

// 7. Routine-relative medicines move when the routine moves
{
  const medicine = med({ scheduleType: 'routine_relative', routineTiming: { anchor: 'wake', offsetMinutes: 0 } });
  const early = planMedicineReminders(medicine, { ...opts, routine: { ...getDefaultDailyRoutine('default'), wakeTime: '06:00' } });
  const late = planMedicineReminders(medicine, { ...opts, routine: { ...getDefaultDailyRoutine('default'), wakeTime: '07:15' } });
  assert.strictEqual(new Date(early[0].triggerTimeMs).getHours(), 6);
  assert.strictEqual(new Date(late[0].triggerTimeMs).getHours(), 7);
  assert.notStrictEqual(early[0].id, late[0].id);
  console.log('✅ Routine-relative reminders follow the routine');
}

console.log('🎉 ALL MEDICINE REMINDER TESTS PASSED!');
