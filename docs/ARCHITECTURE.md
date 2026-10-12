# Architecture

> Describes the code **as it is**, including the messy parts. If you change the architecture, update this file in the
> same commit. Last verified against commit `5877d62` (2026-10-12).

## 1. Stack

| Layer | Tech |
| --- | --- |
| App framework | Expo SDK 57 (Continuous Native Generation, `android/` gitignored), React Native 0.86, React 19.2 |
| Language | TypeScript 6 (`tsc --noEmit` is the linter) |
| Styling | `twrnc` (Tailwind classes for RN) + palette from `src/context/ThemeContext.tsx` |
| Icons | `lucide-react-native` |
| Validation | `zod` v4 (medicine and dose-log schemas) |
| i18n | `i18next` + `react-i18next` + `expo-localization`; locales `en`, `hi`, `mr`, `es` |
| Persistence | `@react-native-async-storage/async-storage` (with in-memory/localStorage fallback) |
| Native | Local Expo module `modules/alarm-engine` (Kotlin) + config plugin `plugins/withAlarmEngine.cjs` |
| Build | EAS (`eas.json`: development / preview APK / production) or local `./gradlew assembleRelease` |

There is no navigation library. `src/App.tsx` switches screens with `activeTab` state, and modals are local booleans.

## 2. Layering

```
 UI  src/features/**  ──►  Repositories  src/data/*Repository.ts  ──►  Services  src/services/*  ──►  AsyncStorage
  │                                                                       │
  └──────────────► Domain  src/domain/*  (pure functions, zod)  ◄─────────┘
                                                                          │
                                         AlarmEngineService ──► modules/alarm-engine (Kotlin) ──► AlarmManager
```

Rules:
- `src/domain/` must stay pure: no React, no React Native, no storage. That keeps it testable with plain `tsx`.
- UI should call repositories (`src/data/`). Some screens still call services directly; that's existing debt, so don't
  copy it. Example: `ProfileSettingsScreen` → `databaseService`, `AlarmTestScreen` → `reminderService`.

## 3. Persistence: two stores (important)

There are **two independent persistence layers**, both on AsyncStorage. This is the biggest structural debt
(DEBT-001, ADR-0003).

### 3a. `StorageService` (`src/services/StorageService.ts`): key-value

| Key | Contents | Read by |
| --- | --- | --- |
| `@lifetrack:schedules:v1` | `RecurringSchedule[]` (generic alarms created in the Alarms tab) | AlarmEngineService |
| `@lifetrack:active_alarms:v1` | `AlarmItem[]`: planned alarm instances (JS mirror of native) | AlarmEngineService, App loop |
| `@lifetrack:event_logs:v1` | `ReminderLogEntry[]`, capped at 300 | Alarms tab |
| `@lifetrack:settings:v1` | `AppSettings` (theme, language, tone, snooze, vibration…) | ThemeContext, i18n, Profile |
| `@lifetrack:user_profile:v1` | `UserProfile` (minimal) | mostly unused, superseded by the DB profile |
| `@lifetrack:daily_routine:v1:<profileId>` | `DailyRoutine`: **source of truth** for routine | routineRepository |
| `@lifetrack:shift_config:v1` | `ShiftConfig`: **source of truth** for shifts | shiftRepository |

It keeps a synchronous in-memory cache (`getSyncSetting`) so theme and language can render on the first frame.

### 3b. `DatabaseService` (`src/services/DatabaseService.ts`): "tables"

Each table is a JSON array stored under `@lifetrack:db:<table>`, loaded into a `Map` on startup. The "SQL" and
"transactions" in comments are simulated; there is no SQLite.

| Table | Contents | Source of truth? |
| --- | --- | --- |
| `medicines` | `Medicine` (zod-validated) | **Yes** |
| `medicine_doses` | `DoseLogEntry` (taken/skipped/snoozed/missed) | **Yes** |
| `user_profile` | `UserProfileRecord` (name, blood group, emergency contact, conditions, allergies) | **Yes** |
| `app_settings` | `{key,value}` rows: onboarding flag, shift-feature flag, default snooze | Partly (also mirrored, see below) |
| `daily_routines`, `shift_config` | Best-effort **mirrors** written by routine/shift repositories | No, never read |
| `schedules`, `scheduled_alarms`, `reminder_logs` | Defined but effectively unused (alarm code uses StorageService) | No |

### 3c. Extra loose keys
- `@lifetrack:has_completed_onboarding`, `@lifetrack:shift_feature_enabled`: written by `profileRepository` directly
  to AsyncStorage **and** to `app_settings` (it reads AsyncStorage first).
- Native `SharedPreferences` `lifetrack_native_alarms` (`active_alarms`, `last_fired_alarm`, `alarm_event_logs`):
  owned by Kotlin and survives JS being dead.

**Known consequences:** backup/restore covers only the DB tables and restores routine and shift into mirrors nobody
reads (BUG-003). `defaultSnoozeMinutes` exists in both stores (DEBT-002).

## 4. Alarm pipeline

### Scheduling (JS → native)
1. Something calls `reminderService.scheduleAlarm(params)` (`src/services/AlarmEngineService.ts`). Today the callers
   are the Alarms tab (`features/poc/AlarmTestScreen.tsx`, `AlarmFormScreen.tsx`), the in-app snooze in `App.tsx`, and
   recurring-schedule replanning. **Medicines do not call it** (BUG-001).
2. `modules/alarm-engine/index.ts` → `requireNativeModule('AlarmEngine').scheduleAlarm`. On web, or when the module is
   missing, every native call quietly returns `false`/`[]`.
3. Kotlin `AlarmSchedulerHelper.scheduleExact` saves the alarm in `AlarmStorage` (SharedPreferences) and calls
   `AlarmManager.setAlarmClock()`, falling back to `setExactAndAllowWhileIdle` / `setExact`.
