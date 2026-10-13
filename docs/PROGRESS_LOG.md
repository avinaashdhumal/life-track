# Progress Log

Append-only session journal. **Newest entry on top.** One entry per working session or task. Keep each entry short:
what changed, how it was verified, and what's left. Anything that needs tracking also goes in BACKLOG.md.

Template:

```
## YYYY-MM-DD — <short title> (<agent/author>)
- **Changed:** …
- **Backlog:** BUG-xxx done / FEAT-xxx in-progress / new: DEBT-xxx
- **Verified:** npm test ✅ · npm run lint ✅ · device test: <model, Android version, which README tests> | not run
- **Left / risks:** …
```

---

## 2026-10-13 — README for sharing: download, demo video, screenshots, license (Claude Code)
- **Changed:** README rewritten for end users and forkers: download section with the EAS build link + QR code
  (`docs/media/download-apk-qr.png`, decodes to the same URL), install steps and required permissions, demo GIF +
  MP4 (`docs/media/lifetrack-demo.*`), 9 light-theme screenshots (`docs/media/screenshots/`), overview image, how to
  use, privacy, build from source, EAS APK build, "Make your own version", contributing, known limitations. Old
  detailed phase list folded into `<details>`; release-APK section now runs `expo prebuild` first. Added MIT
  `LICENSE` (owner's choice). Fixed doc drift: shift-change evening notice shipped in FEAT-016 but STATUS, BACKLOG
  FEAT-012, and the README phase table still listed it as todo.
- **Backlog:** new BUG-029 (routine-anchored medicine shows no time on Medicines list), BUG-030 (alarm countdown shows
  "225:47"), DEBT-014 (language codes repeated in 5 places).
- **Verified:** media captured on the emulator (`medium_phone`, API 36) from the current debug build with demo data
  (app data was cleared first; demo name "Asha Patil"). The quick 10 s test alarm fired with the screen locked and
  showed the full-screen activity; Taken dismissed it. `npm test` ✅ · `npm run lint` ✅. No code changes.
- **Left / risks:** the EAS build behind the link/QR wasn't inspected (needs the owner's Expo login), so it may be
  older than `main`; EAS build links can expire, so a GitHub Release with the APK attached would be a permanent
  download. The emulator still has the demo data, light theme, and shifts enabled.

## 2026-10-13 — Reminders for medicines, routine, shifts + per-medicine tone (Claude Code)
- **Changed:** FEAT-016 (see BACKLOG): per-medicine reminder style + tone picker; routine milestone/custom-block
  notifications with bell switches; shift-change evening notice with switch/time; native per-tone channels, OK-only
  action, tone listing/preview; BUG-027 fix (routineTiming saved).
- **Verified:** `npm run lint` ✅ · `npm test` ✅ (9 files × 2 timezones; new routineReminders + medicinesRepository
  tests) · Kotlin compile + debug APK ✅ · emulator: routine block (14) and medicine (14) reminders scheduled natively.
- **Left / risks:** user's physical phone still runs the old preview APK, which has none of this. Tone picker needs a
  hands-on check on device (lists phone sounds, preview, chosen tone heard). Custom tones mean extra notification
  channels in Android settings (one per chosen tone).

