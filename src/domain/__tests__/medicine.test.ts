import assert from 'node:assert';

// Ensure AsyncStorage web fallback works cleanly in Node.js test environment
if (typeof (globalThis as any).window === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, val: string) => store.set(key, String(val)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear()
    }
  };
}

import {
  MedicineSchema,
  checkMinimumDoseGap,
  checkMaxDailyDoses,
  calculateStockLevel,
  decrementStock,
  incrementStock,
  generateTodayDoseSlots,
  Medicine,
  DoseLogEntry
} from '../medicine';

console.log('🧪 Starting Medicine Domain & Safety Rules Unit Tests...');

// 1. Zod schema validation & defaults
const sampleMed: Medicine = MedicineSchema.parse({
  id: 'med_metformin',
  name: 'Metformin',
  form: 'tablet',
  strength: '500 mg',
  foodRelation: 'with',
  scheduleType: 'fixed_time',
  timesOfDay: ['08:00', '20:00'],
  minGapMinutes: 360,
  maxDailyDoses: 2,
  stockCount: 14,
  refillThreshold: 5,
  missedDoseAdvice: 'Take with next meal. Do not take a double dose.',
  createdAt: Date.now(),
  updatedAt: Date.now()
});

assert.strictEqual(sampleMed.name, 'Metformin');
assert.strictEqual(sampleMed.form, 'tablet');
assert.strictEqual(sampleMed.profileId, 'default');
assert.strictEqual(sampleMed.isActive, true);
console.log('✅ Zod schema parses valid medicine with multi-profile defaults');

// 2. Minimum dose gap safety rule
const baseTime = 1700000000000;
const fourHoursLater = baseTime + 4 * 60 * 60 * 1000; // 240 mins
const sevenHoursLater = baseTime + 7 * 60 * 60 * 1000; // 420 mins

const gapViolated = checkMinimumDoseGap(baseTime, fourHoursLater, 360);
assert.strictEqual(gapViolated.isSafe, false);
assert.strictEqual(gapViolated.differenceMinutes, 240);
assert(gapViolated.warning?.includes('Minimum gap between doses is 360 min'));
console.log('✅ Minimum dose gap safety correctly flags early dose attempt');

const gapRespected = checkMinimumDoseGap(baseTime, sevenHoursLater, 360);
assert.strictEqual(gapRespected.isSafe, true);
assert.strictEqual(gapRespected.differenceMinutes, 420);
assert.strictEqual(gapRespected.warning, undefined);
console.log('✅ Minimum dose gap safety approves dose after safe interval');

// 3. Max daily doses ceiling (PRN safety)
const withinLimit = checkMaxDailyDoses(1, 2);
assert.strictEqual(withinLimit.isAllowed, true);

const atLimit = checkMaxDailyDoses(2, 2);
assert.strictEqual(atLimit.isAllowed, false);
assert(atLimit.warning?.includes('Daily safety limit reached: 2/2 doses'));
console.log('✅ Max daily doses ceiling warns when limit reached');

// 4. Stock level calculations and threshold warnings
const normalStock = calculateStockLevel(20, 5);
assert.strictEqual(normalStock.isLowStock, false);
assert.strictEqual(normalStock.isOutOfStock, false);

const lowStock = calculateStockLevel(4, 5);
assert.strictEqual(lowStock.isLowStock, true);
assert.strictEqual(lowStock.isOutOfStock, false);
assert(lowStock.message.includes('Low stock: 4 remaining'));

const outOfStock = calculateStockLevel(0, 5);
assert.strictEqual(outOfStock.isLowStock, false);
assert.strictEqual(outOfStock.isOutOfStock, true);
assert(outOfStock.message.includes('Out of stock'));

assert.strictEqual(decrementStock(10, 1), 9);
assert.strictEqual(decrementStock(0, 1), 0); // No negative stock
assert.strictEqual(incrementStock(5, 30), 35);
console.log('✅ Inventory stock calculations and low-stock alerts verified');

// 5. Generate Today's Dose Slots
const todayStr = '2026-10-11';
const slots = generateTodayDoseSlots(sampleMed, todayStr, []);
assert.strictEqual(slots.length, 2);
assert.strictEqual(slots[0].scheduledTime, '08:00');
assert.strictEqual(slots[1].scheduledTime, '20:00');
assert.strictEqual(slots[0].medicineName, 'Metformin');

// With log entry
const log: DoseLogEntry = {
  id: 'log_1',
  profileId: 'default',
  medicineId: sampleMed.id,
  medicineName: sampleMed.name,
  scheduledTime: '08:00',
  scheduledTimestampMs: slots[0].scheduledTimestampMs,
  takenTimestampMs: slots[0].scheduledTimestampMs + 5 * 60 * 1000,
  status: 'taken',
  quantityTaken: 1,
  createdAt: Date.now()
};

const slotsWithLog = generateTodayDoseSlots(sampleMed, todayStr, [log]);
assert.strictEqual(slotsWithLog[0].status, 'taken');
assert.strictEqual(slotsWithLog[1].status, 'pending');
import { medicinesRepository } from '../../data/medicinesRepository';

// 6. Repository CRUD: Edit and Delete
async function testRepositoryCrud() {
  const newMed = await medicinesRepository.upsert({
    name: 'Amoxicillin',
    form: 'capsule',
    strength: '250 mg',
    stockCount: 20,
    refillThreshold: 4,
    timesOfDay: ['09:00', '21:00']
  });
  assert.strictEqual(newMed.name, 'Amoxicillin');
  assert.strictEqual(newMed.stockCount, 20);

  // Edit medicine
  const editedMed = await medicinesRepository.upsert({
    id: newMed.id,
    name: 'Amoxicillin Clavulanate',
    strength: '500 mg',
    stockCount: 18,
    timesOfDay: ['08:00', '16:00', '00:00']
  });
  assert.strictEqual(editedMed.id, newMed.id);
  assert.strictEqual(editedMed.name, 'Amoxicillin Clavulanate');
  assert.strictEqual(editedMed.strength, '500 mg');
  assert.strictEqual(editedMed.stockCount, 18);
  assert.strictEqual(editedMed.createdAt, newMed.createdAt);
  assert(editedMed.updatedAt >= newMed.updatedAt);

  // Verify retrieved by getById
  const retrieved = await medicinesRepository.getById(newMed.id);
  assert.strictEqual(retrieved?.name, 'Amoxicillin Clavulanate');

  // Delete medicine
  const deleted = await medicinesRepository.delete(newMed.id);
  assert.strictEqual(deleted, true);
  const afterDelete = await medicinesRepository.getById(newMed.id);
  assert.strictEqual(afterDelete, null);
  console.log('✅ Medicine CRUD: Edit and Delete successfully verified in local persistent repository');
}

await testRepositoryCrud();

console.log('🎉 ALL MEDICINE DOMAIN & REPOSITORY TESTS PASSED!\n');
