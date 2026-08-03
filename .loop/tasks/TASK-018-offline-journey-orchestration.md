# TASK-018 - Offline Journey Orchestration

## Role

One OpenCode window implements deterministic in-memory orchestration for the
accepted Echo Map slice. This task connects the TASK-017 domain to the existing
recipient-scoped Agent runtime and InteractionArtifact service without adding UI.

## Objective

Provide one injectable journey data port that executes and recovers the fixed
rainy-day flow from active recipient entry through postcard and lit node while
preserving relationship scope, source provenance, response ownership, stable
retry identity, and all terminal exits.

## Required Reading

1. `.loop/STATUS.md`, `.loop/DECISIONS.md`, `.loop/RISKS.md`, and queue
2. `.loop/reports/TASK-016-agent-game-first-playable-design.md`
3. `.loop/reports/TASK-017-journey-domain-state-machine.md`
4. `src/features/journey/domain/**`
5. `src/data/offlineDemo.ts`
6. Current Agent runtime, artifact service, recipient data port, and their tests
7. `.loop/checklists/quality-redlines.md`

## Ownership And Allowed Files

- `src/features/journey/services/**`
- `src/data/offlineDemo.ts`
- `src/data/offlineDemo.journey.test.ts`
- `.loop/claims/TASK-018--<session-id>.md`
- `.loop/reports/TASK-018-offline-journey-orchestration.md`

Do not modify journey domain, recipient UI, app routing, shared styles, hardware,
persistence, package files, or existing public domain contracts.

## Required Implementation

- A UI-neutral `EchoMapJourneyData` port with snapshot, session start, event
  methods, presentation load, response save/omit, postcard create/retry, node
  completion/retry, terminal exits, and reset behavior.
- One deterministic rainy-day proposal with the immutable Loop fallback. No
  recorder invitation may be shown because the current fixture has no approved
  invitation record.
- Active recipient-session validation before proposal/session creation.
- Stable journey and Interaction IDs, stable artifact request timestamp, and
  artifact lookup before create.
- Existing `RecipientScopedAgentRuntime` for original and optional composition.
- Existing `InteractionArtifactService` for the real postcard.
- In-memory maps for journey sessions, responses, proposals, artifacts, and node
  state under the shared offline Demo boundary.
- Atomic in-memory commit of the node and session result without an async gap.
- Typed recovery with no false completion on Agent, response, artifact, or node
  failure.
- `reset()` restores one available unlit node and deterministic counters.

## Acceptance Criteria

- Quiet loads only original; glimmer/deep load original plus policy-approved
  composition with source and owner-review evidence.
- Skip, close, stop, reject, and hide are stored and never create an artifact or
  lit node; stop after postcard may retain only that artifact.
- Recipient text and explicit omission both permit postcard creation; only text
  appears in the artifact and is attributed to the recipient.
- Postcard retry returns the same artifact and rejects a mismatched stored tuple.
- Node completion retry returns `already_completed`; a mismatched tuple conflicts
  without mutation.
- Cross-recipient, cross-relationship, private, unapproved, or unsolicited inputs
  cannot produce a proposal, presentation, artifact, or node completion.
- Reset clears journey progress and restores the deterministic fixture.
- Focused tests, full verification, and `git diff --check` pass.

## Handoff

Report files read/written, port methods, storage ownership, recovery behavior,
test counts, limitations, unresolved decisions, and explicit confirmation that no
UI, routing, persistence, or hardware code changed.
