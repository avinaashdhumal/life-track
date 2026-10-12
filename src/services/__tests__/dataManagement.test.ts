import assert from 'node:assert';
import { kvStore } from '../kvStore';
import { runMigrations, SCHEMA_VERSION_KEY } from '../migrations';
import { storageService, STORAGE_KEYS, routineKey } from '../StorageService';
import { databaseService, tableKey, DB_TABLES } from '../DatabaseService';
import { dataManagementService, BACKUP_FORMAT } from '../DataManagementService';
import { medicinesRepository } from '../../data/medicinesRepository';
import { routineRepository } from '../../data/routineRepository';
import { shiftRepository } from '../../data/shiftRepository';
import { profileRepository } from '../../data/profileRepository';

/**
 * Storage, migration, and backup tests. In Node the AsyncStorage native module is absent, so
 * kvStore runs in-memory; the logic under test is identical.
 */

async function resetAll() {
  await kvStore.clearAll();
  await databaseService.reload();
}

async function main() {
  console.log('🧪 Starting Storage, Migration & Backup Tests...');

  // 1. v1 → v2 migration carries user choices over and removes duplicates (DEBT-001/002, BUG-012)
  {
    await resetAll();
    await kvStore.set('@lifetrack:has_completed_onboarding', 'true');
    await kvStore.set('@lifetrack:shift_feature_enabled', 'true');
    await kvStore.setJson(tableKey('user_profile'), [{ id: 'usr_primary', name: 'Asha', wakeTime: '05:45', sleepTime: '22:00' }]);
    await kvStore.setJson(tableKey('schedules'), [{ id: 'stale' }]);
    await kvStore.setJson(tableKey('reminder_logs'), [{ id: 'stale' }]);
    await kvStore.setJson('@lifetrack:user_profile:v1', { id: 'default', name: '' });
    await databaseService.reload();

    const result = await runMigrations();
    assert.strictEqual(result.fromVersion, 1);
    assert.strictEqual(result.toVersion, 2);
    assert.strictEqual(result.alarmsNeedRebuild, true);
    assert.strictEqual((await storageService.getSettings()).hasCompletedOnboarding, true);
    assert.strictEqual((await shiftRepository.getConfig()).isEnabled, true, 'onboarding shift choice applied');
    const routine = await routineRepository.getRoutine('default');
    assert.strictEqual(routine.wakeTime, '05:45', 'profile wake time moved to routine');
    assert.strictEqual(routine.sleepTime, '22:00');
    assert.strictEqual((await profileRepository.getProfile()).name, 'Asha', 'profile kept');
    assert.strictEqual(await kvStore.get(tableKey('schedules')), null);
    assert.strictEqual(await kvStore.get(tableKey('reminder_logs')), null);
    assert.strictEqual(await kvStore.get('@lifetrack:has_completed_onboarding'), null);
    assert.strictEqual(await kvStore.get('@lifetrack:user_profile:v1'), null);
    assert.strictEqual(await kvStore.get(SCHEMA_VERSION_KEY), '2');

    const again = await runMigrations();
    assert.strictEqual(again.fromVersion, 2);
    assert.strictEqual(again.alarmsNeedRebuild, false, 'idempotent');
    console.log('✅ Migration v1 → v2 keeps onboarding, shift choice, wake/sleep; removes duplicates');
  }

  // 2. Migration doesn't override a shift setting the user already chose
  {
    await resetAll();
    await kvStore.set('@lifetrack:shift_feature_enabled', 'true');
    await storageService.updateShiftConfig({ isEnabled: false });
    await runMigrations();
    assert.strictEqual((await shiftRepository.getConfig()).isEnabled, false);
    console.log('✅ Migration respects an existing shift configuration');
  }

  // 3. Full backup round trip covers every store (BUG-003)
  {
    await resetAll();
    await runMigrations();
    await storageService.updateSettings({ language: 'mr', defaultSnoozeMinutes: 15, hasCompletedOnboarding: true });
    await profileRepository.updateProfile({ name: 'Ravi', bloodGroup: 'B+', allergies: ['Penicillin'] });
    const metformin = await medicinesRepository.upsert({ name: 'Metformin', timesOfDay: ['08:00', '20:00'] });
    await medicinesRepository.upsert({ name: 'Paracetamol', scheduleType: 'prn_as_needed' });
    await medicinesRepository.logDose({
      profileId: 'default',
      medicineId: metformin.id,
      medicineName: metformin.name,
      scheduledTime: '08:00',
      takenTimestampMs: Date.now(),
      status: 'taken',
      quantityTaken: 1
    });
    await routineRepository.updateRoutine({ wakeTime: '06:10' });
    await shiftRepository.setEnabled(true);
    await storageService.createRecurringSchedule({
      profileId: 'default',
      title: 'Walk',
      message: '',
      channelId: 'exercise',
      style: 'notification',
      recurrenceType: 'daily',
      timeOfDay: '18:00',
      snoozeIntervalMinutes: 10,
      isEnabled: true
    });
    await storageService.addLog({ profileId: 'default', alarmId: 'a', action: 'TAKEN', timestampMs: 1, scheduledTimeMs: 1 });

    const json = await dataManagementService.exportBackupJson();
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.format, BACKUP_FORMAT);
    assert.strictEqual(parsed.schemaVersion, 2);

    await dataManagementService.clearAllData();
    assert.strictEqual((await medicinesRepository.getAll()).length, 0, 'wiped');
    assert.strictEqual((await storageService.getRecurringSchedules()).length, 0);
    assert.strictEqual((await storageService.getSettings()).hasCompletedOnboarding, false);

    const restored = await dataManagementService.restoreBackupJson(json);
    assert.strictEqual(restored.ok, true);
    assert.deepStrictEqual(restored.counts, { medicines: 2, doses: 1, schedules: 1, logs: 1 });
    const settings = await storageService.getSettings();
    assert.strictEqual(settings.language, 'mr');
    assert.strictEqual(settings.defaultSnoozeMinutes, 15);
    assert.strictEqual(settings.hasCompletedOnboarding, true);
    assert.strictEqual((await profileRepository.getProfile()).name, 'Ravi');
    assert.deepStrictEqual((await profileRepository.getProfile()).allergies, ['Penicillin']);
    assert.strictEqual((await medicinesRepository.getAll()).length, 2);
    assert.strictEqual((await medicinesRepository.getHistoryForMedicine(metformin.id)).length, 1);
    assert.strictEqual((await medicinesRepository.getById(metformin.id))?.stockCount, 29, 'stock after dose');
    assert.strictEqual((await routineRepository.getRoutine('default')).wakeTime, '06:10');
    assert.strictEqual((await shiftRepository.getConfig()).isEnabled, true);
    assert.strictEqual((await storageService.getRecurringSchedules())[0].title, 'Walk');
    assert.strictEqual((await storageService.getLogs()).length, 1);
    console.log('✅ Backup → wipe → restore brings back every store');
  }

  // 4. Invalid or newer backups are rejected without touching data
  {
    const before = (await medicinesRepository.getAll()).length;
    assert.strictEqual((await dataManagementService.restoreBackupJson('{not json')).error, 'not_json');
    assert.strictEqual(
      (await dataManagementService.restoreBackupJson(JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 99, data: {} })))
        .error,
      'newer_version'
    );
    const badMedicine = {
      format: BACKUP_FORMAT,
      schemaVersion: 2,
      exportedAt: 0,
      data: { medicines: [{ id: 'm', name: '' }] }
    };
    assert.strictEqual((await dataManagementService.restoreBackupJson(JSON.stringify(badMedicine))).error, 'invalid_data');
    assert.strictEqual((await dataManagementService.restoreBackupJson('{"hello":1}')).error, 'unknown_format');
    assert.strictEqual((await medicinesRepository.getAll()).length, before, 'nothing written');
    console.log('✅ Invalid, unknown, and newer backups are rejected without writes');
  }

  // 5. Old v1 backups (DB table dump from the previous Profile screen) still restore
  {
    const now = Date.now();
    const legacy = {
      _meta: { database: 'lifetrack_local.db', version: 1, exportedAt: now },
      user_profile: [{ id: 'usr_primary', name: 'Legacy User', wakeTime: '07:00', sleepTime: '23:00' }],
      medicines: [{ id: 'med_old', profileId: 'default', name: 'Amlodipine', createdAt: now, updatedAt: now, doses: 1 }],
      medicine_doses: [],
      daily_routines: [{ id: 'routine_default', profileId: 'default', wakeTime: '05:30', sleepTime: '21:30' }],
      shift_config: [],
      app_settings: [{ id: 'has_completed_onboarding', key: 'has_completed_onboarding', value: true }],
      schedules: [],
      scheduled_alarms: [],
      reminder_logs: []
    };
    const result = await dataManagementService.restoreBackupJson(JSON.stringify(legacy));
    assert.strictEqual(result.ok, true);
    assert.strictEqual((await medicinesRepository.getById('med_old'))?.name, 'Amlodipine');
    assert.strictEqual((await routineRepository.getRoutine('default')).wakeTime, '05:30');
    assert.strictEqual((await profileRepository.getProfile()).name, 'Legacy User');
    console.log('✅ Legacy v1 database dumps restore correctly');
  }

  // 6. Reminder logs live in one store: clearing them really clears them (BUG-007)
  {
    await storageService.addLog({ profileId: 'default', alarmId: 'x', action: 'FIRED', timestampMs: 2, scheduledTimeMs: 2 });
    assert.ok((await storageService.getLogs()).length > 0);
    await storageService.clearLogs();
    assert.strictEqual((await storageService.getLogs()).length, 0);
    console.log('✅ Clearing logs empties the only log store');
  }

  // 7. Deleting a medicine removes its dose history in one go; change events fire
  {
    const events: string[] = [];
    const unsubscribe = medicinesRepository.changes.subscribe((e) => events.push(e.type));
    const m = await medicinesRepository.upsert({ name: 'Temp' });
    await medicinesRepository.logDose({
      profileId: 'default',
      medicineId: m.id,
      medicineName: m.name,
      takenTimestampMs: Date.now(),
      status: 'taken',
      quantityTaken: 1
    });
    assert.strictEqual(await medicinesRepository.delete(m.id), true);
    const remaining = await databaseService.query(DB_TABLES.MEDICINE_DOSES, (d: any) => d.medicineId === m.id);
    assert.strictEqual(remaining.length, 0);
    unsubscribe();
    assert.deepStrictEqual(events, ['upserted', 'dose', 'deleted']);
    console.log('✅ Medicine delete cascades and emits change events');
  }

  // 8. Settings round-trip through the sync cache used for first render
  {
    await storageService.updateSettings({ themeMode: 'light' });
    await storageService.preload();
    assert.strictEqual(storageService.getSyncSetting('themeMode'), 'light');
    assert.ok(await kvStore.has(STORAGE_KEYS.SETTINGS));
    assert.ok(await kvStore.has(routineKey('default')));
    console.log('✅ Settings are available synchronously after preload');
  }

  console.log('🎉 ALL STORAGE, MIGRATION & BACKUP TESTS PASSED!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
