# Backlog

Single source of truth for bugs, tech debt, and features. Agents: update the status here when you start or finish an
item, and add new findings with the next free ID. Don't renumber or delete items. Move finished ones to **Done**.

**Statuses:** `todo` · `in-progress` · `blocked` · `done` · `wontfix`
**Priority:** **P0** breaks the core promise or loses data · **P1** big user value · **P2** worthwhile · **P3** nice to have
**Next free IDs:** BUG-029 · DEBT-014 · FEAT-017

---

## 🔴 Open

### DEBT-010 · P0 · in-progress — Native (Kotlin) changes need device testing
- **2026-10-12:** ✅ `:alarm-engine:compileDebugKotlin` builds with JDK 17 (zulu) and SDK 36, with no warnings
  after removing a no-op `ACQUIRE_CAUSES_WAKEUP` flag. Device/emulator checklist below is still open.
- **2026-10-12, emulator (`medium_phone`, API 36):** ✅ full debug APK builds and installs; ✅ AsyncStorage 2.2.0
  persists data (the old build logged "Native module is null" every second, confirming BUG-025); ✅ medicine reminder
  registered 15 `RTC_WAKEUP` alarms with local-date ids; ✅ fired at 12:22:00 with the screen locked, foreground
  service started, lock-screen activity shown via full-screen intent in 0.6 s; ✅ series rolled forward natively;
  ✅ lock-screen Skip queued and applied by JS on return (reminder log). Still to do: Taken from the notification →
  stock −1, snooze, auto-dismiss, reboot, and checking that the clock-icon shortcut doesn't ring (checklist items 1–5).
- **Why:** The 2026-10-12 fix session rewrote most of `modules/alarm-engine` (roll-forward, pending-action queue,
  action handler, auto-dismiss, localized labels, full-screen-intent check). There was no JDK on the dev machine, so
  it has **not been compiled**. JS side is verified (tests, Metro bundle, web run).
- **Do:** `npx expo prebuild -p android --clean && npx expo run:android --device`, fix any compile errors, then run
  README device Tests 1–4 **with a medicine reminder**, plus:
  1. Tap *Taken* on the notification with the app killed → reopen → Today shows Taken, stock −1.
  2. Let a full alarm ring untouched → stops after 5 min (default), a silent "missed" notification remains.
  3. Open the alarm-clock icon in the status bar before an alarm → the lock-screen UI must **not** ring.
  4. Snooze from the lock screen → rings again after the configured snooze minutes, same medicine.
  5. Reboot with an alarm due 2 min later → still rings; after a missed one, the next day's occurrence exists.
- Record the device, Android version, and results in PROGRESS_LOG.md.

### DEBT-013 · P1 · todo — Android 16 "audio hardening" may mute the ringing alarm
- **Seen 2026-10-13 (emulator API 36):** `AudioService: AudioHardening background playback would be muted for
  com.lifetrack.app`. Audit-only today (the alarm rang), but enforcement would silence the looping alarm tone, which
  is played by `AlarmForegroundService` (type `specialUse`) started from the background.
- **Do:** on a real Android 16 device, check whether the tone plays with the screen locked. Evaluate the FGS type
  for alarm audio (`mediaPlayback`, or `systemExempted` for exact-alarm apps) against current Play policy, and the
  fallback of relying on the notification channel sound. Decide together with FEAT-015.

### DEBT-009 · P1 · todo — ~70 hard-coded English UI strings remain
- Mostly `accessibilityLabel="..."` (screen-reader text) plus some visible text and placeholders in
  `MedicineFormModal` (21), `OnboardingScreen` (17), `MedicineListScreen` (11), `TodayScreen` (10),
  `ShiftScheduleScreen` (7), `RoutineSettingsModal` (4), and a few others. Hindi/Marathi users with TalkBack hear
  English. Move each to i18n keys in all four locales. `npm test` already fails on missing keys; consider extending it
  to flag string-literal `accessibilityLabel`/`placeholder` props.

### Features (ordered by user value; see ROADMAP for milestones)

