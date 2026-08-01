# TASK-013 — Recipient experience V2

## Owner

One OpenCode window, branch `feat/recipient-experience-v2`.

## Dependency

`TASK-009`, `TASK-011`, and `TASK-012` approved or available in the worktree.

## Allowed files

- `src/features/recipient/**`
- recipient tests and local styles only

Do not edit capture, Agent, hardware, domain, shared app shell, or data seed.

## Deliverables

Update the recipient flow so that:

- entry is explicitly user-initiated;
- default delivery is `pull_only`;
- no strong emotional content autoplays;
- original, derived, and AI-generated content are visibly different;
- provenance and source Context IDs are inspectable;
- the recipient can accept, postpone, skip, save, or close;
- a completed interaction creates and displays one InteractionArtifact;
- a shared plan is optional P1 content, not the core entry path;
- copy does not make a ring the primary product or software dependency;
- there is no free-form deceased-person chat.

## Acceptance criteria

- Existing explicit entry and identity checks remain intact.
- Tests cover original playback, AI label, source display, recipient choice, and
  artifact creation.
- A recipient response is stored as recipient-authored content.
- Full tests and typecheck pass.

## Required OpenCode handoff

Create
`D:\Codex-Workspace\Loop\.loop\claims\TASK-013-<session-id>.md` before
editing. Write
`D:\Codex-Workspace\Loop\.loop\reports\TASK-013-recipient-experience-v2.md` after verification. Do not
claim end-to-end completion; that belongs to `TASK-015`.

## Test commands

```powershell
npm test -- src/features/recipient --run
npm run typecheck
npm test -- --run
npm run build
```
