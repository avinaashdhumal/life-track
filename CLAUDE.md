# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Start each session by reading `docs/STATUS.md` and the top of `docs/PROGRESS_LOG.md`, then pick work from
  `docs/BACKLOG.md` (P0 first) unless the user asked for something specific.
- Before you finish a task, update the tracking docs as described in AGENTS.md → "How to keep progress tracked".
- For alarm or native changes you can't verify on a device, say so in your reply and in the progress log. Never
  claim an alarm works because it typechecks.
- Large screen files (`src/features/**`, 650–1,250 lines) — read the specific section you need instead of the whole file.
