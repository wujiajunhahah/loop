# Loop Project Status

## Temporary coordination handoff

Until the user explicitly cancels this arrangement or the Codex desktop overview
window resumes, the designated OpenCode window may temporarily perform the
overview responsibilities: status maintenance, task scheduling, dependency and
conflict review, integration decisions, and Demo readiness review.

The `.loop/` directory remains the canonical record. Decisions, claims, risks,
verification evidence, and handoffs must be written there so another window can
resume without relying on chat history.

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

- `origin/main` points to `157085b` (`feat: evolve demo into W·HERE memory response`).
- Current branch: `agent/loop-v2-integration`.
- The pushed branch and local HEAD point to `8846922`
  (`feat: evolve demo into W·HERE memory response`).
- The working tree contains uncommitted W·HERE UI, Echo Map, browser-test,
  documentation, booth, video and project-tooling changes.
- Current verification: 19 test files / 199 tests, typecheck, production build,
  `git diff --check`, and 6 desktop/mobile Playwright tests passed.
- `npm test -- --run` can occasionally spend longer starting parallel Vitest
  workers in this environment; verbose and single-worker runs have passed, and
  the latest full run completed normally.

## Latest handoff

- The current branch is `agent/loop-v2-integration`; do not switch branches
  automatically when resuming.
- The current verified result is 19 test files / 199 tests passed, typecheck,
  production build, and `git diff --check` passed.
- The recipient, capture, and hardware async recovery fixes are complete. The
  integrated Demo remains software-first, pull-only, source-backed, and hardware
  optional.
- GitHub access works through the Windows system proxy `127.0.0.1:7890`. Git
  does not inherit it automatically; for a push, set temporary `HTTP_PROXY` and
  `HTTPS_PROXY` variables in the command process only.
- The next useful action is a 现场 rehearsal or a new evidence-backed P1 issue;
  do not add persistence or new product scope without a concrete Demo need.
- The game-concept document has been confirmed as Loop's intended Agent game
  form and reviewed in `.loop/reports/concept-review-2026-08-02.md`. The current
  P0 is its Context, safety, provenance, and artifact foundation. The next product
  design should specify one playable Echo Map journey before implementation;
  sensor inference, persistent progression, and shared worlds remain later scope.
- `TASK-016-agent-game-first-playable-design.md` is complete and accepted after
  two independent review rounds. DR-016-01 through DR-016-03 are approved under
  V2-008, and Gate 5 has passed.
- `TASK-017-journey-domain-state-machine.md` is complete and accepted after three
  skeptical review rounds. Verification passed with 16 test files / 163 tests,
  typecheck, production build, and `git diff --check`.
- `TASK-018-offline-journey-orchestration.md` is complete and accepted. Verification
  passed with 18 test files / 183 tests, typecheck, build, and `git diff --check`.
- `TASK-019-echo-map-recipient-ui.md` is complete and accepted. Verification
  passed with 19 test files / 195 tests, typecheck, build, `git diff --check`, and
  desktop/narrow browser smoke.
- `TASK-020-echo-map-demo-integration.md` is complete and accepted. The first
  Echo Map playable is discoverable after recipient identity confirmation and
  integrated through postcard and lit node.
- Final verification: 19 test files / 199 tests, typecheck, production build,
  `git diff --check`, and desktop/narrow browser smoke passed.
- No implementation task is currently active. Further game nodes, persistence,
  sensors, routes, hardware, Memory Garden, or multiplayer require a new
  evidence-backed task and explicit scope decision.

## V2 implementation finding

The routed offline Demo now uses explicit Context, OriginalAsset, provenance,
generation policy, trigger policy, recipient-scoped Agent execution and
InteractionArtifact boundaries. Some legacy standalone fixtures and component
tests still use earlier `Person`, `Memory` or planned-interaction abstractions;
they are compatibility/test material, not the active routed integration path.

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
