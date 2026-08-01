# TASK-012 — InteractionArtifact / 远行明信片

## Owner

One OpenCode window, branch `feat/interaction-artifact`.

## Dependency

`TASK-009` approved and merged or made available in the worktree.

## Allowed files

- `src/features/artifact/**` (new)
- artifact service tests
- minimal adapter files under `src/adapters/artifact/**` if needed

Do not edit recipient UI, app routing, capture, Agent, hardware, or shared
domain files. The artifact service must consume the approved V2 contract.

## Deliverables

Create a deterministic offline service that turns one completed interaction into
an `InteractionArtifact` containing:

- `type`: postcard, letter, or memory card;
- source Context IDs;
- an original quote reference where available;
- generated summary or composition;
- creation time;
- recipient response;
- AI-generated label and provenance.

The service must not invent content without sources and must work without a
remote model or media backend.

## Acceptance criteria

- Artifact creation fails clearly when no approved source exists.
- Artifact provenance is queryable in tests.
- Recipient response is attributed to the recipient and cannot become the
  recorder's authored Agent context by accident.
- Full tests and typecheck pass.

## Required OpenCode handoff

Create
`D:\Codex-Workspace\Loop\.loop\claims\TASK-012-<session-id>.md` before
editing. Write
`D:\Codex-Workspace\Loop\.loop\reports\TASK-012-interaction-artifact.md` after verification, including
the artifact schema and source validation evidence.

## Test commands

```powershell
npm test -- src/features/artifact --run
npm run typecheck
npm test -- --run
npm run build
```
