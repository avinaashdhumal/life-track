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

## M1 — Make the core promise true (next)
Goal: a medicine added in the app rings on time, and acting on the notification updates the app.

1. DEBT-001 decision (ADR-0003) — choose the store first, so M1 isn't built on the layer that will be deleted.
   (The full migration can land in M2. M1 only needs medicine alarms to go through one well-defined path.)
2. BUG-001 — medicine → alarm planning (pure domain + sync service + tests)
3. BUG-002 — keep `scheduleId`/payload across the native sync
4. BUG-004 — notification actions → dose log + stock
5. BUG-005 — native self-rescheduling, so reminders never run out
6. FEAT-002 — missed-dose follow-up
7. FEAT-004 — refill notification
8. FEAT-009 — reliability banner when permissions are missing
9. DEBT-003 — remove the 1-second polling loop

**Exit criteria:** README device Tests 1–4 pass for a *medicine* reminder, not just a test alarm. Results are recorded
in PROGRESS_LOG.

## M2 — Trust: never lose data, easy to use daily
1. DEBT-001 / DEBT-002 — one storage layer + migration
2. BUG-003 + FEAT-007 — complete versioned backup + automatic weekly backup
3. FEAT-003 — adherence history (calendar, %, streak)
4. FEAT-005 — navigation: Today · Medicines · History · More
5. FEAT-011 — delete all my data
6. BUG-006, BUG-007, DEBT-006, DEBT-007

## M3 — Share and ship
1. FEAT-006 — doctor report (PDF/share)
2. FEAT-008 — emergency card
3. FEAT-012 — shift-aware dose times + shift-eve notice (the differentiator for shift workers)
4. FEAT-015 — Play Store readiness
5. DEBT-004 / DEBT-005 — remove the scaffold leftovers before a public release

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
