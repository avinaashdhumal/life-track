import assert from 'node:assert';
import { tintOver } from '../color';

console.log('🧪 Starting Color Utility Tests...');
assert.strictEqual(tintOver('#6366f1', 0, '#09090b'), '#09090b');
assert.strictEqual(tintOver('#6366f1', 1, '#09090b'), '#6366f1');
assert.strictEqual(tintOver('#ffffff', 0.5, '#000000'), '#808080');
assert.match(tintOver('#4f46e5', 0.07, '#f8fafc'), /^#[0-9a-f]{6}$/, 'always an opaque 6-digit hex');
assert.strictEqual(tintOver('not-a-color', 0.5, '#f8fafc'), '#f8fafc', 'bad input falls back to the base');
console.log('✅ tintOver blends to an opaque color');
console.log('🎉 ALL COLOR TESTS PASSED!');
