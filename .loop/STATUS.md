# Loop Project Status

## Current phase

Integrated Software MVP V2 is in controlled quality iteration. The P0 offline
Demo loop is implemented and current work is limited to evidence-backed
stability, recovery, accessibility, and Demo clarity improvements.

## Single source of truth

Use these files in this order:

1. `00_PROJECT_CONTEXT.md` and `04_SOFTWARE_UPDATE_2026-08-01.md` — product
   definition;
2. `.loop/STATUS.md` — current facts, phase, and active ownership;
3. `.loop/DECISIONS.md` — durable architecture and product decisions;
4. `.loop/RISKS.md` — known risks and mitigations;
5. `.loop/INTEGRATION_QUEUE.md` — executable workflow graph and join criteria;
6. `.loop/tasks/` — work orders;
7. `.loop/claims/` and `.loop/reports/` — ownership and evidence.

If a task prompt conflicts with the product definition, stop and create a
Decision Request instead of guessing.

The canonical coordination root is `D:\Codex-Workspace\Loop\.loop`. Agents may
use separate worktrees for `src/` changes, but they must read task files and
write claims / reports in this canonical root.

## Baseline evidence

- `origin/main` points to `4df8023` (`docs: polish hackathon demo readme`).
- Current branch: `agent/loop-v2-integration`.
- The last verified pushed product commit on `origin/agent/loop-v2-integration`
  is `2f42ff2` (`fix: guard hardware simulator async actions`). Local commits
  after it contain only the status and overnight report updates described below.
- The current working tree is clean.
- Verification on the current integrated branch: 15 test files / 85 tests
  passed, typecheck passed, production build passed, and `git diff --check`
  passed.
- `npm test -- --run` can occasionally spend longer starting parallel Vitest
  workers in this environment; verbose and single-worker runs have passed, and
  the latest full run completed normally.

## V2 migration finding

The current runtime is a working offline demo, but its public domain boundary
still uses `Person`, `Memory`, `OrganizedContent`, and a boolean-style policy.
The V2 definition requires explicit Context, provenance, generation policy,
trigger policy, and interaction artifacts. These are migration work, not proof
that the current demo is broken.

## Priority contract

### P0 — required for the software Demo

- subject / recorder / recipient / buyer and relationship model;
- guided active Context capture and owner review;
- original / derived content separation with provenance;
- recipient-scoped Agent with source-backed bounded generation;
- explicit recipient entry with `pull_only` default;
- one `InteractionArtifact` / 远行明信片 result;
- hardware simulator and offline fallback;
- one integrated end-to-end Demo.

### P1 — only after the P0 loop is stable

- trigger engine for scheduled dates, milestones, weather, location, and plan
  progress;
- feedback preferences and relationship trajectory;
- shared plans;
- additional modalities;
- real NFC / BLE / wearable adapters.

### P2 — out of current scope

- HRV emotion recognition;
- passive long-term sensing;
- strong proactive intervention;
- family networks and full one-to-many permissions;
- high-freedom personality cloning;
- complex game systems.

## Active task policy

- The historical TASK-009 through TASK-015 integration gates are complete and
  remain as audit records.
- The current quality iteration may change only the files allowed by its task
  prompt, one focused issue at a time, with tests and a report entry for each
  completed batch.
- No task may change another task's owned files without a Decision Request and
  an explicit queue update.
