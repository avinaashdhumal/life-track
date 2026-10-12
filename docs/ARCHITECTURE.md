# Architecture

> Describes the code **as it is**. If you change the architecture, update this file in the same commit.
> Last verified 2026-10-12 after the fix session (see PROGRESS_LOG).

## 1. Stack

| Layer | Tech |
| --- | --- |
| App framework | Expo SDK 57 (Continuous Native Generation, `android/` gitignored), React Native 0.86, React 19.2 |
| Language | TypeScript 6 (`tsc --noEmit` is the linter) |
| Styling | `twrnc` (Tailwind classes for RN) + palette from `src/context/ThemeContext.tsx` |
| Icons | `lucide-react-native` |
| Validation | `zod` v4 (medicine, dose-log, and backup schemas) |
| i18n | `i18next` + `react-i18next` + `expo-localization`; locales `en`, `hi`, `mr`, `es` |
| Persistence | `@react-native-async-storage/async-storage` behind `src/services/kvStore.ts` |
| Native | Local Expo module `modules/alarm-engine` (Kotlin) + config plugin `plugins/withAlarmEngine.cjs` |
| Web (dev only) | `expo start --web` (react-native-web). There is no Vite build. |
| Build | EAS (`eas.json`: development / preview APK / production) or local `./gradlew assembleRelease` |

There is no navigation library. `src/App.tsx` switches screens with `activeTab` state and handles the Android back
button and `lifetrack://` deep links itself.

## 2. Layering

```
 UI  src/features/**  ──►  Repositories  src/data/*Repository.ts  ──►  Stores  StorageService / DatabaseService ──► kvStore ──► AsyncStorage
  │                              │ change events (ChangeEmitter)
  │                              ▼
  │                    reminderCoordinator ──► AlarmEngineService ──► modules/alarm-engine (Kotlin) ──► AlarmManager
  │                              ▲                                            │ pending actions queue
  └──────────► Domain  src/domain/*  (pure functions, zod)  ◄─────────────────┘ (drained by the coordinator)
```

Rules:
- `src/domain/` is pure: no React, React Native, storage, or native imports. It is tested with plain `tsx`.
- UI calls repositories (`src/data/`) and, for reminders, `reminderCoordinator`/`reminderService`.
- Repositories never import native or UI code. They emit change events (`medicinesRepository.changes`,
  `routineRepository.changes`, `shiftRepository.changes`) that the coordinator and screens subscribe to. That keeps
  repositories testable in Node.

## 3. Persistence: one engine, two typed views

`kvStore` (`src/services/kvStore.ts`) is the only thing that touches AsyncStorage. It keeps a sync cache (for
first-frame theme/language), and falls back to in-memory when no backend exists (Node tests, Expo Go without the
module). Every piece of data has exactly one owner:

### 3a. `StorageService` (documents)

| Key | Contents |
| --- | --- |
| `@lifetrack:settings:v1` | `AppSettings`: theme, language, tone, vibration, full-screen, default snooze, auto-dismiss, **hasCompletedOnboarding** |
| `@lifetrack:schedules:v1` | `RecurringSchedule[]` (generic reminders from the Alarms tab) |
| `@lifetrack:event_logs:v1` | `ReminderLogEntry[]` (FIRED/TAKEN/SNOOZED/SKIPPED/DISMISSED/MISSED/SCHEDULED), cap 300 |
| `@lifetrack:daily_routine:v1:<profileId>` | `DailyRoutine` (wake, meals, sleep… the only home of wake/sleep) |
| `@lifetrack:shift_config:v1` | `ShiftConfig` (`isEnabled` is the only shift on/off switch) |
| `@lifetrack:active_alarms:v1` | `AlarmItem[]`, **only used when the native engine is absent** (web / Expo Go) |

### 3b. `DatabaseService` (tables, JSON array per table under `@lifetrack:db:<table>`)

| Table | Contents |
| --- | --- |
| `medicines` | `Medicine` (zod) |
| `medicine_doses` | `DoseLogEntry` (taken / skipped / snoozed / missed) |
| `user_profile` | `UserProfileRecord` (name, phone, blood group, emergency contact, conditions, allergies) |

### 3c. Other keys
- `@lifetrack:schema_version`: storage schema version (currently 2). See `src/services/migrations.ts`.
- Native `SharedPreferences` `lifetrack_native_alarms`: `active_alarms` (upcoming), `fired_alarms` (rung, awaiting
  action), `pending_actions` (queue for JS), `last_fired_alarm`, `alarm_event_logs`. Owned by Kotlin.

### 3d. Migrations
`runMigrations()` runs at startup before anything reads data (`bootstrapApp()` in `App.tsx`). v1 → v2 moved the
onboarding flag into settings, applied the onboarding shift choice, moved Profile wake/sleep into the routine, and
deleted the duplicate v1 tables and keys. Add a step for every stored-shape change; never rename a key in place.

### 3e. Backup
`DataManagementService` exports `{format: 'lifetrack-backup', schemaVersion: 2, data: {settings, profile, routine,
shiftConfig, schedules, medicines, doses, logs}}`. Restore validates the whole file first (zod), accepts the two v1
legacy formats, writes everything, then the caller runs `reminderCoordinator.rebuildAll()`. Alarms are never backed up;
they're derived.

## 4. Reminders

### 4a. Planning (pure domain)
- **Ids are a contract with native:** `${seriesPrefix}_${YYYYMMDD local}_${seriesSuffix}`
  (`buildOccurrenceId`). Schedules: prefix = schedule id, suffix = `HHmm` of `timeOfDay`. Medicines: prefix
  `dose_<medicineId>`, suffix = dose `HHmm`. Snoozes append `_snooze` (never repeated). Dates are **local**
  (`src/domain/dates.ts`). Never use `toISOString()` for a calendar date.
