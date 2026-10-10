# LifeTrack — Offline-First Daily Life & Health Tracker

LifeTrack is a personal, offline-first daily life and health tracker designed for Android (with iOS support planned via the same codebase).
- No login or accounts
- No cloud sync or backend
- No analytics or ads
- Zero data leaves your device
- Rock-solid alarms and reminder reliability

---

## Phase 0: Alarm Proof of Concept

This repository contains the completed **Phase 0** implementation with the local Kotlin native module (`modules/alarm-engine`), custom Expo Config Plugin (`plugins/withAlarmEngine.js`), and pure TypeScript domain logic.

### Key Architecture Components in Phase 0:

1. **`modules/alarm-engine`**: Local Expo native module written in Kotlin:
   - Schedules exact alarms via `AlarmManager.setAlarmClock()` (and `setExactAndAllowWhileIdle()`), waking the device from Doze mode even when locked or app is swiped away.
   - Persists all alarms in native `SharedPreferences` so they survive process death and system restarts.
   - Registers `BootReceiver` for `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET`, and `TIMEZONE_CHANGED` to re-register alarms immediately without starting JavaScript.
   - Launches `AlarmFullScreenActivity` with `setShowWhenLocked(true)`, `setTurnScreenOn(true)`, and `FLAG_KEEP_SCREEN_ON`.
   - Notification channels: `medicines`, `appointments`, `routine`, `exercise`, `water_meals`, `habits`, `summaries`.
   - Action buttons: `Taken / Done`, `Snooze (10m)`, `Skip`.
   - Detects phone manufacturer and provides autostart settings intents (Xiaomi, Samsung, OnePlus, Oppo, Vivo, Realme).

2. **Recurring Alarm Scheduler (`src/domain/reminderPlanner.ts`)**:
   - **Daily**: Repeat every day at a specified clock time (`timeOfDay`).
   - **Weekly**: Repeat on selected weekdays (e.g., Mon, Wed, Fri) at a specified clock time.
   - **Every N Days (e.g., 2 days after)**: Periodic cycles stepping every N days starting from an anchor date/time.
   - **Selected Specific Dates**: Explicit calendar dates list + clock time.
   - **Monthly**: Triggers on a chosen day of the month (e.g. 1st or 15th) across all or selected months.
   - **Universal Channels**: Works across all notification channels (Medicines, Appointments, Daily Routine, Workouts/Exercise, Water & Meals, Habits, Summaries).
   - **Dual Style**: Choose Full-screen Lockscreen Alarm vs High Priority Notification per schedule.
   - **Live 5-Occurrence Preview**: Accurately computes future trigger occurrences before saving.

3. **`plugins/withAlarmEngine.js`**: Expo Config Plugin (Continuous Native Generation / CNG):
   - Injects `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `VIBRATE`, and `FOREGROUND_SERVICE` into `AndroidManifest.xml`.
   - Declares `AlarmFullScreenActivity`, `AlarmReceiver`, and `BootReceiver`.

3. **`src/domain/`**: Pure TypeScript domain logic (no React/Expo dependencies):
   - Alarm scheduling, dose gap safety validation, unacknowledged occurrence reconciliation, and unit test suite.

4. **`src/features/poc/`**:
   - `AlarmTestScreen`: Schedule a 2-minute alarm test, live countdowns, quick 10s tests, and real-time event logging.
   - `HealthCheckScreen`: Exact alarm status, notification channel health, battery optimization bypass, manufacturer autostart guides, and next 10 scheduled alarms table.
   - `FullScreenAlarmModal`: Interactive full-screen alarm ringing simulation with Web Audio synthesized siren chimes and vibration.

---

## Physical Android Phone Testing Guide

### Prerequisites
- Node.js (v18+)
- Android Studio with Android SDK (API 34/35) and platform tools (`adb`)
- A physical Android phone connected via USB with **USB Debugging** enabled

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Native Android Project (Expo CNG Prebuild)
```bash
npx expo prebuild -p android
```
This generates the `android/` directory and applies the `plugins/withAlarmEngine.js` config plugin.

### 3. Run Development Build on Physical Device
```bash
npx expo run:android --device
```

### 4. Running the Reliability Tests

#### Test 1: Full Alarm 2 Minutes Ahead
1. On the app home screen, tap **Schedule 2 Minutes Ahead**.
2. Press the power button to **turn off the screen and lock the phone**.
3. Wait 2 minutes: The screen will turn on, show the full-screen alarm over the lock screen, ring, and vibrate.
4. Tap **Taken / Done** or **Snooze 10 Minutes**.

#### Test 2: App Swiped Away / Killed
1. Schedule a 2-minute alarm.
2. Open Android Recent Apps and **swipe LifeTrack away** to kill the app process.
3. Wait for the 2-minute mark: The alarm will fire directly from native Kotlin code via `AlarmReceiver`.

#### Test 3: Doze Mode Bypass
With the device connected to USB:
```bash
# Force phone into deep Doze mode
adb shell dumpsys battery unplug
adb shell dumpsys deviceidle force-idle
```
The alarm will still ring exactly on time because it uses `AlarmClockInfo`.
```bash
# Restore battery status
adb shell dumpsys battery reset
```

#### Test 4: Reboot Rescheduling
1. Schedule an alarm 10 minutes ahead.
2. Restart the phone:
```bash
adb reboot
```
3. Once booted up, inspect logcat to verify `BootReceiver` rescheduled all pending alarms:
```bash
adb logcat -s AlarmEngine:V LifeTrack:*
```

---

## Building a Release APK Locally
To build a release APK for your phone without a cloud service:
```bash
cd android
./gradlew assembleRelease
```
The generated APK will be located at:
`android/app/build/outputs/apk/release/app-release.apk`
