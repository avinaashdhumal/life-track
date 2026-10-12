# 0001 — Offline-first, no accounts, no cloud
- **Status:** Accepted
- **Date:** 2026-10-10 (recorded 2026-10-12 from README and code)

## Context
LifeTrack stores sensitive health data (medicines, conditions, allergies, dose history). Target users include elderly
people and families in India, often on low-end Android phones with patchy connectivity, who may not trust apps with
health data.

## Decision
All data stays on the device. No login, no backend, no sync, no analytics or crash reporting, no ads. Data portability
comes from user-initiated local backup files (JSON) that the user stores wherever they choose.

## Alternatives considered
- **Cloud sync / accounts:** enables caregivers and multi-device use, but adds privacy and regulatory burden plus a
  server to run, and breaks the trust promise.
- **Optional E2E-encrypted sync:** possible later, but needs its own ADR.

## Consequences
- Backup and restore are critical, because losing the phone means losing the data (BUG-003, FEAT-007).
- Caregiver features have to be local, such as sharing a PDF or a message via the share sheet.
- No network-dependent dependencies. The `@google/genai` / `express` scaffold leftovers were removed (DEBT-004, 2026-10-12).
