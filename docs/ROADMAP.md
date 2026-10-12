# Roadmap

The README lists Phases 0–10 covering health, fitness, nutrition, habits, and more. That's a lot of breadth for a solo
project. This roadmap **re-orders by user value**: first make the core promise real ("I'll never miss a dose"), then
make it trustworthy, then make it shareable with doctors and family. Breadth comes last.

Item IDs refer to [BACKLOG.md](BACKLOG.md).

## Product north star

> "I set up my medicines once, and LifeTrack reliably tells me when to take them, warns me before I run out, and
> shows my doctor how I've been doing, all without my data leaving my phone."

North-star metric (measured on the device only, never sent anywhere): **% of scheduled doses logged as taken within
60 minutes.**

## M1 — Make the core promise true (in progress)
Goal: a medicine added in the app rings on time, and acting on the notification updates the app.

Done 2026-10-12 (JS verified; native pending DEBT-010): ~~ADR-0003~~, ~~BUG-001~~, ~~BUG-002~~, ~~BUG-004~~,
~~BUG-005~~, ~~DEBT-003~~, plus BUG-008…024 found along the way.

Remaining, in order:
1. **DEBT-010**: compile the native module and run the device checklist. Nothing else in M1 ships before this.
2. FEAT-002: missed-dose follow-up (re-notify, show `missedDoseAdvice`)
3. FEAT-004: refill notification + days-of-stock estimate
4. FEAT-009: reliability banner on Today when a permission is missing
5. DEBT-009: translate the remaining hard-coded strings (Hindi/Marathi screen-reader users)

**Exit criteria:** README device Tests 1–4 pass for a *medicine* reminder, plus the DEBT-010 checklist. Results are
recorded in PROGRESS_LOG.

## M2 — Trust: never lose data, easy to use daily
Done: ~~DEBT-001/002~~, ~~BUG-003~~, ~~BUG-006~~, ~~BUG-007~~, ~~DEBT-006~~, ~~DEBT-007~~.

Remaining:
1. FEAT-007: automatic weekly backup (format is ready)
2. FEAT-003: adherence history (calendar, %, streak)
3. FEAT-005: navigation: Today · Medicines · History · More
4. FEAT-011: "Delete all my data" button (logic is ready)

## M3 — Share and ship
1. FEAT-006 — doctor report (PDF/share)
2. FEAT-008 — emergency card
3. FEAT-012 — shift-aware dose times + shift-eve notice (the differentiator for shift workers)
4. FEAT-015: Play Store readiness (exact-alarm permission decision, privacy policy, Data Safety)

## M4 — Broaden health tracking (README Phase 3 subset)
Appointments (FEAT-010) and vitals (FEAT-013) first. Both reuse the reminder engine and feed the doctor report.
Symptoms and sleep come after.

## M5 — Later / only if users ask
Conditions and food guidance (Phase 4), fitness and meditation (Phase 5), nutrition and water (Phase 6), habits
(Phase 7), Health Connect, and widgets (Phase 10, FEAT-014). Each one is a product in its own right. Validate demand
before starting.

## Explicit non-goals (for now)
- Cloud sync, accounts, server components, AI features that send data off-device.
- iOS release. The codebase allows it, but the alarm engine is Android-only. iOS needs its own design
  (time-sensitive notifications or critical alerts entitlement).
