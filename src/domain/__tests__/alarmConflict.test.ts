import assert from 'node:assert';
import { detectAlarmConflict } from '../alarmConflict';
import { AlarmItem } from '../alarm';

console.log('🧪 Starting Alarm Conflict Detection Tests...');
{
  const baseTime = 1700000000000; // Reference timestamp

  const existingAlarms: AlarmItem[] = [
    {
      id: 'alarm_1',
      profileId: 'default',
      category: 'medicine',
      title: 'Blood Pressure Tablet',
      message: 'Take with water',
      channelId: 'medicines',
      style: 'full_alarm',
      triggerTimeMs: baseTime,
      snoozeIntervalMinutes: 10
    },
    {
      id: 'alarm_2',
      profileId: 'default',
      category: 'exercise',
      title: 'Evening Run',
      message: 'Cardio routine',
      channelId: 'exercise',
      style: 'notification',
      triggerTimeMs: baseTime + 30 * 60 * 1000, // 30 mins later
      snoozeIntervalMinutes: 10
    }
  ];

  {
    const name = 'detects exact time collision (0 minute diff)';
    const result = detectAlarmConflict(baseTime, existingAlarms, 5);
    assert.strictEqual(result.hasConflict, true);
    assert.strictEqual(result.conflictingAlarms.length, 1);
    assert.strictEqual(result.conflictingAlarms[0].isExactOverlap, true);
    assert.strictEqual(result.conflictingAlarms[0].alarm.title, 'Blood Pressure Tablet');
    console.log(`✅ ${name}`);
  }

  {
    const name = 'detects collision within 5-minute window (3 minutes diff)';
    const candidateTime = baseTime + 3 * 60 * 1000; // 3 minutes later
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    assert.strictEqual(result.hasConflict, true);
    assert.strictEqual(result.conflictingAlarms[0].differenceMinutes, 3);
    assert.ok(result.warningSummary.includes('within 5-min window'));
    console.log(`✅ ${name}`);
  }

  {
    const name = 'no collision outside 5-minute window (10 minutes diff)';
    const candidateTime = baseTime + 10 * 60 * 1000; // 10 minutes later
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    assert.strictEqual(result.hasConflict, false);
    assert.strictEqual(result.conflictingAlarms.length, 0);
    console.log(`✅ ${name}`);
  }

  {
    const name = 'boundary test: exactly 5 minutes diff is flagged';
    const candidateTime = baseTime + 5 * 60 * 1000; // exactly 5 minutes
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    assert.strictEqual(result.hasConflict, true);
    console.log(`✅ ${name}`);
  }

  {
    const name = 'boundary test: 5 minutes and 1 second is clear';
    const candidateTime = baseTime + (5 * 60 + 1) * 1000; // 5 min 1 sec
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    assert.strictEqual(result.hasConflict, false);
    console.log(`✅ ${name}`);
  }

  {
    const name = 'suggests alternative non-conflicting offset times';
    const candidateTime = baseTime + 2 * 60 * 1000; // 2 minutes later (conflict)
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    assert.strictEqual(result.hasConflict, true);
    assert.ok(result.suggestions.length > 0);
    // The suggestion should shift outside the conflict window
    const firstSuggestion = result.suggestions[0];
    assert.ok(Math.abs(firstSuggestion.suggestedTimeMs - baseTime) > 5 * 60 * 1000);
    console.log(`✅ ${name}`);
  }

  {
    const name = 'excludes own alarm id when editing/rescheduling';
    const result = detectAlarmConflict(baseTime, existingAlarms, 5, 'alarm_1');
    assert.strictEqual(result.hasConflict, false);
    console.log(`✅ ${name}`);
  }
}
console.log('🎉 ALL ALARM CONFLICT TESTS PASSED!');
