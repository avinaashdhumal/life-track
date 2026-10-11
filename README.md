# LifeTrack — Offline-First Daily Life & Health Tracker

LifeTrack is a personal, offline-first daily life and health tracker designed for Android (with iOS support planned from the same codebase).
- **100% Offline & Private**: No login, no cloud sync, no tracking, no ads. All data lives solely on the device.
- **Rock-Solid Hardware Alarms**: Built with native Kotlin `AlarmManager.setAlarmClock()` to guarantee alarms fire in Doze mode, when locked, or when the app is swiped away.
- **Medication Safety Engine**: Minimum dose gap enforcement, max daily doses ceiling, and real-time inventory tracking.
- **Optional Work Shift Engine**: Disabled by default. When OFF, the app uses a clean, single daily routine without any shift clutter.

---

## 📋 Feature Roadmap & Phase Status

| Phase | Feature Description | Status | Details |
| :--- | :--- | :---: | :--- |
| **Phase 0** | **Alarm Proof of Concept** | ✅ **Completed** | Native Kotlin module (`alarm-engine`), 7 notification channels, exact alarms, boot receivers, Doze bypass, full-screen lockscreen activity, test screen. |
| **Phase 1** | **Foundation, Medicines, Basic Today, Onboarding, Profile & Local DB** | ✅ **Completed** | Persistent local DB & storage engine, bottom navigation, dark/light theme, 4-language i18n (`en`, `hi`, `mr`, `es`), full onboarding flow, complete Medicine CRUD with safety rules & stock tracking, zero mock data. |
| **Phase 2** | **Daily Routine & Optional Shift/Schedule Engine** | ⏳ **Next Phase** | Single daily routine (wake/sleep/meals), optional rotating shift engine, routine-relative reminders, shift change notifications. |
| **Phase 3** | **Appointments, Treatments, Measurements, Symptoms & Sleep** | 📅 *Upcoming* | Doctor visits & reminders, treatment courses, vitals logging with target ranges & sparklines, symptom journal, sleep tracker. |
| **Phase 4** | **Conditions, Precautions & Food Guidance** | 📅 *Upcoming* | 15+ built-in conditions, Indian food lists (prefer/avoid), doctor instructions, avoid-flagging in meal logging. |
| **Phase 5** | **Fitness, Guided Session Player & Meditation Timer** | 📅 *Upcoming* | Workout library, yoga & pranayama, timestamp-based guided session player with Android foreground service, meditation timer. |
| **Phase 6** | **Nutrition (Simple & Detailed) & Water Tracker** | 📅 *Upcoming* | Simple (portion/photo) vs Detailed macro tracking, bundled 100 Indian foods database, daylight water tracker with reminders. |
| **Phase 7** | **Habits Engine** | 📅 *Upcoming* | Habits to build & reduce, streaks, monthly heatmaps, fixed and routine-relative habit reminders. |
| **Phase 8** | **Full Today Dashboard & Insights Tab (Analytics)** | 📅 *Upcoming* | Reorderable dashboard cards, timeline, pure domain adherence & vitals analytics, pattern observations, HTML/PDF Doctor Report. |
| **Phase 9** | **Backup & Restore, Security App Lock & Emergency Card** | 📅 *Upcoming* | Versioned JSON export/import, automatic SAF weekly backups, biometric/PIN app lock, emergency lockscreen card. |
| **Phase 10** | **Health Connect Import, Home Screen Widgets & Polish** | 📅 *Upcoming* | Read-only Android Health Connect sync, home screen widgets, performance tuning for 2+ years of data. |

---

## 🔍 Detailed Phase Status

### ✅ Phase 0: Alarm Engine Proof of Concept (Completed)
- **Native Module (`modules/alarm-engine`)**:
  - Native Kotlin module using Android `AlarmManager.setAlarmClock()` and `setExactAndAllowWhileIdle()`.
  - Wakes device from deep Doze mode even when locked or app process is terminated.
  - Native `SharedPreferences` alarm persistence surviving process kills.
  - Native `BootReceiver` restoring alarms immediately upon `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET`, and `TIMEZONE_CHANGED` without waiting for JavaScript.
  - `AlarmFullScreenActivity` with `setShowWhenLocked(true)`, `setTurnScreenOn(true)`, and `FLAG_KEEP_SCREEN_ON`.
  - 7 Notification Channels: `medicines`, `appointments`, `routine`, `exercise`, `water_meals`, `habits`, `summaries`.
  - Native action buttons: `Taken / Done`, `Snooze (10m)`, `Skip`.
  - Manufacturer autostart & battery optimization intents (Xiaomi, Samsung, OnePlus, Oppo, Vivo, Realme).
