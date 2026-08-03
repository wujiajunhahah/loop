# TASK-017 - Journey Domain And State Machine

## Role

One OpenCode window implements the pure domain and transition foundation for the
accepted first Echo Map playable. This task writes no UI, orchestration, shared
Demo state, routing, persistence, hardware, or package configuration.

## Objective

Implement the exact TASK-016 journey contracts and a deterministic pure state
machine so later orchestration can safely execute:

```text
choose intensity -> inspect proposal -> accept action -> complete action
-> open sourced memory -> record response -> create postcard -> light node
```

All non-completion exits must remain terminal and incapable of lighting a node.

## Required Reading

Read in order:

1. `00_PROJECT_CONTEXT.md`
2. `.loop/STATUS.md`
3. `.loop/DECISIONS.md`, especially V2-002, V2-003, V2-007, and V2-008
4. `.loop/RISKS.md`
5. `.loop/INTEGRATION_QUEUE.md`
6. `.loop/reports/TASK-016-agent-game-first-playable-design.md`
7. `.loop/checklists/quality-redlines.md`
8. `src/domain/contracts.ts`, `src/domain/models.ts`, and existing state-machine
   test patterns in `src/domain/policy.test.ts` and `src/features/agent/agent.test.ts`

If implementation requires changing an accepted TASK-016 contract, stop and
write a Decision Request in the task report instead of weakening the boundary.

## Ownership And Allowed Files

Before implementation create:

`D:\Codex-Workspace\Loop\.loop\claims\TASK-017--<session-id>.md`

This task may write only:

- `src/features/journey/domain/**`
- `.loop/claims/TASK-017--<session-id>.md`
- `.loop/reports/TASK-017-journey-domain-state-machine.md`

Do not modify existing domain contracts, Agent/artifact/recipient code,
`OfflineDemoService`, app routing, shared styles, package files, or coordination
files. Export integration belongs to a later task unless a separate ownership
decision approves it.

## Required Implementation

- `JourneyIntensity`, ordered intensity comparison, and a pure reduction rule
  where automation may lower but never raise recipient-selected intensity.
- `ApprovedJourneyInvitation` and validation against relationship, recipient,
  recorder membership, owner review, exact text, source IDs, approved status, and
  non-AI authorship.
- Discriminated `JourneyAction` authorship for approved recorder invitations and
  immutable Loop fallback `fallback-rain-window-v1`.
- `JourneyProposal`, source selection, proposal provenance, presentation, response,
  session, map-node, completion input/result, event, state, and typed error shapes
  defined by TASK-016.
- A pure transition function covering every accepted state/event/guard pair.
- Terminal behavior for `node_lit`, `skipped`, `stopped`, `rejected`, `hidden`,
  and `closed`.
- Journey `completedAt` only on successful `LIGHT_NODE`; Interaction completion
  remains a separate later orchestration concern.
- A pure node-completion reducer that is idempotent for the same tuple and returns
  `NODE_COMPLETION_CONFLICT` for another session or artifact without mutation.
- No generated wish, inferred emotion, GPS, sensor, persistence, hardware,
  reward, streak, score, or autonomous deceased-person model.

## Acceptance Criteria

- Table-driven tests cover every valid transition and representative invalid
  transitions from every terminal state.
- Skip, close, stop before postcard, reject, and hide cannot set `artifactId` or
  `completedAt` and cannot light a node.
- Stop from `postcard_created` may retain the same artifact but cannot set journey
  `completedAt` or light a node.
- `LIGHT_NODE` requires `postcard_created`, matching session/node/artifact scope,
  and a completion timestamp; only it produces `node_lit` and `completedAt`.
- Repeating the same node completion returns `already_completed` without mutation;
  a mismatched tuple returns `NODE_COMPLETION_CONFLICT` without mutation.
- Invalid recipient, relationship, recorder, reviewer, source, empty text,
  generated attribution, and non-approved invitation records are rejected.
- Loop fallback and recorder invitation authorship cannot be substituted.
- Intensity tests prove no automatic upgrade for all intensity pairs.
- Existing tests remain green; typecheck and production build pass.
- `git diff --check` passes and no file outside task ownership is changed by this
  task.

## Required Verification

Run and record:

```text
npm test -- --run src/features/journey/domain
npm run verify
git diff --check
```

## Handoff

The report must list files read and written, exported contracts, state/event
table, invariants, test counts, verification output, limitations, unresolved
decisions, and an explicit statement that no orchestration or UI was changed.
