# Architecture Decision Records

Short records of choices a future contributor might otherwise reverse by accident. Add one when you pick between real
alternatives (storage engine, navigation library, a native approach, a permission strategy).

- File name: `NNNN-kebab-title.md`, numbered sequentially.
- Status: `Proposed` → `Accepted` → (`Superseded by NNNN` | `Deprecated`).
- Don't edit an accepted ADR's decision. Write a new ADR that supersedes it.

| # | Title | Status |
| --- | --- | --- |
| [0001](0001-offline-first-no-cloud.md) | Offline-first, no accounts, no cloud | Accepted |
| [0002](0002-native-alarm-engine.md) | Custom native Kotlin alarm engine instead of expo-notifications | Accepted |
| [0003](0003-storage-consolidation.md) | Consolidate to one storage layer (expo-sqlite) | Proposed |

## Template

```markdown
# NNNN — Title
- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD
## Context
What forces are at play? What problem are we solving?
## Decision
What we chose.
## Alternatives considered
What else, and why not.
## Consequences
What gets easier or harder. Follow-up work (with backlog IDs).
```
