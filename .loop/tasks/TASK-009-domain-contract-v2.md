# TASK-009 — Domain and shared contract V2

## Owner

One OpenCode window, branch `feat/domain-contract-v2`.

## Dependency

None. This task must be reviewed before the other V2 feature tasks begin.

## Evidence driving the task

The current code exposes `Person`, `Memory`, `OrganizedContent`,
`AgentPolicy`, and a foundation `HardwareEvent` in `src/domain/models.ts`.
The latest product definition requires explicit subject / recorder / recipient
roles, Context items, original and derived layers, provenance, generation policy,
trigger policy, and interaction artifacts.

## Allowed files

- `src/domain/**`
- `src/adapters/contracts/**`
- domain and contract tests
- `src/data/seed.ts` only when required to keep the existing fixture compiling

Do not edit feature UI, feature orchestration, hardware adapters, `README.md`,
or `.loop` reports beyond the required task claim and report.

## Deliverables

Define the smallest honest V2 contract for:

- `User` / `ActorRole` / subject-recorder-recipient-buyer relationship;
- `Relationship`;
- `ContextItem`;
- `OriginalAsset` and `DerivedContent`;
- `GenerationPolicy` with source requirement, allowed / forbidden topics,
  AI label requirement, and high-risk blocking;
- `TriggerPolicy` with default `pull_only`;
- `Interaction`, `InteractionArtifact`, and `FeedbackPreference`;
- a hardware-neutral event contract.

Preserve a migration path for the existing offline demo where practical, but do
not keep two competing public contracts. Make provenance include source Context
IDs and make generated output distinguishable from original content.

## Acceptance criteria

- Tests cover role invariants, visibility, provenance, policy defaults, and
  trigger defaults.
- The contract allows source-backed bounded generation but does not imply free
  personality cloning or new factual intent.
- The contract does not require a ring or any specific device.
- `npm run typecheck` and `npm test -- --run` pass.
- Report any breaking change in `.loop/reports/TASK-009-domain-contract-v2.md`.

## Non-goals

No UI, real AI call, persistence backend, hardware SDK, or full demo rewrite.

## Required OpenCode handoff

Before editing, create
`D:\Codex-Workspace\Loop\.loop\claims\TASK-009-<session-id>.md`. After
editing, write
`D:\Codex-Workspace\Loop\.loop\reports\TASK-009-domain-contract-v2.md` with changed files,
invariants, compatibility decisions, and unresolved Interface Requests.

## Test commands

```powershell
npm run typecheck
npm test -- src/domain --run
npm test -- --run
npm run build
```