- **Domain & Tests**:
  - Pure TypeScript domain functions in `src/domain/alarm.ts` and `src/domain/reminderPlanner.ts`.
  - Recurring rules: Daily, Weekly, Every N Days, Custom Dates, Monthly.
  - Standalone unit test suite (`npm test`).

### ✅ Phase 1: Foundation, Local Storage, Medicines & Onboarding (Completed)
- **Local Persistent Storage**:
  - `DatabaseService.ts`: Relational database table manager with ACID-like transactions, foreign keys, and CRUD operations.
  - `StorageService.ts`: AsyncStorage-backed persistent key-value store for app settings, user profile, alarms, and logs.
  - `medicinesRepository.ts` & `profileRepository.ts`: Data repositories for clean domain interaction.
  - Clean state: Starts with **0 mock records**, **0 dummy medicines**, and empty initial profile.
- **Navigation & UI Shell**:
  - Bottom navigation bar: `Today`, `Medicines`, `Alarms`, `Health Check`, `Profile`.
  - Top header with unified quick-action menu (modal settings, language, theme, native inspector).
- **Internationalization & Accessibility**:
  - 4 Locales (`en`, `hi`, `mr`, `es`) with 100% key parity (396 keys) and automated parity validation.
  - Full high-contrast Light and Dark theme palette.
  - Proper accessibility roles and labels on all interactive elements.
- **First-Launch Onboarding (`src/features/onboarding/OnboardingScreen.tsx`)**:
  - 4-step wizard: Privacy intro, Android reliability permissions, emergency health profile, optional work shifts decision.
- **Medicines Feature (`src/features/medicines/`)**:
  - Full CRUD operations: Add new medicine, Edit existing medicine, Delete medicine, Toggle active/paused.
  - Medicine metadata: Name, form (tablet, capsule, syrup, injection, drops, inhaler, other), strength, food relation, prescribing doctor, purpose, notes, color.
  - Stock tracking: Current units, auto-decrement on taken dose, refill reminder threshold, and low-stock badge.
  - Safety validation: Minimum dose gap interval check, max daily doses warning ceiling, custom missed dose instructions.
- **Today Tab (`src/features/today/TodayScreen.tsx`)**:
  - Live greeting, today's date, dose schedule progress bar.
  - Dose cards for today with one-tap "Take Dose" and "Skip" actions.
  - Clean empty state directing user to create their first medicine schedule.

---

### ⏳ Phase 2: Daily Routine & Optional Shift Engine (Next Phase)
- **Single Daily Routine (When Shifts are OFF - Default)**:
  - Configure single user wake time, sleep time, and meal times (breakfast, lunch, dinner).
  - Routine-relative reminder offsets (e.g. "30 minutes after wake up", "with breakfast", "1 hour before sleep").
- **Optional Shift and Schedule Engine (When user enables it)**:
  - On/Off toggle under `More > Shift and Schedule` (disabled by default).
  - Custom shift definitions: Morning (06:00-14:00), Afternoon (14:00-22:00), Night (22:00-06:00), General (09:00-18:00), Off day.
  - Shift rotation cycles (e.g. "5 Morning, 2 Off, 5 Afternoon, 2 Off, 5 Night, 2 Off" or weekly rotations).
  - Midnight-crossing night shift logic and manual date overrides (swaps, leave, overtime).
  - 90-day colour-coded shift calendar.
  - Per-shift daily routine templates and automatic reminder time adjustments.
  - Shift transition dose gap protection (preventing medicine doses from being scheduled closer than minimum gap during shift changes).
  - Shift eve notifications ("Tomorrow is Night shift. Your reminders have been adjusted.").

---

