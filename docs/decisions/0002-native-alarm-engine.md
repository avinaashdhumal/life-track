# 0002 — Custom native Kotlin alarm engine instead of expo-notifications
- **Status:** Accepted
- **Date:** 2026-10-10 (recorded 2026-10-12 from Phase 0 work)

## Context
Medicine reminders must fire on time when the phone is locked, in Doze, after the app is swiped away, and after a
reboot, including on aggressive OEM skins (Xiaomi, Oppo, Vivo, Realme, Samsung). JS-scheduled notifications can be
delayed or dropped, and they can't show a ringing full-screen alarm.

## Decision
A local Expo module, `modules/alarm-engine`, uses `AlarmManager.setAlarmClock()` (falling back to
`setExactAndAllowWhileIdle`), keeps its own `SharedPreferences` store, restores alarms in a `BootReceiver`, posts
notifications on 7 channels with actions, and runs a foreground service plus a full-screen activity for ringing alarms.
It keeps working with no JS runtime.

## Alternatives considered
- **expo-notifications:** simpler, cross-platform, but no exact-alarm guarantee and no full-screen ringing.
- **notifee:** strong notification and trigger support, but it's a third-party native dependency, and full-screen
  alarm behaviour still needs custom work.

## Consequences
- Android only. iOS needs a separate design.
- JS and native each hold a copy of the alarm state, and they must stay in sync (BUG-002, BUG-004).
- Recurrence lives in JS today, so the native side needs a way to top itself up (BUG-005).
- Play Store exact-alarm and full-screen-intent policies apply (FEAT-015).
- Every change here needs a manual device test.