- `getSchedulePlanPolicy(schedule)`: daily/weekly plan exactly 14 days and repeat every 14; every-N-days plans and
  repeats `N × ceil(14/N)` days; monthly (1 year) and custom dates (3 years) are planned far ahead and don't repeat
  natively; `once` is single.
- `planMedicineReminders(medicine, opts)` (`src/domain/medicineReminders.ts`): dose times from
  `getMedicineDoseTimes()` (also used by Today), 14-day window, skips slots already settled (taken/skipped; snoozed
  for planning) but schedules their successor so the native series continues. PRN and paused → none.
- `planNextInSeries(alarm, now)`: JS twin of the native roll-forward, used by the in-app engine and tests.

### 4b. Sync (`reminderCoordinator`, `AlarmEngineService.syncAlarms`)
- Diff-based: for a family of alarms (`isOwned`), cancel owned alarms not desired (keeping valid snoozes), schedule
  desired alarms that are missing or changed (`force` reschedules all, e.g. after settings or language change).
- Triggers: app start (`refresh({force})` after migration), app foreground/focus, medicine upsert/delete/dose,
  routine save, alarm-relevant settings change, restore, Alarms-tab "Clear all".
- All coordinator work is serialized in one promise queue.
- Settings applied per alarm: full-screen on/off (style), vibration, auto-dismiss minutes, default snooze, and
  localized labels (title/message via i18n; button labels passed to native).

### 4c. Native engine (works with JS dead)
1. `scheduleExact` stores the alarm (with repeat rule, labels, settings) and calls `setAlarmClock()`.
2. `AlarmReceiver` on trigger: moves it from upcoming to fired, queues `FIRED`, rolls the series forward
   (`scheduleNextInSeries`), posts the notification, starts `AlarmForegroundService` (the **only** source of sound and
   vibration) and the lock-screen `AlarmFullScreenActivity` (UI only).
3. Any action (notification button, lock-screen button, auto-dismiss timeout) goes through `AlarmActionHandler`:
   stops ringing, clears notifications, queues the action, schedules a snooze copy if needed, and broadcasts
   `ALARM_CLOSED` so an open lock-screen UI closes. Acting on an upcoming alarm (from the status-bar alarm-clock
   shortcut) cancels it and rolls its series. Auto-dismiss queues `MISSED` and leaves a silent notification with the
   actions.
4. `BootReceiver` (boot, package update, time/timezone change): re-registers upcoming alarms; rings alarms missed by
   <15 min once without shifting the series; records older ones as `MISSED`; always keeps series alive.
5. JS drains `pending_actions` (`drainPendingActions`) on startup and foreground: logs the reminder event and, for
   medicine alarms, the dose (`taken`/`skipped`/`snoozed`/`missed`) and stock.

### 4d. Without the native module (web, Expo Go)
`reminderCoordinator.startInAppEngine()` stores alarms in `@lifetrack:active_alarms:v1`, sleeps until the next due
alarm (≤ 60 s), fires it (FIRED log, roll forward with `planNextInSeries`), and `App.tsx` shows `FullScreenAlarmModal`.
Actions go through `reminderCoordinator.handleInAppAction()`, the same dose-logging path as native.

### Notification channels
`medicines`, `appointments`, `routine`, `exercise`, `water_meals`, `habits`, `summaries`.

## 5. Medicines, routine, shifts

- `Medicine.scheduleType`: `fixed_time` (`timesOfDay[]`), `interval` (first time + every `intervalHours`, around the
  clock; not offered in the form UI yet), `prn_as_needed`, `routine_relative` (`routineTiming: {anchor, offsetMinutes}`).
- `generateTodayDoseSlots()` builds Today's cards; a slot matches its dose log by exact `scheduledTime` first. Overdue =
  more than 60 min late with no log.
- `medicinesRepository.logDose()` runs min-gap and max-daily checks (warnings, not blocks), decrements stock on
  `taken`, stores a `DoseLogEntry`, and emits a change event.
- Shifts: fixed or rotating cycle, custom shift types, date overrides, midnight-crossing shifts, 90-day calendar,
  transition dose-gap check. Dose times still follow the single `DailyRoutine` (FEAT-012).

## 6. UI shell

- Tabs (`MainTabType`): `today`, `medicines`, `poc_test` ("Alarms"), `health_check`, `profile_settings`.
- Feature folders: `today/`, `medicines/`, `alarms/` (Alarms tab, form, conflict modal, timeline, tone settings, in-app
  ringing modal), `reliability/` (Health Check), `settings/` (Profile & Settings + its modals), `routine/`, `shift/`,
  `onboarding/`.
- Startup: loading spinner until `bootstrapApp()` (preload settings → migrations → coordinator start/refresh) finishes,
  then onboarding or the main shell.

## 7. Testing

- `npm test` = `test-i18n-theme.cjs` (locale parity, every `t('key')` used in `src/` exists, a11y audit of every
  `.tsx` with interactive elements, theme tokens) + `scripts/run-tests.mjs` (every `src/**/__tests__/*.test.ts`,
  each run in Asia/Kolkata and America/New_York).
- Domain tests: `alarm`, `alarmConflict`, `medicine`, `medicineReminders`, `reminderPlanner` (id/roll-forward
  contract, DST, local dates), `shift`. Service tests: `dataManagement` (migration, backup round trip, legacy
  restore, rejection without writes).
- Bundling check: `npx expo export --platform android` (no JDK needed).
- Native code: manual device tests (README + DEBT-010 checklist).