### 📅 Phase 3: Appointments, Treatments, Measurements, Symptoms & Sleep (Upcoming)
- **Appointments**: Doctor/clinic, speciality, date/time, questions to ask, follow-up reminders (1 day before, 2 hours before), visit outcome & report photos.
- **Treatments**: Treatment courses (physiotherapy, dressing changes, wound care), session logs.
- **Measurements & Vitals**: Blood pressure, blood sugar, weight, BMI, heart rate, SpO2, temperature, thyroid, with target ranges and sparklines.
- **Symptoms Journal**: Quick 1-10 severity logging with timestamps.
- **Sleep**: Bedtime, wake time, quality (1-5), planned vs actual duration, 7-day shortfall.

---

### 📅 Phase 4: Conditions, Precautions & Food Guidance (Upcoming)
- Built-in condition library (Diabetes, Hypertension, Thyroid, PCOS, Acidity, etc.).
- Offline bundled Indian food database with "Foods to Prefer" and "Foods to Limit/Avoid".
- User doctor's instructions priority over general guidance.
- Avoid-list food flagging during meal logging.

---

### 📅 Phase 5: Fitness, Guided Session Player & Meditation Timer (Upcoming)
- Exercise, yoga (Surya Namaskar, asanas), pranayama, and meditation library.
- Guided session player with audio/vibration cues and Android foreground service for screen-locked accuracy.
- Meditation timer with interval bells and breathing animations (4-7-8, box breathing).

---

### 📅 Phase 6: Nutrition & Water Tracker (Upcoming)
- Simple Mode (portion & photo) vs Detailed Mode (calories, macros, sodium).
- Offline 100 Indian foods dataset.
- Water tracker with quick-add sizes and interval reminders strictly during waking hours.

---

### 📅 Phase 7: Habits Engine (Upcoming)
- Habits to build & habits to reduce (days clean tracker).
- Yes/No, Count, and Duration types with streaks and monthly heatmaps.

---

### 📅 Phase 8: Full Today Dashboard & Insights Analytics (Upcoming)
- Reorderable dashboard cards, 24h timeline, attention cards.
- Pure domain adherence calculations, vitals moving averages, pattern observation correlation rules (>=14 days data).
- HTML/PDF Doctor Report generated via `expo-print` and `expo-sharing`.

---

### 📅 Phase 9: Backup & Restore, Security App Lock & Emergency Card (Upcoming)
- Single versioned JSON export/import with schema verification.
- Automatic weekly backups via Storage Access Framework.
- Biometric / PIN app lock with recent-apps screen privacy obscuring.
- Emergency lockscreen card.

---

### 📅 Phase 10: Health Connect Import, Android Widgets & Final Polish (Upcoming)
- Read-only Android Health Connect import (steps, sleep, heart rate, weight, BP, glucose).
- Android home screen widgets (Next medicine, Today progress, Water quick-add).
- Long-term database performance optimization for 2+ years of records.

---

## 🛠️ Testing & Verification

### Running Automated Test Suite
```bash
npm test && npm run lint
```
Runs:
1. `test-i18n-theme.cjs`: 100% translation key parity across English, Hindi, Marathi, and Spanish, plus Accessibility (a11y) role audits.
2. `src/domain/__tests__/alarm.test.ts`: Alarm calculations, snooze time, missed occurrence detection, recurring schedule planning.
3. `src/domain/__tests__/medicine.test.ts`: Zod schema validation, dose gap safety intervals, max daily dose limits, stock calculations, local repository CRUD.
4. `tsc --noEmit`: Strict TypeScript typechecking.

---

## 📱 Physical Android Phone Testing Guide

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

### 3. Run Development Build on Physical Device
```bash
npx expo run:android --device
```

### 4. Running Reliability Tests

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
adb shell dumpsys battery unplug
adb shell dumpsys deviceidle force-idle
```
The alarm will still ring exactly on time because it uses `AlarmClockInfo`.
```bash
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

## 📦 Building a Release APK Locally
To build a release APK for your phone without a cloud service:
```bash
cd android
./gradlew assembleRelease
```
The generated APK will be located at:
`android/app/build/outputs/apk/release/app-release.apk`
