# Conventions

Follow the existing code. These are the patterns it already uses, written down so they stay consistent.

## TypeScript & structure
- Strict TS. `npm run lint` (`tsc --noEmit`) must be clean. Avoid `any` in new code; existing `any` is debt.
- Feature code goes in `src/features/<feature>/`. Use PascalCase `*Screen.tsx` for tabs/screens and `*Modal.tsx` for
  modals. Use named exports (`export const TodayScreen`).
- Domain code goes in `src/domain/<area>.ts`: pure functions, with zod schemas where data is persisted.
  Never import React, React Native, Expo, or services there.
- Data access goes in `src/data/<area>Repository.ts`: a class with a singleton export
  (`export const medicinesRepository = new MedicinesRepository()`). Screens call repositories, not stores.
  Repositories emit change events (`ChangeEmitter`) and must not import native or UI code (they run in Node tests).
- Reminders: anything that should change scheduled alarms goes through `reminderCoordinator` (or a repository change
  event it already listens to). Screens must never fire or cancel alarms on their own timers.
- IDs are prefixed strings: `med_<ts>_<rand>`, `dose_<ts>_<rand>` (dose logs), `rec_…`, `log_…`. Alarm occurrence
  ids follow the shared format in ADR-0004; don't invent new alarm id shapes.
- Times of day are `"HH:mm"` strings. Dates are `"YYYY-MM-DD"` strings in **local time**: use `src/domain/dates.ts`
  (`toLocalDateString`, `addLocalDays`, `localDateTimeToMs`). **Never** `toISOString().split('T')[0]` for a calendar
  date (that's the UTC date; it's wrong for early-morning times in India). Timestamps are epoch ms (`…Ms` suffix).
- Everything is single-profile today but carries `profileId: 'default'`. Keep passing it.

## UI
- Styling: `tw` from `twrnc` for layout and spacing. **Colors always come from `useTheme().colors`** (`colors.bg`,
  `colors.card`, `colors.text`, `colors.primary`, …). Don't hard-code hex values for themeable surfaces.
- Font sizes are explicit pixel values (recent commit `5877d62`). Follow the surrounding file.
- Icons: `lucide-react-native` only.
- Touch targets ≥ 44 px (`min-h-11 min-w-11`).

## Accessibility (enforced by `npm test` for listed files)
Every interactive element gets `accessible={true}`, `accessibilityRole`, and `accessibilityLabel` (translated).
When you add a new screen, also add it to `filesToCheck` in `test-i18n-theme.cjs`.

## i18n (enforced by `npm test`)
- No hard-coded user-facing strings. Use `const { t } = useTranslation()` and `t('section.key')`.
- Add every new key to **all four** `src/i18n/locales/{en,hi,mr,es}.json` in the same nested position. Provide real
  Hindi, Marathi, and Spanish translations, not English copies.
- Medical safety text (missed-dose advice, warnings) should be short and plain. Many users are elderly.

## Medication safety
- Safety checks warn and never silently block. The user decides, but the warning must be visible.
- Never change dose-gap, max-dose, stock, or scheduling math without a test that covers the edge case (midnight
  crossing, DST, timezone change, interval across days).

## Persistence
- Only `src/services/kvStore.ts` touches AsyncStorage. Pick **one** owner store for new data (StorageService document
  or DatabaseService table, see ARCHITECTURE.md §3) and access it through a repository.
- New stored data needs a zod schema. Changing a stored shape requires a step in `src/services/migrations.ts`
  (bump `CURRENT_SCHEMA_VERSION`) and a note in ARCHITECTURE.md §3.
- New stores must be added to the backup (`DataManagementService`) and its round-trip test.

## Native module (`modules/alarm-engine`)
- Kotlin changes must keep working with JS dead (receivers read `AlarmStorage`, not JS).
- Every user/timeout action goes through `AlarmActionHandler` and is queued for JS (`pending_actions`). Only
  `AlarmForegroundService` makes sound or vibrates.
- The series id format and window are a contract with the JS planner (ADR-0004).
- Keep the JS wrapper in `modules/alarm-engine/index.ts` safe on web: every export checks the native function exists
  and returns a fallback.
- Manifest changes go through `plugins/withAlarmEngine.cjs` / the module manifest, never `android/` directly.

## Tests
- Tests live in `src/**/__tests__/<area>.test.ts`, plain `node:assert`, printing `✅ <case>` lines.
  `scripts/run-tests.mjs` finds them automatically and runs each in two timezones (Asia/Kolkata, America/New_York).
  Async tests wrap their body in `main().catch(err => { console.error(err); process.exit(1); })`.
- Don't use Jest globals (`describe`/`it`). There is no Jest.
- Date/time logic: assert with local `Date` getters (`getHours()`), never with hard-coded UTC strings.

## Git
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, optional scope, and the backlog ID
  in the subject or body.
- Never commit `android/`, `ios/`, `*.apk`, `.env*`, or `.expo/` (already in `.gitignore`).