| ID | P | Status | Feature | Milestone |
| --- | :-: | --- | --- | --- |
| FEAT-002 | P1 | todo | Missed-dose follow-up: re-notify after X min, then mark `missed` and show `missedDoseAdvice` (auto-dismiss → MISSED already logged; add the re-notify + advice UI) | M1 |
| FEAT-004 | P1 | todo | Refill reminder notification when stock ≤ threshold, plus "days of stock left" estimate | M1 |
| FEAT-009 | P2 | todo | Reliability nudge: a Today banner when exact-alarm, notification, full-screen, or battery permission is missing (`reminderService.getHealthCheck()` has all of them) | M1 |
| FEAT-003 | P1 | todo | Adherence history: per-medicine calendar, 7/30-day %, streak (pure domain + screen) | M2 |
| FEAT-005 | P1 | todo | Simplify navigation: Today · Medicines · History · More (Alarms/Health Check move under More → Reliability) | M2 |
| FEAT-007 | P1 | todo | Automatic local backup (weekly, SAF folder) + one-tap restore (backup format is ready: `DataManagementService`) | M2 |
| FEAT-011 | P2 | todo | "Delete all my data" button in Settings (logic exists: `dataManagementService.clearAllData()` + `reminderService.cancelAll()`) | M2 |
| FEAT-006 | P1 | todo | Doctor report: share a PDF of medicines and 30-day adherence (`expo-print` + `expo-sharing`) | M3 |
| FEAT-008 | P2 | todo | Emergency card (blood group, allergies, conditions, contacts) on lock screen / quick share | M3 |
| FEAT-012 | P2 | todo | Shift-aware dose times: use the current shift's routine template; shift-eve notification | M3 |
| FEAT-015 | P1 | in-progress | Play Store readiness: full-screen-intent check + settings link **done**; still to do: decide `USE_EXACT_ALARM` vs user-granted `SCHEDULE_EXACT_ALARM` under current Play policy, privacy policy URL, Data Safety form | M3 |
| FEAT-010 | P2 | todo | Appointments with reminders (Phase 3 start) | M4 |
| FEAT-013 | P2 | todo | Vitals log (BP, sugar, weight) with target ranges (Phase 3) | M4 |
| FEAT-014 | P3 | todo | Home-screen widget "Next dose" (Phase 10) | M5 |

---

## ✅ Done

All of these landed in the 2026-10-12 fix session (uncommitted at time of writing; see PROGRESS_LOG). JS is verified by
`npm test` (7 suites × 2 timezones), `tsc`, Metro Android + web bundles, and a browser run. Native parts depend on
DEBT-010.

### Original review findings
- **BUG-001 · P0 — Medicines never scheduled reminders.** `src/domain/medicineReminders.ts` plans 14 days of dose
  alarms (`dose_<medId>_<YYYYMMDD>_<HHmm>`, payload `{kind, medicineId, scheduledTime}`); `reminderCoordinator`
  syncs them on medicine edit/delete/pause, dose logs, routine changes, settings changes, startup, and foreground.
  Verified in browser: add medicine → 14 alarms → rings → Taken logs dose and stock 30→29.
- **BUG-002 · P0 — Native sync dropped `scheduleId`/`category`.** Carried in the native payload (`_scheduleId`,
  `_category`) and mapped back; `getScheduledAlarms()` no longer overwrites the JS store.
- **BUG-003 · P0 — Backup/restore incomplete.** `src/services/DataManagementService.ts`: one versioned file
  (`lifetrack-backup` v2) with every store, zod-validated, all-or-nothing, accepts both v1 legacy formats, alarms
  re-planned after restore; share-sheet export. Covered by `src/services/__tests__/dataManagement.test.ts`.
- **BUG-004 · P1 — Notification actions never reached app data.** Native queues every action (FIRED, TAKEN,
  SNOOZED, SKIPPED, DISMISSED, MISSED) in `AlarmStorage` pending actions; JS drains them at startup and on
  foreground/focus and logs the dose + stock via `reminderCoordinator.processNativeActions()`.
- **BUG-005 · P1 — Alarms ran out after 14 days without opening the app.** Native roll-forward: each occurrence
  carries a repeat rule; when it fires (or is acted on early, or is missed while the phone was off) native schedules
  the same reminder one window later with the id the JS planner would generate. See ADR-0004.
- **BUG-006 · P2 — `interval` medicines ignored `intervalHours`.** `getMedicineDoseTimes()` shared by Today and
  the planner (floor(24/interval) doses around the clock). Slot/log matching is exact-time first.
- **BUG-007 · P2 — "Clear logs" cleared the wrong store.** Logs live only in StorageService; Profile reads and
  clears them through `reminderService`.
