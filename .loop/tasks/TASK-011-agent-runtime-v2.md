# TASK-011 — Recipient-scoped Agent runtime V2

## Owner

One OpenCode window, branch `feat/agent-runtime-v2`.

## Dependency

`TASK-009` approved and merged or made available in the worktree.

## Allowed files

- `src/features/agent/**`
- `src/adapters/agent/**`
- Agent tests only

Do not edit UI, capture, recipient, hardware, seed, or the shared domain
contracts. Submit an Interface Request for missing contract behavior.

## Deliverables

Implement a recipient-scoped runtime with three explicit output modes:

1. `source_replay` — original content;
2. `source_composition` — summary or arrangement of approved sources;
3. `bounded_persona_inference` — only when explicitly authorized, with source
   Context IDs, AI label, generation mode, confidence, sensitivity, and trigger
   reason.

Enforce:

- relationship and recipient isolation;
- owner review before derived content is exposed;
- source-required generation;
- allowed and forbidden topics;
- high-risk blocking;
- default `pull_only` trigger behavior;
- no new factual claims, major decisions, or unreviewed intent;
- no contact outside an active recipient-initiated entry.

## Acceptance criteria

- Every generated result carries source IDs and an explicit AI marker.
- Cross-relationship, private, unreviewed, and high-risk content is rejected.
- Tests prove the Agent is not a free personality chatbot.
- The runtime works with a deterministic mock adapter and no API key.
- Full tests and typecheck pass.

## Required OpenCode handoff

Create
`D:\Codex-Workspace\Loop\.loop\claims\TASK-011-<session-id>.md` before
editing. Write
`D:\Codex-Workspace\Loop\.loop\reports\TASK-011-agent-runtime-v2.md` after verification, including
source-trace examples and all denied-output cases.

## Test commands

```powershell
npm test -- src/features/agent --run
npm run typecheck
npm test -- --run
npm run build
```
