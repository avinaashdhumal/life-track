# Project Status

**Last updated:** 2026-10-12 (after fix session) · **Base commit:** `d86ae90` + uncommitted fixes · **App version:** 1.0.0
**Updated by:** Claude Code

> The README phase table is the long-term vision. This file is the honest snapshot. Status legend:
> ✅ works end to end · 🟡 partly works / unverified · 🔴 broken · ⬜ not started

## Health at a glance

| Check | Result |
| --- | --- |
| `npm test` (i18n parity + used-key check + a11y audit, then 7 test files × 2 timezones) | ✅ passing |
| `npm run lint` (`tsc --noEmit`) | ✅ clean |
| Metro bundle: `npx expo export --platform android` / `--platform web` | ✅ both bundle |
| Web run (`npm run web`): onboarding → add medicine → alarm rings → Taken | ✅ verified in browser 2026-10-12 |
| **Kotlin compile + device tests** after the native rewrite | 🟡 **not yet run** (no JDK on dev machine), see DEBT-010 |

## Feature matrix

| Area | Capability | Status | Notes |
| --- | --- | :---: | --- |
| **Alarm engine** | Exact alarm fires locked / Doze / app killed | 🟡 | Worked in Phase 0; native code changed since → re-verify (DEBT-010) |
| | Reboot / time-change restore; missed-while-off recorded, series kept | 🟡 | Rewritten `BootReceiver` (DEBT-010) |
| | Single ringing source, auto-dismiss after N min (setting), vibration setting respected | 🟡 | Native, unverified on device |
| | Notification / lock-screen Taken · Snooze · Skip update app data | 🟡 | Native queue → JS drain. JS side tested; native unverified |
| | Reminders keep going without opening the app | 🟡 | Native roll-forward (ADR-0004). JS twin tested for id/time parity |
| | Edit/disable/delete a recurring schedule cancels its alarms | ✅ | Diff-based sync with `scheduleId` in payload |
| | Localized notification buttons | 🟡 | Labels passed from JS; native display unverified |
| **Medicines** | CRUD, forms, strength, food relation, colour | ✅ | |
| | **Medicine reminders ring** (fixed, interval, routine-relative) | ✅ web / 🟡 Android | Verified in browser; Android needs DEBT-010 |
| | Stock tracking, auto-decrement (also from notification), low-stock badge | ✅ | No refill **notification** yet (FEAT-004) |
| | Min dose gap / max daily dose warnings | ✅ | Warn only |
| | PRN (as needed) | ✅ | No alarm by design |
| **Today** | Dose cards, take/skip, real snooze reminder, overdue, midnight rollover, live refresh | ✅ | |
| | Adherence history / calendar | ⬜ | FEAT-003 |
| **Routine** | Anchors; changes move routine-relative reminders | ✅ | |
| **Shifts** | Engine, overrides (incl. custom types), 90-day calendar; onboarding choice applied | ✅ | |
| | Per-shift routine drives dose times; shift-eve notification | ⬜ | FEAT-012 |
| **Onboarding** | 4 steps; profile + shift choice persisted correctly | ✅ | |
| **Settings** | Theme, language, snooze, vibration, full-screen, wake/sleep → applied to alarms | ✅ | |
| | Backup / restore (all stores, validated, legacy formats, share) | ✅ | Automatic backups: FEAT-007 |
| | Clear reminder logs | ✅ | |
| | Delete all my data (UI) | ⬜ | Logic exists (FEAT-011) |
| **Health Check** | Exact alarm, notifications (real status), battery, full-screen intent (Android 14+), OEM tips | ✅ | |
| **Navigation** | Android back → Today; deep links `lifetrack://…` | ✅ | |
| **i18n / a11y** | en/hi/mr/es parity, every used key exists, a11y audit auto-discovers files | ✅ | ~70 hard-coded English labels remain (DEBT-009) |
| **Phases 3–10** | Appointments, vitals, conditions, fitness, nutrition, habits, insights, app lock, widgets | ⬜ | See ROADMAP |

## What a real user experiences today (assuming DEBT-010 passes)

A user onboards, adds medicines, and gets a ringing reminder for every dose, even if they don't open the app for
weeks. They can tap Taken/Snooze/Skip on the notification or lock screen, and the dose history and stock reflect it
next time they open the app. Settings (snooze length, vibration, full-screen) apply to the next alarms. A full backup
can be shared and restored. Missing next: refill reminders, adherence history, a doctor report.

## Release risks (before any Play Store submission)

- DEBT-010: native code must be compiled and device-tested.
- `USE_EXACT_ALARM` is restricted by Google Play to alarm-clock and calendar apps; decide whether to rely on the
  user-granted `SCHEDULE_EXACT_ALARM` (onboarding and Health Check already link to the setting) (FEAT-015).
- A health-data app needs a privacy policy URL and a Data Safety form, even with "no data collected".
