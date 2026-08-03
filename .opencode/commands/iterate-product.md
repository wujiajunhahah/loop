---
description: Run one bounded, pre-reviewed Loop product or UI iteration and stop after evidence is recorded.
agent: bounded-ui-worker
---

Execute exactly one bounded iteration for task `$ARGUMENTS`.

Read `.loop/autonomous/README.md` before any other action. The argument must resolve to one existing `.loop/tasks/TASK-*.md`. If it is missing, ambiguous, already actively claimed, or unsuitable for the current worktree, stop with `blocked` and explain why.

Follow the complete preflight, claim, observe, implement, verify, skeptical review, report, and stop sequence. Obey the task's allowed files and budgets. Use `docs/AI_SKILLS.md` to select one primary Skill per phase. Do not create another task, update canonical coordination files, merge, push, or start a second iteration.
