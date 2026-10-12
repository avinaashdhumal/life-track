# AGENTS.md — LifeTrack

Read this before you change anything. It is the entry point for every coding agent (Claude Code, Codex, Cursor, Gemini, etc.).
`CLAUDE.md` imports this file; keep the shared rules here, not there.

## What this project is

LifeTrack is an **offline-first, privacy-first Android health tracker** (Expo SDK 57 / React Native 0.86 / TypeScript).
Its core promise is **medicine reminders that always ring** (native Kotlin `AlarmManager.setAlarmClock()`), plus medicine
stock and safety rules, a daily routine, and an optional rotating shift schedule. No login, no cloud, no analytics.
All data stays on the device.

Primary users: people on regular medication (often elderly or caring for a family member), shift workers, and
Indian households (the app ships in English, Hindi, Marathi, and Spanish).

## Read these before starting a task

| File | Read it when |
| --- | --- |
| [docs/STATUS.md](docs/STATUS.md) | Always. What actually works today vs. what only looks done. |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Always. Every open bug, debt item, and feature has an ID (`BUG-xxx`, `DEBT-xxx`, `FEAT-xxx`). |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Before touching storage, alarms, the native module, or adding a feature. |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Before writing code: i18n, theming, a11y, domain purity, tests, commits. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | When choosing what to build next or judging scope. |
| [docs/decisions/](docs/decisions/) | Before reversing an architectural choice. |
| [docs/PROGRESS_LOG.md](docs/PROGRESS_LOG.md) | To see what the last session did and left unfinished. |

## Golden rules (do not break)

1. **Alarm reliability is the product.** Never weaken the native path in `modules/alarm-engine/` (exact alarms, boot
   restore, full-screen intent, foreground service). Any change there needs a manual device test (see README "Physical
   Android Phone Testing Guide") and must be noted in `docs/PROGRESS_LOG.md`.
2. **Offline and private.** Do not add network calls, analytics, crash reporters, ads, or cloud SDKs.
3. **Medication safety logic lives in pure domain code** (`src/domain/`) with tests. No React or React Native imports
   in `src/domain/`. Any change to dose-gap, max-daily-dose, stock, or scheduling math needs a test.
4. **Every user-facing string goes through i18n** and must be added to all four locale files
   (`src/i18n/locales/{en,hi,mr,es}.json`). `npm test` fails on key mismatch.
5. **Never lose user data.** Changing a stored shape means a step in `src/services/migrations.ts`, not renaming a
   key. Every store must be in the backup (`DataManagementService`) and its round-trip test.
6. **One storage engine.** Only `src/services/kvStore.ts` touches AsyncStorage. Each piece of data has exactly one
   owner store (ARCHITECTURE.md §3). Don't duplicate fields across stores.
7. **Reminders go through the coordinator.** Anything that should change scheduled alarms goes through
   `reminderCoordinator` or a repository change event it listens to. Screens never fire or cancel alarms on timers.
   The alarm id format is a contract with the native engine (ADR-0004).
8. **Local dates only.** Use `src/domain/dates.ts`; never `toISOString()` for a calendar date.

## Commands

```bash
npm install
npm test              # i18n checks + every src/**/__tests__/*.test.ts in two timezones
npm run lint          # tsc --noEmit (strict typecheck)
npm run web           # expo start --web: quick UI check (in-app alarm engine, no native module)
npx expo export --platform android   # verifies the JS bundles for Android (no JDK needed)
npx expo prebuild -p android         # regenerate android/ (gitignored, CNG)
npx expo run:android --device        # dev build on a USB-connected phone (needs a JDK + Android SDK)
```

The native module was rewritten on 2026-10-12 and **has not been compiled or device-tested yet** (DEBT-010). Do that
before building anything else on top of the native engine.

## Definition of done (every task)

- [ ] `npm test` and `npm run lint` pass.
- [ ] New strings are in all 4 locales; new interactive elements have `accessible`, `accessibilityRole`, `accessibilityLabel`.
- [ ] Domain/service logic changes have tests in a `__tests__/` folder (picked up automatically).
- [ ] Native (Kotlin) changes were built with `npx expo run:android`, and you stated in the log whether they were tested on a device.
- [ ] Docs updated (next section).

## How to keep progress tracked (required)

When you **finish** (or stop partway through) a task:

1. **`docs/BACKLOG.md`**: change the item's status (`todo` → `in-progress` → `done`), and add any new bugs or debt you
   found with the next free ID. Don't delete done items; move them to the "Done" section with the date.
2. **`docs/STATUS.md`**: update the feature matrix row if a capability changed, and bump "Last updated".
3. **`docs/PROGRESS_LOG.md`**: append one dated entry (newest on top): what changed, what was verified and how, and
   what is left or risky.
4. **`docs/decisions/`**: add an ADR if you made a choice that a future agent might otherwise undo.
5. Commits use Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`) and reference the
   backlog ID, e.g. `fix(alarms): keep scheduleId on native sync (BUG-002)`.

If you find the docs disagree with the code, **the code wins**. Fix the docs in the same change.

## Repository map (short)

```
App.tsx                         Expo entry → src/App.tsx
src/App.tsx                     Shell: bootstrap (preload → migrations → reminders), tabs, back button, deep links
src/domain/                     Pure TS + zod: alarm, dates, reminderPlanner, medicine, medicineReminders, routine, shift
src/data/                       Repositories (medicines, profile, routine, shift) + ChangeEmitter events
src/services/kvStore.ts         The only AsyncStorage access
src/services/StorageService.ts  Documents: settings, schedules, logs, routine, shift config
src/services/DatabaseService.ts Tables: medicines, dose history, health profile
src/services/migrations.ts      Versioned storage migrations (run at startup)
src/services/DataManagementService.ts  Backup / restore / delete-all
src/services/AlarmEngineService.ts     JS ↔ native alarm bridge, diff-based sync, health check
src/services/reminderCoordinator.ts    Medicine reminder sync, native action drain, in-app engine
src/features/<feature>/         today, medicines, alarms, reliability, settings, routine, shift, onboarding
src/i18n/                       i18next setup + 4 locale JSONs
src/context/ThemeContext.tsx    Light/dark palette: use `useTheme().colors`, never hard-code colors
modules/alarm-engine/           Kotlin: AlarmManager, receivers, action handler, foreground service, lock-screen UI
plugins/withAlarmEngine.cjs     Config plugin that patches AndroidManifest for the module
scripts/run-tests.mjs           Test runner (auto-discovery, two timezones)
docs/                           Agent and project context (this system)
```

`android/` and `ios/` are generated by `expo prebuild` and are gitignored. Don't hand-edit them; change the module
or the config plugin instead.
