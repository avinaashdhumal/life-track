# Backlog

Single source of truth for bugs, tech debt, and features. Agents: update the status here when you start or finish an
item, and add new findings with the next free ID. Don't renumber or delete items. Move finished ones to **Done**.

**Statuses:** `todo` · `in-progress` · `blocked` · `done` · `wontfix`
**Priority:** **P0** breaks the core promise or loses data · **P1** big user value · **P2** worthwhile · **P3** nice to have
**Next free IDs:** BUG-008 · DEBT-009 · FEAT-016

---

## 🐞 Bugs

### BUG-001 · P0 · todo — Medicines never schedule reminders
- **Where:** `src/data/medicinesRepository.ts`, `src/features/medicines/*`, `src/services/AlarmEngineService.ts`
- **Problem:** Creating, editing, pausing, or deleting a medicine never calls `reminderService`. Users get no alarm for
  their doses. This is the app's core promise.
- **Fix outline:** Add a `MedicineReminderPlanner` in `src/domain/` (pure) that turns a `Medicine` (+ routine + shift
  config) into dose occurrences for the next N days, with deterministic ids `med_<medId>_<YYYY-MM-DD>_<HH:mm>`.
  Call it from a `medicineReminderSync` service on medicine upsert, delete, and toggle, and on routine/shift change.
  Cancel the stale ids first. Put `{medicineId, scheduledTime}` in the alarm `payload`.
- **Acceptance:** Adding a fixed-time medicine for 2 minutes from now rings on a locked phone. Pausing it cancels the
  alarm. Changing its time moves it. Routine-relative medicines move when the routine changes. Domain tests cover
  fixed, routine-relative, interval, and PRN (no alarm).

### BUG-002 · P0 · todo — Native alarm sync drops `scheduleId`/`category`
- **Where:** `AlarmEngineService.getScheduledAlarms()` maps `NativeAlarmInfo` → `AlarmItem` without `scheduleId` and
  `category`, then overwrites the JS store with that list.
- **Effect:** On a device, editing, disabling, or deleting a recurring schedule filters by `a.scheduleId === id`, finds
  nothing, and leaves the old alarms ringing.
- **Fix:** Put `scheduleId` and `category` into the native payload (or the native record) and map them back, or merge
  with the JS record by id instead of overwriting it.

### BUG-003 · P0 · todo — Backup/restore is incomplete
- **Where:** `ProfileSettingsScreen` uses `databaseService.exportDatabaseDump/importDatabaseDump`.
- **Problem:** The export leaves out StorageService data: recurring schedules, settings, the real routine, and the real
  shift config. On restore, routine and shift are written into DB mirror tables that nobody reads. `shift_config` rows
  have no `id`/`key`, so they're dropped. There's no schema validation, and alarms aren't replanned after restore.
- **Fix:** Write one versioned backup format covering every store, with zod validation, a migration hook, and a replan
  after import. Best done together with DEBT-001.
- **Acceptance:** Export, clear the app, import: medicines, dose history, profile, routine, shift, settings, and
  schedules all come back, and alarms are rescheduled.

### BUG-004 · P1 · todo — Notification "Taken/Skip/Snooze" never reaches app data
- **Where:** `AlarmReceiver.kt` handles the actions natively and only writes `alarm_event_logs` to SharedPreferences.
  JS never reads them (no `getEventLog` export in `modules/alarm-engine/index.ts`).
- **Effect:** Tapping "Taken" on the notification doesn't log a dose or decrement stock, and Today still says pending.
- **Fix:** Add `getPendingActions()` + `clearPendingActions()` to the native module. On app start and on foreground
  (`AppState`), drain them and call `medicinesRepository.logDose` using the payload's `medicineId`. Optionally emit an
  Expo event when JS is alive.

### BUG-005 · P1 · todo — Alarms run out if the app isn't opened for 14 days
- **Where:** `replanRecurringSchedules()` only runs when the app starts.
- **Fix:** Native self-rescheduling. Either store the recurrence rule natively and schedule the next occurrence when
  one fires, or add a daily `WorkManager` job that tops up the window. Applies to medicine reminders too (BUG-001).

### BUG-006 · P2 · todo — `interval` medicines ignore `intervalHours`
- **Where:** `generateTodayDoseSlots` in `src/domain/medicine.ts` falls through to `timesOfDay`.
- **Fix:** Generate slots from the first dose time, stepping by `intervalHours` within the waking window. Add tests.

### BUG-007 · P2 · todo — "Clear logs" in Profile clears the wrong store
- **Where:** `ProfileSettingsScreen.handleClearLogs` → `databaseService.clearLogs()` (the unused `reminder_logs`
  table). The real logs are in `@lifetrack:event_logs:v1`. The Profile log list reads the empty DB table too.
- **Fix:** Point both at `reminderService.getLogs/clearLogs` (or the unified store after DEBT-001).

---

## 🧱 Tech debt

### DEBT-001 · P0 · todo — Two parallel persistence layers
`StorageService` (KV) and `DatabaseService` (tables) overlap: profile, settings, schedules, alarms, logs, routine, and
shift. This is the root cause of BUG-003, BUG-007, and DEBT-002. See [ADR-0003](decisions/0003-storage-consolidation.md).
Plan: choose one store (recommended: `expo-sqlite` behind the existing repository interfaces, since years of dose
logs will outgrow JSON blobs), migrate the `v1` keys once with a migration marker, and delete the other layer.

