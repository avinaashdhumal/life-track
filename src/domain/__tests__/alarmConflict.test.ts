import { detectAlarmConflict } from '../alarmConflict';
import { AlarmItem } from '../alarm';

describe('Alarm Conflict Detection System', () => {
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

  test('detects exact time collision (0 minute diff)', () => {
    const result = detectAlarmConflict(baseTime, existingAlarms, 5);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingAlarms.length).toBe(1);
    expect(result.conflictingAlarms[0].isExactOverlap).toBe(true);
    expect(result.conflictingAlarms[0].alarm.title).toBe('Blood Pressure Tablet');
  });

  test('detects collision within 5-minute window (3 minutes diff)', () => {
    const candidateTime = baseTime + 3 * 60 * 1000; // 3 minutes later
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingAlarms[0].differenceMinutes).toBe(3);
    expect(result.warningSummary).toContain('within 5-min window');
  });

  test('no collision outside 5-minute window (10 minutes diff)', () => {
    const candidateTime = baseTime + 10 * 60 * 1000; // 10 minutes later
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    expect(result.hasConflict).toBe(false);
    expect(result.conflictingAlarms.length).toBe(0);
  });

  test('boundary test: exactly 5 minutes diff is flagged', () => {
    const candidateTime = baseTime + 5 * 60 * 1000; // exactly 5 minutes
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    expect(result.hasConflict).toBe(true);
  });

  test('boundary test: 5 minutes and 1 second is clear', () => {
    const candidateTime = baseTime + (5 * 60 + 1) * 1000; // 5 min 1 sec
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    expect(result.hasConflict).toBe(false);
  });

  test('suggests alternative non-conflicting offset times', () => {
    const candidateTime = baseTime + 2 * 60 * 1000; // 2 minutes later (conflict)
    const result = detectAlarmConflict(candidateTime, existingAlarms, 5);
    expect(result.hasConflict).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    // The suggestion should shift outside the conflict window
    const firstSuggestion = result.suggestions[0];
    expect(Math.abs(firstSuggestion.suggestedTimeMs - baseTime)).toBeGreaterThan(5 * 60 * 1000);
  });

  test('excludes own alarm id when editing/rescheduling', () => {
    const result = detectAlarmConflict(baseTime, existingAlarms, 5, 'alarm_1');
    expect(result.hasConflict).toBe(false);
  });
});
