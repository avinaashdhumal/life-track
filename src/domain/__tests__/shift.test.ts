import assert from 'node:assert';
import {
  isShiftCrossingMidnight,
  flattenRotationCycle,
  getDaysDifference,
  getShiftForDate,
  generateShiftCalendar,
  validateShiftTransitionDoseGaps,
  detectShiftChange,
  getDefaultShiftConfig,
  DEFAULT_SHIFT_TYPES,
  ShiftConfig,
  convertMedicineToRoutineRelative,
  convertMedicineToFixedTime
} from '../shift';
import {
  calculateRoutineRelativeClockTime,
  calculateRoutineRelativeTimestamp,
  resolveAnchorTime,
  getOrderedRoutineTimeline,
  findClosestRoutineAnchor,
  getDefaultDailyRoutine
} from '../routine';
import { Medicine, MedicineSchema } from '../medicine';

console.log('🧪 Starting LifeTrack Shift & Daily Routine Domain Unit Tests...');

// 1. Midnight Crossing Detection
{
  assert.strictEqual(isShiftCrossingMidnight('22:00', '06:00'), true);
  assert.strictEqual(isShiftCrossingMidnight('20:00', '04:00'), true);
  assert.strictEqual(isShiftCrossingMidnight('06:00', '14:00'), false);
  assert.strictEqual(isShiftCrossingMidnight('09:00', '18:00'), false);
  console.log('✅ Midnight crossing detection verified');
}

// 2. Rotation Cycle Pattern Flattening
{
  const pattern = [
    { shiftTypeId: 'shift_morning', count: 3 },
    { shiftTypeId: 'shift_off', count: 2 }
  ];
  const flat = flattenRotationCycle(pattern);
  assert.strictEqual(flat.length, 5);
  assert.deepStrictEqual(flat, [
    'shift_morning',
    'shift_morning',
    'shift_morning',
    'shift_off',
    'shift_off'
  ]);
  console.log('✅ Rotation cycle pattern flattening verified');
}

// 3. Days Difference Calculation
{
  assert.strictEqual(getDaysDifference('2026-10-10', '2026-10-10'), 0);
  assert.strictEqual(getDaysDifference('2026-10-10', '2026-10-15'), 5);
  assert.strictEqual(getDaysDifference('2026-10-15', '2026-10-10'), -5);
  assert.strictEqual(getDaysDifference('2026-10-31', '2026-11-01'), 1);
  console.log('✅ Days difference calculation verified');
}

// 4. Rotating Shift Calculation across Cycle
{
  const config: ShiftConfig = {
    ...getDefaultShiftConfig(),
    isEnabled: true,
    workMode: 'rotating',
    cycleStartDate: '2026-10-10',
    rotationPattern: [
      { shiftTypeId: 'shift_morning', count: 2 },
      { shiftTypeId: 'shift_off', count: 1 }
    ]
  };

  // Day 0: Morning
  const day0 = getShiftForDate(config, '2026-10-10');
  assert.strictEqual(day0.shiftType.id, 'shift_morning');
  assert.strictEqual(day0.isOverride, false);

  // Day 1: Morning
  const day1 = getShiftForDate(config, '2026-10-11');
  assert.strictEqual(day1.shiftType.id, 'shift_morning');

  // Day 2: Off
  const day2 = getShiftForDate(config, '2026-10-12');
  assert.strictEqual(day2.shiftType.id, 'shift_off');
  assert.strictEqual(day2.shiftType.isOffDay, true);

  // Day 3: Morning (Cycle repeats)
  const day3 = getShiftForDate(config, '2026-10-13');
  assert.strictEqual(day3.shiftType.id, 'shift_morning');
  console.log('✅ Rotating shift calculation across cycles verified');
}

// 5. Manual Single-Date Override without Breaking Rotation
{
  const config: ShiftConfig = {
    ...getDefaultShiftConfig(),
    isEnabled: true,
    workMode: 'rotating',
    cycleStartDate: '2026-10-10',
    rotationPattern: [
      { shiftTypeId: 'shift_morning', count: 2 },
      { shiftTypeId: 'shift_off', count: 1 }
    ],
    overrides: {
      '2026-10-11': {
        date: '2026-10-11',
        shiftTypeId: 'shift_night',
        overrideType: 'swap',
        notes: 'Swapped shift with colleague',
        createdAt: Date.now()
      }
    }
  };

  // Normal day 0
  assert.strictEqual(getShiftForDate(config, '2026-10-10').shiftType.id, 'shift_morning');

  // Overridden day 1: Night Shift
  const overridden = getShiftForDate(config, '2026-10-11');
  assert.strictEqual(overridden.shiftType.id, 'shift_night');
  assert.strictEqual(overridden.isOverride, true);
  assert.strictEqual(overridden.overrideDetails?.overrideType, 'swap');

  // Day 2 returns to regular cycle schedule (Off)
  const day2 = getShiftForDate(config, '2026-10-12');
  assert.strictEqual(day2.shiftType.id, 'shift_off');
  assert.strictEqual(day2.isOverride, false);
  console.log('✅ Single-date manual override verified');
}

// 6. Fixed Work Mode
{
  const config: ShiftConfig = {
    ...getDefaultShiftConfig(),
    isEnabled: true,
    workMode: 'fixed',
    fixedShiftTypeId: 'shift_afternoon'
  };

  assert.strictEqual(getShiftForDate(config, '2026-10-10').shiftType.id, 'shift_afternoon');
  assert.strictEqual(getShiftForDate(config, '2026-10-25').shiftType.id, 'shift_afternoon');
  console.log('✅ Fixed work mode verified');
}