### DEBT-002 · P1 · todo — Duplicated settings and profile fields
`defaultSnoozeMinutes` (StorageService settings vs `app_settings` row), wake/sleep (profile `wakeTime/sleepTime` vs
`DailyRoutine`), onboarding and shift flags (loose AsyncStorage keys + `app_settings`), and two profile types
(`UserProfile` vs `UserProfileRecord`). Keep one of each.

### DEBT-003 · P1 · todo — 1-second polling loop writes storage every tick
`src/App.tsx` calls `getScheduledAlarms()` every second. On a device, that calls the native module and rewrites
`@lifetrack:active_alarms:v1` each time, which costs battery and churns storage. Replace it with a single timeout for
the next due alarm, re-armed on change, and `AppState` foreground checks. Don't write on read.

### DEBT-004 · P2 · todo — AI Studio scaffold leftovers
Unused deps `@google/genai`, `express`, `dotenv`, `recharts`, `motion`, `lucide-react`, `@types/jest`.
Files `metadata.json` (declares server-side Gemini, which contradicts the privacy promise), `.env.example` (Gemini key),
`convert.cjs`, `convert.js`, `fix-imports.cjs`, `scratch/`, and `features/poc/NativeCodeInspectorModal.tsx` (not
imported). Also rename `package.json` `name` → `lifetrack` and give it a real version.

### DEBT-005 · P2 · todo — Web preview is broken
Vite has no `react-native` → `react-native-web` alias, so the build fails with `Flow is not supported`. Decide:
either delete the Vite path (`index.html`, `src/main.tsx`, `vite.config.ts`, `src/index.css`) and use
`npx expo start --web`, or add the alias. Recommended: delete it. Android is the target, and the web path hides
native-only bugs.

### DEBT-006 · P2 · todo — `alarmConflict.test.ts` doesn't run
It uses Jest `describe/it`. Convert it to `node:assert` like the other tests and add it to `scripts.test`.
Consider a tiny runner (`node --test` with tsx) so new test files are picked up automatically.

### DEBT-007 · P2 · todo — `features/poc/` holds production screens
Move `ProfileSettingsScreen`, `HealthCheckScreen`, `FullScreenAlarmModal`, `LanguageThemeModal`, and
`NotificationToneSettingsModal` into feature folders (`settings/`, `reliability/`, `alarms/`). Split screens over
1,000 lines (`ProfileSettingsScreen` 1,232, `ShiftScheduleScreen` 1,144, `AlarmFormScreen` 1,048).

### DEBT-008 · P3 · todo — Hand-rolled navigation
`activeTab` state in `App.tsx` has no back-button handling and no deep links (the `lifetrack://` scheme is declared
but unused). Adopt `expo-router` or React Navigation when adding the next major screen.

---

## ✨ Features (ordered by user value; see ROADMAP for milestones)

| ID | P | Status | Feature | Milestone |
| --- | :-: | --- | --- | --- |
| FEAT-001 | P0 | todo | Medicine reminders end to end (BUG-001 + BUG-004 + BUG-005) | M1 |
| FEAT-002 | P1 | todo | Missed-dose follow-up: re-notify after X min, then mark `missed` and show `missedDoseAdvice` | M1 |
| FEAT-003 | P1 | todo | Adherence history: per-medicine calendar, 7/30-day %, streak (pure domain + screen) | M2 |
| FEAT-004 | P1 | todo | Refill reminder notification when stock ≤ threshold, plus "days of stock left" estimate | M1 |
| FEAT-005 | P1 | todo | Simplify navigation: Today · Medicines · History · More (Alarms/Health Check move under More → Reliability) | M2 |
| FEAT-006 | P1 | todo | Doctor report: share a PDF of medicines and 30-day adherence (`expo-print` + `expo-sharing`) | M3 |
| FEAT-007 | P1 | todo | Automatic local backup (weekly, SAF folder) + one-tap restore | M2 |
| FEAT-008 | P2 | todo | Emergency card (blood group, allergies, conditions, contacts) on lock screen / quick share | M3 |
| FEAT-009 | P2 | todo | Reliability nudge: a Today banner when exact-alarm, notification, or battery permission is missing | M1 |
| FEAT-010 | P2 | todo | Appointments with reminders (Phase 3 start) | M4 |
| FEAT-011 | P2 | todo | "Delete all my data" in Settings (clears every store + native alarms) | M2 |
| FEAT-012 | P2 | todo | Shift-aware dose times: use the current shift's routine template; shift-eve notification | M3 |
| FEAT-013 | P2 | todo | Vitals log (BP, sugar, weight) with target ranges (Phase 3) | M4 |
| FEAT-014 | P3 | todo | Home-screen widget "Next dose" (Phase 10) | M5 |
| FEAT-015 | P1 | todo | Play Store readiness: exact-alarm policy, full-screen-intent check (Android 14+), privacy policy, Data Safety | M3 |

---

## ✅ Done

_(Move items here with the completion date and commit, e.g. `BUG-001 · 2026-10-20 · a1b2c3d`.)_