4. JS mirrors the alarm into `@lifetrack:active_alarms:v1` and writes a `SCHEDULED` log.

### Recurring schedules
- `RecurringSchedule` (daily / weekly / every-N-days / monthly / custom dates) lives in StorageService.
- `replanRecurringSchedules()` expands each enabled schedule for the **next 14 days**
  (`planOccurrencesForRecurringSchedule`) and schedules any occurrence id not already active.
- Replanning runs only when the `AlarmEngineService` singleton is constructed (app start) and after schedule CRUD.
  Nothing replans in the background, so if the app isn't opened for 14 days the alarms run out (BUG-005).

### Firing (native, works with JS dead)
1. `AlarmReceiver` gets `ALARM_TRIGGER` → takes a wakelock → `setLastFired`, `logEvent("FIRED")`.
2. Posts a notification on the alarm's channel with **Taken / Snooze / Skip** actions (`AlarmNotificationHelper`).
3. If `isFullAlarm`: starts `AlarmForegroundService` (looping audio + vibration) and launches
   `AlarmFullScreenActivity` over the lock screen.
4. Notification actions are handled natively. `ACTION_TAKEN` and `ACTION_SKIP` remove the alarm and write a native event
   log. `ACTION_SNOOZE` schedules `<id>-snooze`.
   **None of these reach JS.** A "Taken" tapped on the notification does not log a dose or decrement stock (BUG-004).
5. `BootReceiver` reschedules every stored alarm on `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET`, and
   `TIMEZONE_CHANGED`.

### In-app loop (`src/App.tsx`)
A `setInterval` runs **every 1 s**. It calls `reminderService.getScheduledAlarms()`, which reads native alarms and
**writes them back to AsyncStorage** on every tick (DEBT-003). When an alarm's trigger time has passed, it cancels it,
logs `FIRED`, and shows `FullScreenAlarmModal` (Web Audio tone from `src/utils/audioAlarm.ts`). The in-app snooze uses
id `<id>_snooze`, while native uses `<id>-snooze`.

### Notification channels
`medicines`, `appointments`, `routine`, `exercise`, `water_meals`, `habits`, `summaries` (created in
`AlarmNotificationHelper.createChannels` when the module is created).

## 5. Medicines, routine, shifts

- `Medicine.scheduleType`: `fixed_time` (`timesOfDay[]`), `interval` (`intervalHours`; **not used by slot generation
  yet**, see BUG-006), `prn_as_needed`, `routine_relative` (`routineTiming: {anchor, offsetMinutes}`).
- `generateTodayDoseSlots(medicine, date, logs, routine)` in `src/domain/medicine.ts` builds the Today cards. A slot
  counts as `overdue` once it is more than 60 minutes late with no log entry.
- `medicinesRepository.logDose` runs the min-gap and max-daily checks (these return warnings and don't block),
  decrements stock on `taken`, and stores a `DoseLogEntry`.
- `DailyRoutine` (`src/domain/routine.ts`): wake, meals, sleep, wind-down, exercise anchors, plus custom blocks.
  `calculateRoutineRelativeClockTime` resolves an anchor plus an offset.
- `ShiftConfig` (`src/domain/shift.ts`): fixed or rotating cycle, custom shift types with per-shift routine templates,
  date overrides, midnight-crossing shifts, `generateShiftCalendar` (90 days), `validateShiftTransitionDoseGaps`, and
  `detectShiftChange`. The shift feature is OFF by default (onboarding asks).
- Today shows today's and tomorrow's shift, but dose times use the single `DailyRoutine`, not the per-shift template
  (FEAT-012).

## 6. UI shell

- Bottom tabs (`MainTabType` in `src/App.tsx`): `today`, `medicines`, `poc_test` (labelled "Alarms"),
  `health_check`, `profile_settings`.
- Top-right quick menu opens: Language/Theme, Notification tone, Routine, Shift schedule, test alarm.
- Onboarding (`features/onboarding/OnboardingScreen.tsx`) is 4 steps: privacy, Android reliability permissions,
  emergency profile, and shift opt-in. It is gated by `profileRepository.hasCompletedOnboarding()`.
- `features/poc/` is a misnomer. It holds production screens (Profile, Health Check, alarm forms) alongside dead files
  (`NativeCodeInspectorModal.tsx` is not imported anywhere).

## 7. Testing

- `test-i18n-theme.cjs`: locale key parity across 4 files, runtime i18n checks, and a grep-based a11y audit (each
  listed file must contain `accessible={true}`, `accessibilityRole=`, `accessibilityLabel=`).
- `src/domain/__tests__/*.test.ts`: plain `node:assert` scripts run with `npx tsx`, each listed explicitly in
  `package.json` → `scripts.test`. `alarmConflict.test.ts` uses Jest `describe/it` and is excluded (DEBT-006).
- There are no component or E2E tests. Native code is verified manually on a device (README).

## 8. Leftover scaffolding (from Google AI Studio)

`index.html`, `src/main.tsx`, `vite.config.ts`, `metadata.json` (declares server-side Gemini), `.env.example`
(GEMINI_API_KEY), `convert.cjs`/`convert.js`/`fix-imports.cjs` (one-off HTML→RN codemods), `scratch/`, and the deps
`@google/genai`, `express`, `dotenv`, `recharts`, `motion`, `lucide-react`, `vite`, `@vitejs/plugin-react`,
`@tailwindcss/vite`, `tailwindcss`, `autoprefixer`, `@types/jest`. The Vite build fails
(`Flow is not supported` because `react-native` isn't aliased to `react-native-web`). See DEBT-004 and DEBT-005.
