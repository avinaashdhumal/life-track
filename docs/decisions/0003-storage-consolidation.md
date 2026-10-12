# 0003 — One storage engine (AsyncStorage now, SQLite later if needed)
- **Status:** Accepted (2026-10-12), amends the original "move to expo-sqlite" proposal
- **Date:** 2026-10-12

## Context
v1 had two independent AsyncStorage layers, `StorageService` (KV documents) and `DatabaseService` (JSON-array
"tables"), with overlapping data: profile, settings, schedules, alarms, logs, routine, shift. This caused incomplete
backups (BUG-003), "Clear logs" hitting the wrong store (BUG-007), and duplicated settings (DEBT-002).

## Decision
1. **One engine:** `src/services/kvStore.ts` is the only code that touches AsyncStorage (with in-memory fallback and a
   sync cache for first render).
2. **Two typed views, one owner per datum:** `StorageService` owns settings, schedules, logs, routine, shift config
   (and the JS alarm list for the no-native fallback). `DatabaseService` owns medicines, dose history, health profile.
   See ARCHITECTURE.md §3.
3. **Versioned migrations** in `src/services/migrations.ts` (`@lifetrack:schema_version`); v2 removed the duplicates.
4. **One backup format** covering every store (`DataManagementService`), validated with zod.
5. **SQLite is deferred**, not rejected. Repositories are the only API the UI uses, so swapping the engine later
   changes only `src/services/*` plus a migration.

## Why not SQLite now
`expo-sqlite` adds a native dependency that needs a new dev build and device testing, while the native alarm module
already needs device verification (DEBT-010). Data volumes are small today (about 1,000–3,000 dose rows/year/user;
whole-table writes are still in milliseconds).

## Revisit when
- Dose history reads/writes become noticeably slow on a low-end phone, or
- FEAT-003 (adherence history) / FEAT-006 (doctor report) need range queries over a year or more of doses.

## Consequences
- Fixed BUG-003, BUG-007, DEBT-002 at the root.
- Any new data must pick one owner store, add a zod schema, and (if the shape changes) a migration step.
