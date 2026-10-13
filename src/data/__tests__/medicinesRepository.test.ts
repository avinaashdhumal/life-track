import assert from 'node:assert';
import { medicinesRepository } from '../medicinesRepository';

/** Repository behaviour that the reminder planner depends on. Runs on the in-memory store in Node. */
async function main() {
  console.log('🧪 Starting Medicines Repository Tests...');

  // 1. Routine-anchored medicines keep their anchor (BUG-027: routineTiming was never saved)
  {
    const saved = await medicinesRepository.upsert({
      name: 'Metformin',
      scheduleType: 'routine_relative',
      timesOfDay: [],
      routineTiming: { anchor: 'breakfast', offsetMinutes: 30 }
    });
    const reloaded = await medicinesRepository.getById(saved.id);
    assert.deepStrictEqual(reloaded?.routineTiming, { anchor: 'breakfast', offsetMinutes: 30 });

    // A partial update that doesn't mention routineTiming keeps it
    await medicinesRepository.upsert({ id: saved.id, name: 'Metformin XR' });
    assert.deepStrictEqual((await medicinesRepository.getById(saved.id))?.routineTiming, {
      anchor: 'breakfast',
      offsetMinutes: 30
    });

    // Switching back to fixed times clears it explicitly
    await medicinesRepository.upsert({ id: saved.id, name: 'Metformin XR', scheduleType: 'fixed_time', routineTiming: undefined, timesOfDay: ['08:00'] });
    assert.strictEqual((await medicinesRepository.getById(saved.id))?.routineTiming, undefined);
    console.log('✅ routineTiming is saved, kept on partial updates, and clearable');
  }

  // 2. Reminder style and tone are saved; an empty tone clears back to the default
  {
    const saved = await medicinesRepository.upsert({
      name: 'Insulin',
      reminderStyle: 'notification',
      toneUri: 'content://media/internal/audio/media/7',
      toneName: 'Beep'
    });
    let reloaded = await medicinesRepository.getById(saved.id);
    assert.strictEqual(reloaded?.reminderStyle, 'notification');
    assert.strictEqual(reloaded?.toneUri, 'content://media/internal/audio/media/7');
    assert.strictEqual(reloaded?.toneName, 'Beep');

    await medicinesRepository.upsert({ id: saved.id, name: 'Insulin', toneUri: '', toneName: '' });
    reloaded = await medicinesRepository.getById(saved.id);
    assert.strictEqual(reloaded?.toneUri, undefined);
    assert.strictEqual(reloaded?.toneName, undefined);
    assert.strictEqual(reloaded?.reminderStyle, 'notification', 'style kept when not passed');

    const fresh = await medicinesRepository.upsert({ name: 'Vitamin D' });
    assert.strictEqual(fresh.reminderStyle, 'full_alarm', 'new medicines ring by default');
    console.log('✅ Reminder style and tone are saved and clearable');
  }

  console.log('🎉 ALL MEDICINES REPOSITORY TESTS PASSED!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