## 2026-10-12 — Production lint, type strictness, and date hardening pass (Antigravity)
- **Changed:**
  - `tsconfig.json`: Added `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, and `forceConsistentCasingInFileNames`.
  - Date purity: Replaced `toISOString().split('T')[0]` in `shift.ts:addDaysToDateString` with `addLocalDays` from `dates.ts` (Rule 8). In `medicine.ts:generateTodayDoseSlots`, used `localDateTimeToMs` instead of inline ISO string Date parsing.
  - Type safety: Replaced `colors: any` in `RoutineSettingsModal` and `ShiftScheduleScreen` with `ThemeColors`.
  - Error typing: Replaced `err: any` in `TodayScreen`, `MedicineListScreen`, and `MedicineFormModal` with type-safe `unknown` error handling.
  - Backup parsing: Cleaned legacy import typings in `DataManagementService` from `Record<string, any>` to `Record<string, unknown>` and fixed `@typescript-eslint/array-type`.
  - Config: Added `.vscode/` to `.gitignore`.
- **Verified:** `npm run lint` ✅ 0 errors / 0 warnings · `npm test` ✅ (7 files in 2 timezones) · `test-i18n-theme.cjs` ✅ (100% parity across en, hi, mr, es) · `expo-doctor` ✅ (21/21 passed) · `expo export` android ✅ web ✅ · native Gradle `:alarm-engine:compileDebugKotlin` & `:app:compileDebugKotlin` ✅.
- **Left / risks:** Ready for physical device testing on Android hardware (DEBT-010).

## 2026-10-12 — Lint and health pass (Claude Code)
- **Changed:** tsconfig `strict` + no-unused; ESLint 9 + `eslint-config-expo` (`eslint.config.cjs`, `npm run lint`
  runs both); removed 79 unused imports/vars; fixed all React Hooks lint errors (fetch-then-set effects, pure renders,
  modal forms mount on open); AsyncStorage pinned to SDK 57's 2.2.0; splash moved to `expo-splash-screen` plugin;
  web-only theme/language key duplicates removed; native loader uses `requireOptionalNativeModule` from `expo`.
- **Backlog:** done DEBT-011, DEBT-012, BUG-025, BUG-026.
- **Verified:** `npm run lint` ✅ 0/0 · `npm test` ✅ · `expo-doctor` ✅ 21/21 · `expo export` android ✅ web ✅ ·
  browser: data written before the AsyncStorage change reads back after reload, no runtime errors.
- **Left / risks:** DEBT-010 still first (native compile + device). After installing `expo-splash-screen` and changing
  AsyncStorage, a fresh `npx expo prebuild -p android --clean` is required before `run:android`.

## 2026-10-12 — Fix session: every review finding (Claude Code)
- **Changed:**
  - Storage: single engine `kvStore`, one owner per datum, v1→v2 migration, full validated backup/restore with legacy
    import (`DataManagementService`). Profile/settings duplicates removed.
  - Reminders: medicine reminders planned and synced (`medicineReminders.ts`, `reminderCoordinator.ts`); diff-based
    alarm sync; `scheduleId` kept on native; native action queue drained into dose logs; native series roll-forward
    with shared id format (ADR-0004); local-date ids; per-rule plan horizons; settings applied to alarms; real Today
    snooze; no more 1-second polling (App and Alarms tab).
  - Native (Kotlin): `AlarmActionHandler`, pending-action queue, fired-alarm store, roll-forward, auto-dismiss →
    MISSED + silent notification, single ringing source, localized labels, Boot receiver keeps series, full-screen
    intent check/settings.
  - UI: files moved out of `poc/`, big screens split, Health Check fixed (real notification status, full-screen row),
    onboarding shift choice applied, Profile wake/sleep → routine, alarm form validation and no demo defaults, back
    button + deep links, new strings in all 4 locales.
  - Tooling: removed AI Studio/Vite leftovers and unused deps, `npm run web`, auto-discovering test runner in two
    timezones, used-key i18n check, a11y audit auto-discovery, `.claude/launch.json` (web on port 8090).
- **Backlog:** done: BUG-001…007, DEBT-001…008, FEAT-001, BUG-008…024 (found and fixed this session).
  New open: DEBT-009 (≈70 hard-coded English labels), DEBT-010 (native compile + device tests). FEAT-015 in progress.
- **Verified:** `npm test` ✅ (7 files × Asia/Kolkata + America/New_York) · `npm run lint` ✅ ·
  `expo export` android ✅ web ✅ · browser run ✅: onboarding (shift "yes" → shift card shown), add medicine → 14
  alarms with local-date ids → rang at 10:43 → Taken → dose logged, stock 30→29, series rolled, Today shows Taken;
  backup JSON contains all 8 stores. · **Kotlin not compiled, no device test** (no JDK on this machine).
- **Left / risks:** DEBT-010 first. A compile error in the new Kotlin files is possible; the APIs used are standard
  (`ContextCompat.registerReceiver`, `NotificationCompat.setSilent`, `NotificationManager.canUseFullScreenIntent`
  API 34, Expo `Record` fields). Then FEAT-002 / FEAT-004 / FEAT-009 to finish M1.

## 2026-10-12 — Project review + agent context system (Claude Code)
- **Changed:** Added `AGENTS.md`, `CLAUDE.md`, and `docs/` (ARCHITECTURE, STATUS, BACKLOG, ROADMAP, CONVENTIONS,
  PROGRESS_LOG, decisions/). Added a pointer to `docs/` and corrected the Phase 2 status in README. No app code changed.
- **Backlog:** Created BUG-001…007, DEBT-001…008, FEAT-001…015 from the review.
- **Verified:** `npm test` ✅ (i18n parity, a11y, alarm/medicine/shift tests) · `npm run lint` ✅ ·
  `alarmConflict.test.ts` ❌ not runnable (Jest globals) · `vite build` ❌ (`Flow is not supported`) · device: not run.
- **Key findings:** Medicines are never turned into alarms (BUG-001). Notification actions don't reach JS
  (BUG-004). Backup misses half the data (BUG-003). Two overlapping storage layers (DEBT-001).
- **Left / next:** Start M1 in ROADMAP.md: accept or amend ADR-0003, then BUG-001.

## Before 2026-10-12 — history reconstructed from git
- Phase 0: native alarm engine (Kotlin module, 7 channels, boot restore, full-screen activity, foreground service, OEM
  autostart helpers), alarm test screen, health check.
- Phase 1: storage services, medicines CRUD with safety rules and stock, Today screen, onboarding, profile/settings,
  4-language i18n, light/dark theme.
- Phase 2 (partial): `7cdae51` added the rotating shift engine and routine anchors (domain + screens). Not yet
  connected to reminders.
- `15dec33` / `5877d62`: AsyncStorage fallback when the native module is missing, removed the medicine `doses` field,
  explicit pixel font sizes.
