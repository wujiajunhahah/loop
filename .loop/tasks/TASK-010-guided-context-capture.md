# TASK-010 — Guided Context capture and editor

## Owner

One OpenCode window, branch `feat/guided-context-capture`.

## Dependency

`TASK-009` approved and merged or made available in the worktree.

## Allowed files

- `src/features/capture/**`
- capture tests and local capture styles only

Do not edit `src/domain/**`, Agent, recipient, hardware, app shell, seed, or
shared service implementations. Submit an Interface Request if the approved
contract is insufficient.

## Deliverables

Replace the current hard-coded single relationship form with a guided Context
editor that:

- distinguishes subject, recorder/editor, recipient, and buyer;
- uses a relationship / recipient list rather than a fixed relationship ID;
- accepts text, simulated audio, and image input;
- captures why the item matters and intended scenarios;
- supports user-entered or model-suggested emotion labels only as weights, never
  as reliable emotion detection;
- shows original material and derived AI content separately;
- lets the owner approve, edit, remove, or reject AI suggestions;
- persists policy, derived content, and provenance through service contracts;
- keeps shared plans optional and outside the P0 save path.

## Acceptance criteria

- No direct mutation of `demoPolicies`, `demoPlans`, or returned memory objects
  from the UI.
- Original content remains available after AI processing.
- AI suggestions cannot be saved without explicit owner review.
- A capture test proves recipient and relationship scoping.
- `npm run typecheck`, capture tests, and full tests pass.

## Non-goals

No free chat, no HRV, no passive sensing, no family network, and no hardware
integration.

## Required OpenCode handoff

Create
`D:\Codex-Workspace\Loop\.loop\claims\TASK-010-<session-id>.md` before
editing. Write
`D:\Codex-Workspace\Loop\.loop\reports\TASK-010-guided-context-capture.md` after verification. The
report must list any contract mismatch instead of modifying another task's
files.

## Test commands

```powershell
npm test -- src/features/capture --run
npm run typecheck
npm test -- --run
npm run build
```
