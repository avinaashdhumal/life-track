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
2. **Offline and private.** Do not add network calls, analytics, crash reporters, ads, or cloud SDKs. `@google/genai`,
   `express`, `dotenv`, and `recharts` are unused leftovers from an AI Studio scaffold (DEBT-004) — don't start using them.
3. **Medication safety logic lives in pure domain code** (`src/domain/`) with tests. No React or React Native imports
   in `src/domain/`. Any change to dose-gap, max-daily-dose, stock, or scheduling math needs a test.
4. **Every user-facing string goes through i18n** and must be added to all four locale files
   (`src/i18n/locales/{en,hi,mr,es}.json`). `npm test` fails on key mismatch.
5. **Never lose user data.** Storage keys are versioned (`@lifetrack:*:v1`). Changing a stored shape means writing a
   migration, not renaming a key. Backups must cover every store (see BUG-003).
6. **Don't add a third storage layer.** There are already two (DEBT-001). New data goes into `DatabaseService` tables
   via a repository in `src/data/` until DEBT-001 is resolved.

## Commands

```bash
npm install
npm test              # i18n parity + a11y audit + domain tests (node assert via tsx)
npm run lint          # tsc --noEmit (strict typecheck)
npx expo prebuild -p android   # regenerate android/ (gitignored, CNG)
npx expo run:android --device  # dev build on a USB-connected phone
```

`npm run dev` / `npm run build` (Vite web preview) is currently **broken** — see DEBT-005. Use a device or emulator.
`src/domain/__tests__/alarmConflict.test.ts` uses Jest globals and is **not** run by `npm test` (DEBT-006).

## Definition of done (every task)

- [ ] `npm test` and `npm run lint` pass.
- [ ] New strings are in all 4 locales; new interactive elements have `accessible`, `accessibilityRole`, `accessibilityLabel`.
- [ ] Domain logic changes have tests in `src/domain/__tests__/`, added to the `test` script in `package.json`.
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
App.tsx                      Expo entry → src/App.tsx
src/App.tsx                  Shell: onboarding gate, top bar, 5 bottom tabs, global alarm loop, modals
src/domain/                  Pure TS logic + zod schemas (alarm, reminderPlanner, medicine, routine, shift, alarmConflict)
src/data/                    Repositories (medicines, profile, routine, shift) — UI talks to these
src/services/                StorageService (AsyncStorage KV), DatabaseService (table-like store),
                             AlarmEngineService (JS ↔ native bridge + replanning)
src/features/<feature>/      Screens and modals. `poc/` holds Phase 0 screens that are still live in the app.
src/i18n/                    i18next setup + 4 locale JSONs
src/context/ThemeContext.tsx Light/dark palette — use `useTheme().colors`, never hard-code colors
modules/alarm-engine/        Local Expo module: Kotlin AlarmManager, receivers, foreground service, full-screen activity
plugins/withAlarmEngine.cjs  Config plugin that patches AndroidManifest for the module
docs/                        Agent and project context (this system)
```

`android/` and `ios/` are generated by `expo prebuild` and are gitignored. Don't hand-edit them; change the module
or the config plugin instead.