- **DEBT-001 · P0 — Two persistence layers.** One engine (`src/services/kvStore.ts`) under both StorageService
  (documents) and DatabaseService (tables), one owner per piece of data, duplicate tables/keys removed by
  `src/services/migrations.ts` (v1 → v2). ADR-0003 updated.
- **DEBT-002 · P1 — Duplicated settings/profile fields.** Onboarding flag → `settings.hasCompletedOnboarding`; shift
  on/off → `shiftConfig.isEnabled` only; wake/sleep → routine only (profile fields removed); default snooze →
  settings only; single profile type `UserProfileRecord`; language/theme no longer mirrored to extra localStorage keys.
- **DEBT-003 · P1 — 1-second polling loop.** Removed. Native rings by itself; the in-app engine (web/no module)
  sleeps until the next due alarm (max 60 s) and never writes on read. The Alarms tab's own 1 s fire-and-cancel loop
  was removed too (BUG-020).
- **DEBT-004 · P2 — AI Studio leftovers.** Removed `@google/genai`, `express`, `dotenv`, `recharts`, `motion`,
  `lucide-react`, `vite` + plugins, `tailwindcss`, `autoprefixer`, `esbuild`, `@types/jest`, `@types/express`,
  `metadata.json`, `.env.example`, codemod scripts, `scratch/`, `NativeCodeInspectorModal`. Package renamed
  `lifetrack@1.0.0`.
- **DEBT-005 · P2 — Broken web preview.** Vite path deleted; `npm run web` (`expo start --web`) bundles and runs.
  `.claude/launch.json` has a `web` config on port 8090.
- **DEBT-006 · P2 — `alarmConflict.test.ts` never ran.** Converted to `node:assert`; `scripts/run-tests.mjs`
  auto-discovers every `__tests__/*.test.ts` and runs each in Asia/Kolkata and America/New_York.
- **DEBT-007 · P2 — `features/poc/` + 1,000-line screens.** Moved to `alarms/`, `reliability/`, `settings/`;
  extracted `EditProfileModal`, `ReminderLogsModal`, `BackupRestoreModal`, `ShiftOverrideModal`,
  `AddRotationStepModal`, `ShiftTypePicker`, `RecurrenceOptions`. Largest screen is now 945 lines.
- **DEBT-008 · P3 — Navigation.** Android back button returns to Today before exiting; deep links
  `lifetrack://today|medicines|alarms|health|profile`. (A navigation library is still optional; revisit with FEAT-005.)
- **FEAT-001 · P0 — Medicine reminders end to end** (BUG-001 + BUG-004 + BUG-005).

### Reminders for everything (2026-10-13)
- **FEAT-016 · P1 — Reminder notifications beyond medicines, with user control.**
  - Medicines: per-medicine **reminder style** (ringing full-screen alarm or notification) and **tone** picked from
    the phone's alarm/notification/ringtone sounds with preview (`TonePickerModal`). Native posts each tone on its
    own channel (`<base>__tone_<hash>`, Android 8+ binds sound to channels); the ringing service plays that tone.
  - Daily Routine: a bell switch per milestone (wake, meals, exercise, wind-down, sleep) and per custom block; off by
    default. Planned 14 days ahead with native roll-forward (`src/domain/routineReminders.ts`).
  - Shifts: evening "Tomorrow: Night shift" notice before each change, switch + time (±30 min) on the Shift screen,
    on by default when shifts are enabled; planned 30 days ahead by JS (`src/domain/shiftNotices.ts`).
  - Routine and shift notifications have a single **OK** button and open the app when tapped.
  - Verified on the emulator: routine block and medicine reminders scheduled natively (14 each).
- **BUG-028 · P2 — "Next up" and shift cards looked broken on Android** (grey band behind a lighter strip):
  translucent backgrounds + `shadow-sm` elevation. Now opaque tints via `tintOver()` (`src/utils/color.ts`).
- **BUG-027 · P1 — Routine-anchored medicines lost their anchor on save** (`upsert` never copied `routineTiming`,
  so they reminded at 08:00). Fixed; covered by `src/data/__tests__/medicinesRepository.test.ts`.

### Lint and health pass (2026-10-12, later the same day)
- **DEBT-011 · P1 — No real linter.** `npm run lint` was only `tsc` without `strict`. Now: tsconfig `strict`,
  `noUnusedLocals`, `noUnusedParameters` + ESLint 9 with `eslint-config-expo` (React, React Hooks/Compiler rules,
  import rules). Fixed 79 unused imports/variables and 42 ESLint problems (hooks: synchronous setState in effects,
  impure `Date.now()` during render, functions used before declaration). Result: 0 errors, 0 warnings.
