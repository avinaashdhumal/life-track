# 0003 — Consolidate to one storage layer (expo-sqlite)
- **Status:** Proposed (needs the project owner's sign-off before implementation)
- **Date:** 2026-10-12

## Context
There are two AsyncStorage-backed layers (see ARCHITECTURE.md §3):
- `StorageService`: KV blobs for schedules, alarms, logs, settings, routine, and shift.
- `DatabaseService`: JSON-array "tables" for medicines, doses, profile, and app_settings, plus unused or mirror tables.

Several things overlap, and that has already caused bugs: incomplete backup (BUG-003), "Clear logs" hitting the
wrong store (BUG-007), and duplicated settings (DEBT-002). Each write re-serializes a whole table. Dose logs grow by
about 1,000–3,000 rows a year per user, and analytics (adherence %, doctor report) need range queries.

## Decision (proposed)
1. Use **`expo-sqlite`** as the single store, with real tables and indexes (`medicine_doses(medicineId, takenTimestampMs)`).
2. Keep the repository interfaces in `src/data/` as the only API the UI uses. Swap their internals.
3. Add a one-time migration that reads every `@lifetrack:*:v1` key and `@lifetrack:db:*` table, writes SQLite,
   sets `migration_version`, and keeps the old keys for one release as a rollback path.
4. Keep a tiny synchronous settings cache for first-frame theme and language.
5. One backup format = a dump of all tables + `schemaVersion`, validated with zod on import.

## Alternatives considered
- **Keep `DatabaseService` only (AsyncStorage JSON tables):** smallest change, but whole-table rewrites and no queries.
  Acceptable as an interim step if SQLite is deferred.
- **WatermelonDB / Realm:** more power than needed, and heavier native dependencies.
- **MMKV:** fast KV, but still not relational.

## Consequences
- Fixes the root cause of BUG-003, BUG-007, and DEBT-002. Makes FEAT-003 and FEAT-006 cheap.
- Migration risk: it must be idempotent and tested with real exported data before release.
- Domain code is unaffected.
