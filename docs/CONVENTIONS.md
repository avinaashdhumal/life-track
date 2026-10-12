# Conventions

Follow the existing code. These are the patterns it already uses, written down so they stay consistent.

## TypeScript & structure
- Strict TS. `npm run lint` (`tsc --noEmit`) must be clean. Avoid `any` in new code; existing `any` is debt.
- Feature code goes in `src/features/<feature>/`. Use PascalCase `*Screen.tsx` for tabs/screens and `*Modal.tsx` for
  modals. Use named exports (`export const TodayScreen`).
- Domain code goes in `src/domain/<area>.ts`: pure functions, with zod schemas where data is persisted.
  Never import React, React Native, Expo, or services there.
- Data access goes in `src/data/<area>Repository.ts`: a class with a singleton export
  (`export const medicinesRepository = new MedicinesRepository()`). Screens call repositories, not services.
- IDs are prefixed strings: `med_<ts>_<rand>`, `dose_…`, `rec_…`, `log_…`. Times of day are `"HH:mm"` strings. Dates
  are `"YYYY-MM-DD"` strings in **local time**. Timestamps are epoch ms (`…Ms` suffix).
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
- New stored data needs a zod schema and a versioned key or table. Changing a shape requires a migration and a note in
  ARCHITECTURE.md §3.
- Until DEBT-001 is resolved, new domain data goes into `DatabaseService` tables through a repository.

## Native module (`modules/alarm-engine`)
- Kotlin changes must keep working with JS dead (receivers read `AlarmStorage`, not JS).
- Keep the JS wrapper in `modules/alarm-engine/index.ts` safe on web: every export checks the native function exists
  and returns a fallback.
- Manifest changes go through `plugins/withAlarmEngine.cjs` / the module manifest, never `android/` directly.

## Tests
- Domain tests: `src/domain/__tests__/<area>.test.ts`, plain `node:assert`, run with `npx tsx`. Print `✅ <case>` lines.
  Add each new file to `scripts.test` in `package.json`.
- Don't use Jest globals (`describe`/`it`). They aren't installed as a runner.

## Git
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, optional scope, and the backlog ID
  in the subject or body.
- Never commit `android/`, `ios/`, `*.apk`, `.env*`, or `.expo/` (already in `.gitignore`).