// 7. 90-Day Shift Calendar Generation
{
  const config: ShiftConfig = {
    ...getDefaultShiftConfig(),
    isEnabled: true
  };
  const calendar = generateShiftCalendar(config, '2026-10-10', 90);
  assert.strictEqual(calendar.length, 90);
  assert.strictEqual(calendar[0].date, '2026-10-10');
  assert.strictEqual(calendar[89].date, '2027-01-07');
  for (const entry of calendar) {
    assert.ok(entry.shiftType.id);
    assert.ok(entry.routine.wakeTime);
  }
  console.log('✅ 90-day shift calendar generation verified');
}

// 8. Dose Gap Safety during Shift Transition
{
  const baseTime = 1700000000000;
  const minGapMinutes = 240; // 4 hours

  // Two doses spaced 3 hours apart (unsafe!)
  const unsafeDoses = [baseTime, baseTime + 180 * 60 * 1000];
  const unsafeCheck = validateShiftTransitionDoseGaps(unsafeDoses, minGapMinutes);
  assert.strictEqual(unsafeCheck.isSafe, false);
  assert.strictEqual(unsafeCheck.violations.length, 1);
  assert.strictEqual(unsafeCheck.violations[0].gapMinutes, 180);

  // Two doses spaced 5 hours apart (safe)
  const safeDoses = [baseTime, baseTime + 300 * 60 * 1000];
  const safeCheck = validateShiftTransitionDoseGaps(safeDoses, minGapMinutes);
  assert.strictEqual(safeCheck.isSafe, true);
  assert.strictEqual(safeCheck.violations.length, 0);
  console.log('✅ Dose gap safety during shift transition verified');
}

// 9. Shift Change Evening Notification Detection
{
  const config: ShiftConfig = {
    ...getDefaultShiftConfig(),
    isEnabled: true,
    workMode: 'rotating',
    cycleStartDate: '2026-10-10',
    rotationPattern: [
      { shiftTypeId: 'shift_morning', count: 1 },
      { shiftTypeId: 'shift_night', count: 1 }
    ]
  };

  const transition = detectShiftChange(config, '2026-10-10', '2026-10-11');
  assert.strictEqual(transition.changed, true);
  assert.strictEqual(transition.previousShift.id, 'shift_morning');
  assert.strictEqual(transition.nextShift.id, 'shift_night');
  assert.ok(transition.message?.includes('Tomorrow is Night Shift'));
  console.log('✅ Shift change notification detection verified');
}

// 10. Routine-Relative Timing Calculations
{
  const routine = getDefaultDailyRoutine(); // wake: 07:00, breakfast: 08:30, lunch: 13:00, dinner: 20:00, sleep: 23:00

  // 30 mins after wake up -> 07:30
  const afterWake = calculateRoutineRelativeClockTime(routine, { anchor: 'wake', offsetMinutes: 30 });
  assert.strictEqual(afterWake, '07:30');

  // With lunch -> 13:00
  const withLunch = calculateRoutineRelativeClockTime(routine, { anchor: 'lunch', offsetMinutes: 0 });
  assert.strictEqual(withLunch, '13:00');

  // 1 hour before sleep -> 22:00
  const beforeSleep = calculateRoutineRelativeClockTime(routine, { anchor: 'sleep', offsetMinutes: -60 });
  assert.strictEqual(beforeSleep, '22:00');

  // Closest anchor finder
  const closest = findClosestRoutineAnchor('07:15', routine);
  assert.strictEqual(closest.anchor, 'wake');
  assert.strictEqual(closest.offsetMinutes, 15);

  // Timeline ordering
  const timeline = getOrderedRoutineTimeline(routine);
  assert.ok(timeline.length >= 5);
  assert.strictEqual(timeline[0].anchor, 'wake');
  console.log('✅ Routine-relative timing calculations verified');
}

// 11. Medicine Conversion to Routine-Relative Timing (Shift ON Migration)
{
  const routine = getDefaultDailyRoutine(); // wake: 07:00, breakfast: 08:30
  const fixedMed: Medicine = MedicineSchema.parse({
    id: 'med_test_1',
    name: 'Metformin',
    strength: '500mg',
    form: 'tablet',
    scheduleType: 'fixed_time',
    timesOfDay: ['08:30'],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    instructions: 'Take with food',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const converted = convertMedicineToRoutineRelative(fixedMed, routine);
  assert.strictEqual(converted.scheduleType, 'routine_relative');
  assert.ok(converted.routineTiming);
  assert.strictEqual(converted.routineTiming?.anchor, 'breakfast');
  assert.strictEqual(converted.routineTiming?.offsetMinutes, 0);
  console.log('✅ Medicine conversion to routine-relative verified');
}

// 12. Medicine Conversion to Fixed Time (Shift OFF Migration - preserves history)
{
  const routine = getDefaultDailyRoutine(); // lunch: 13:00
  const routineMed: Medicine = MedicineSchema.parse({
    id: 'med_test_2',
    name: 'Multivitamin',
    strength: '1 tablet',
    form: 'capsule',
    scheduleType: 'routine_relative',
    routineTiming: {
      anchor: 'lunch',
      offsetMinutes: 30
    },
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    instructions: 'After lunch',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const convertedBack = convertMedicineToFixedTime(routineMed, routine);
  assert.strictEqual(convertedBack.scheduleType, 'fixed_time');
  assert.deepStrictEqual(convertedBack.timesOfDay, ['13:30']);
  assert.strictEqual(convertedBack.routineTiming, undefined);
  console.log('✅ Medicine conversion to fixed clock time verified');
}

console.log('🎉 ALL SHIFT & ROUTINE DOMAIN TESTS PASSED!');
