#!/usr/bin/env node
/**
 * Runs every `src/**\/__tests__/*.test.ts` file with tsx, once per timezone.
 *
 * Timezones: India (UTC+5:30, LifeTrack's main market; catches UTC-vs-local date bugs for early
 * morning doses) and New York (catches daylight-saving bugs). New test files are picked up
 * automatically; there is no list to maintain.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const TIMEZONES = ['Asia/Kolkata', 'America/New_York'];

function findTests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : findTests(full);
    }
    return entry.name.endsWith('.test.ts') && dir.endsWith('__tests__') ? [full] : [];
  });
}

const tests = findTests(join(root, 'src')).sort();
const tsx = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const failures = [];

for (const tz of TIMEZONES) {
  for (const file of tests) {
    const label = `${relative(root, file)} [TZ=${tz}]`;
    console.log(`\n▶ ${label}`);
    const result = spawnSync(tsx, [file], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, TZ: tz }
    });
    if (result.status !== 0) failures.push(label);
  }
}

console.log('\n────────────────────────────────────────');
if (failures.length > 0) {
  console.error(`❌ ${failures.length} test run(s) failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`🎉 ${tests.length} test files passed in ${TIMEZONES.length} timezones.`);
