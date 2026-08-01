# TASK-014 — Hardware-neutral trigger policy and simulator cleanup

## Owner

One OpenCode window, branch `feat/hardware-neutral-trigger`.

## Dependency

`TASK-009` approved and merged or made available in the worktree.

## Allowed files

- `src/features/hardware/**`
- `src/adapters/hardware/**`
- hardware tests only

Do not edit `src/domain/**`, app routes, recipient UI, or capture.

## Deliverables

- Keep the simulator generic across touch, tap, gesture, NFC, BLE, and software
  fallback.
- Ensure the business layer consumes one verified hardware-neutral event shape.
- Remove any remaining ring-specific assumptions from the hardware feature.
- Represent trigger reason and policy outcome explicitly.
- Default all triggers to `pull_only`; no random or strong proactive push.
- Preserve binding, entrustment, identity mismatch, duplicate-event, and
  unavailable-hardware behavior.
- Document how the old foundation bridge differs from the feature bridge and
  propose one consolidation path without silently changing another task's files.

## Acceptance criteria

- All supported event sources enter the same recipient boundary.
- Simulator tests cover fallback and policy rejection.
- No real SDK or hardware is required.
- Full tests and typecheck pass.

## Required OpenCode handoff

Create
`D:\Codex-Workspace\Loop\.loop\claims\TASK-014-<session-id>.md` before
editing. Write
`D:\Codex-Workspace\Loop\.loop\reports\TASK-014-hardware-neutral-trigger.md` after verification,
including the relationship between the old foundation contract and the feature
bridge.

## Test commands

```powershell
npm test -- src/features/hardware src/adapters/hardware --run
npm run typecheck
npm test -- --run
npm run build
```
