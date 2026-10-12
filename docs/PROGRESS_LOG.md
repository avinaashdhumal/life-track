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