- **BUG-025 · P0 — AsyncStorage 3.1.1 installed but SDK 57 expects 2.2.0.** Native/JS mismatch is the likely cause
  of the earlier "AsyncStorage native module is null → in-memory" fallback, i.e. data lost on restart. Pinned to
  2.2.0 via `expo install`; `kvStore` accepts both export shapes. Re-verify persistence on device (part of DEBT-010).
- **BUG-026 · P2 — Invalid `splash` key in app.json for SDK 57** (splash config ignored). Moved to the
  `expo-splash-screen` config plugin. `expo-doctor`: 21/21 checks pass.
- **DEBT-012 · P3 — Theme/language still mirrored to web-only localStorage keys.** Removed; migration v2 deletes the
  old keys.
- With the keyboard open, the first tap on any button only closed the keyboard (seen on the emulator in the medicine
  form). Every ScrollView now sets `keyboardShouldPersistTaps="handled"`.
- Quick menu (App.tsx): the backdrop touchable wrapped the whole menu, giving nested `<button>`s on web (invalid HTML)
  and making TalkBack treat the entire menu as one element. The backdrop is now a sibling `Pressable` behind the card.
- Also: new-medicine form leaked the previous medicine's routine anchor/offset (forms now mount fresh on open);
  Today's "overdue / next up" now refresh every minute; dead in-app tone-picker state and an unused 5 s log fetch on
  the Alarms tab removed.

### Found and fixed during the fix session
- **BUG-008 · P0** Occurrence ids and default dates used the UTC date (`toISOString`), so early-morning doses in
  India got yesterday's id. All calendar dates are local now (`src/domain/dates.ts`); tests run in two timezones.
- **BUG-009 · P1** Replanning passed `maxCount = 5`, so daily schedules covered 5 days, not 14. Per-rule policy in
  `getSchedulePlanPolicy()`.
- **BUG-010 · P1** Full alarms played two tones at once (service + activity), and opening the status-bar alarm-clock
  shortcut started ringing. Only the foreground service makes sound now.
- **BUG-011 · P1** Lock-screen Snooze used a hard-coded 10 minutes and the medicines channel and dropped the payload;
  Dismiss didn't clear the alarm. All buttons go through `AlarmActionHandler`.
- **BUG-012 · P1** Onboarding's "I work shifts" wrote a flag nothing read. It now sets `shiftConfig.isEnabled`
  (migration carries old choices over). Verified in browser.
- **BUG-013 · P1** Vibration, full-screen, default snooze, and auto-dismiss settings were saved but never applied to
  alarms. Applied on every schedule; changing them re-syncs all alarms.
- **BUG-014 · P2** Wake/sleep edited on the Profile screen never reached the routine (so reminders ignored it).
- **BUG-015 · P1** Today's "Snooze" said "snoozed 15 minutes" but scheduled nothing. It now schedules a real reminder
  using the default snooze setting.
- **BUG-016 · P1** A full alarm rang forever (`autoDismissMinutes` unused). Service auto-stops, logs MISSED, leaves a
  silent notification with the actions.
- **BUG-017 · P1** `BootReceiver` dropped alarms missed while the phone was off and broke their repeating series.
  It now records MISSED and keeps the series going; late alarms ring once without shifting the series time.
- **BUG-018 · P2** Every-N-days schedules without a start date re-anchored to "today" on each replan (phase drift).
- **BUG-019 · P2** Health Check showed notifications as allowed even when denied. Added full-screen-intent row.
- **BUG-020 · P1** The Alarms tab polled every second and fired/cancelled due alarms itself, racing the engine and
  breaking native series. Display-only now; "Clear all" re-plans managed reminders.
- **BUG-021 · P3** Shift override and rotation pickers ignored custom shift types.
- **BUG-022 · P2** New-alarm form was pre-filled with "Daily Insulin Dose / 10 units before dinner"; date fields
  accepted any text (invalid dates silently produced no alarms). Empty defaults + validation.
- **BUG-023 · P2** Native notification/lock-screen buttons were English only. Labels come from i18n per alarm.
- **BUG-024 · P3** Today kept showing yesterday's schedule after midnight (date memoized once); reloads on
  foreground and data changes.
