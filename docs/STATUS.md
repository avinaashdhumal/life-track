# Project Status

**Last updated:** 2026-10-12 · **Commit:** `5877d62` · **App version:** 1.0.0 (`app.json`) · **Updated by:** Claude Code review

> The README phase table is aspirational. This file is the honest snapshot. Status legend:
> ✅ works end to end · 🟡 partly works or isn't wired up · 🔴 broken · ⬜ not started

## Health at a glance

| Check | Result |
| --- | --- |
| `npm test` (i18n parity, a11y audit, alarm/medicine/shift domain tests) | ✅ passing |
| `npm run lint` (`tsc --noEmit`) | ✅ clean |
| `alarmConflict.test.ts` | 🔴 not run (Jest globals, DEBT-006) |
| Web preview (`npm run dev` / `build`) | 🔴 fails: `Flow is not supported` (DEBT-005) |
| Android dev build / preview APK | ✅ builds (a `lifetrack-preview.apk` exists locally, untracked) |
| Device reliability tests (README Tests 1–4) | ❓ unrecorded. Log results in PROGRESS_LOG when run |

## Feature matrix

| Area | Capability | Status | Notes |
| --- | --- | :---: | --- |
| **Alarm engine** | Exact alarm fires locked, in Doze, or with the app killed | ✅ | Native `setAlarmClock`. Verified manually during Phase 0 |
| | Reboot / time-change restore | ✅ | `BootReceiver` |
| | Full-screen lock-screen alarm + looping audio | ✅ | Foreground service + activity |
| | Notification actions (Taken/Snooze/Skip) update app data | 🔴 | Native only. JS never learns about them (BUG-004) |
| | Recurring schedules keep firing without opening the app | 🟡 | 14-day window, replanned only when the app starts (BUG-005) |
| | Edit/disable/delete a recurring schedule cancels its alarms on device | 🔴 | `scheduleId` lost on native sync (BUG-002) |
| **Medicines** | CRUD, forms, strength, food relation, colour | ✅ | `MedicineFormModal`, zod-validated |
| | Stock tracking, refill, low-stock badge | ✅ | In-app only. No refill **notification** (FEAT-004) |
| | Min dose gap / max daily dose warnings | ✅ | Warn only, never block |
| | **Medicine reminders actually ring** | 🔴 | Medicines never schedule alarms (BUG-001). **Top priority** |
| | Interval schedule type (`every N hours`) | 🟡 | Saved, but Today ignores `intervalHours` (BUG-006) |
| | PRN (as needed) | ✅ | Single card plus safety checks |
| | Routine-relative dose time | 🟡 | Resolves on Today. No alarm (BUG-001) |
| **Today** | Greeting, progress, dose cards, take/skip | ✅ | |
| | Overdue detection | ✅ | More than 60 min late with no log |
| | Adherence history / calendar | ⬜ | FEAT-003 |
| **Routine** | Wake/meals/sleep/wind-down/exercise anchors | ✅ | `RoutineSettingsModal` |
| **Shifts** | Fixed/rotating, overrides, 90-day calendar, midnight crossing | ✅ | Domain fully tested |
| | Per-shift routine drives dose times | 🟡 | Today uses the single routine (FEAT-012) |
| | Shift-eve notification | ⬜ | Domain `detectShiftChange` exists, nothing schedules it |
| **Onboarding** | 4-step wizard with permissions | ✅ | |
| **Profile/Settings** | Profile, emergency info, theme, language, snooze, vibration | ✅ | Some settings duplicated across stores (DEBT-002) |
| | Backup / restore (JSON) | 🔴 | Partial coverage; routine/shift restore ignored (BUG-003) |
| | Clear event logs | 🔴 | Clears the unused DB table, so the real logs remain (BUG-007) |
| | Delete all my data (factory reset) | ⬜ | No UI. `storageService.clearAllData` exists but skips DB tables (FEAT-011) |
| **Health Check** | Exact-alarm, battery-opt, notification, OEM autostart diagnostics | ✅ | |
| **i18n / a11y** | en/hi/mr/es with parity, a11y audit, light/dark | ✅ | 475 keys per locale |
| **Phases 3–10** | Appointments, vitals, conditions, fitness, nutrition, habits, insights, app lock, widgets | ⬜ | See ROADMAP for re-prioritization |

## What a real user experiences today

A user can onboard, add medicines, and tick doses off on the Today screen. **But they get no reminder for those
medicines.** Only generic alarms created on the "Alarms" tab ring. That gap is the main reason the app doesn't yet
deliver its core promise. Fixing it is milestone M1 in [ROADMAP.md](ROADMAP.md).

## Release risks (before any Play Store submission)

- `USE_EXACT_ALARM` is restricted by Google Play to alarm-clock and calendar apps. A medication-reminder app may need
  to rely on `SCHEDULE_EXACT_ALARM` (user-granted) instead. Verify current policy (FEAT-015).
- `USE_FULL_SCREEN_INTENT` on Android 14+ requires `NotificationManager.canUseFullScreenIntent()` and a fallback.
- `package.json` name is still `react-example`, version `0.0.0`.
- A health-data app needs a privacy policy URL and a Data Safety form, even with "no data collected".
