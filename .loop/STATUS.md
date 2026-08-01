# Loop Project Status

## Current phase

Software MVP V2 coordination prepared. The coordinator is not implementing
business functionality in this round. The next authorized implementation node
is `TASK-009`.

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

- `main` and `origin/main` point to `ecf6ffc` (`docs: expand project readme`).
- The integrated product code is based on `d099a3a` and the feature commits
  beneath it.
- `main` has uncommitted product-context documents only:
  `00_PROJECT_CONTEXT.md`, `01_PROMPT_CODEX_DESKTOP.md`,
  `02_PROMPT_OPENCODE.md`, `03_WORKFLOW.md`, and untracked
  `04_SOFTWARE_UPDATE_2026-08-01.md`.
- `feat/agent`, `feat/capture`, `feat/hardware`, and `feat/recipient` worktrees
  are clean and all point to `dc3fd8c`.
- Verification on `main`: 11 test files / 45 tests passed, typecheck passed,
  production build passed.

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

- Start with `TASK-009` only. No other OpenCode window starts before its gate
  passes.
- After the `TASK-009` gate passes, start exactly four parallel tasks:
  `TASK-010`, `TASK-011`, `TASK-012`, and `TASK-014`.
- Do not start `TASK-013` until all four parallel tasks have completed and
  reported, even if its direct dependencies finish earlier.
- Do not start `TASK-015` until `TASK-013` has completed and reported.
- `TASK-015` is the only task allowed to reconcile cross-feature integration.
- Every OpenCode window must create one claim and one report.
- No task may change another task's owned files without a Decision Request and
  an explicit queue update.
