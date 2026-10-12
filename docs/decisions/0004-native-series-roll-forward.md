# 0004 — Native series roll-forward with a shared occurrence-id format
- **Status:** Accepted
- **Date:** 2026-10-12

## Context
Recurrence rules live in JS. JS can only plan a rolling window (14 days) and only when the app runs, so reminders
stopped if the app wasn't opened for two weeks (BUG-005). Medicine reminders must never silently stop.

## Decision
Every planned occurrence carries a repeat rule (`AlarmItem.repeat`: `everyDays`, `untilMs`, `seriesPrefix`,
`seriesSuffix`). When an occurrence fires, is acted on early, or was missed while the phone was off, the native engine
schedules the same reminder `everyDays` local calendar days later (`AlarmSchedulerHelper.scheduleNextInSeries`).

The new id is `${seriesPrefix}_${yyyyMMdd}_${seriesSuffix}`, **exactly** what the JS planner generates for that
date (`buildOccurrenceId`). Periodic rules are planned for exactly one roll period, so the rolled occurrence is never
already planned, and the next JS sync sees the same set of ids (no duplicates, nothing cancelled by mistake).
`planNextInSeries` is the JS twin and is tested for this parity in `reminderPlanner.test.ts` and
`medicineReminders.test.ts`.

Irregular rules (monthly, custom dates, once) don't roll natively; they're planned up to 1–3 years ahead instead.

## Alternatives considered
- **WorkManager daily job that re-runs JS planning:** needs headless JS, which is fragile on aggressive OEM skins.
- **Store full recurrence rules natively:** duplicates the planner in Kotlin; two implementations to keep in sync.

## Consequences
- Changing the id format, the window length, or a rule's plan horizon is a **breaking change**: update both
  `src/domain/reminderPlanner.ts` / `medicineReminders.ts` and `AlarmSchedulerHelper.kt`, add a migration that
  rebuilds alarms (`alarmsNeedRebuild`), and keep the parity tests green.
- Dates in ids are local: a timezone change can leave ids "off by a day" until the next sync, which reschedules them.
