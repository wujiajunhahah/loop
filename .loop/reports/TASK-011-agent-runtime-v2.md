# TASK-011 Recipient-scoped Agent Runtime V2 Report

## Outcome

Implemented a recipient-scoped V2 Agent runtime with exactly three output
modes: `source_replay`, `source_composition`, and
`bounded_persona_inference`. The V1 Agent remains available for the existing
offline Demo; no UI, capture, recipient, hardware, seed, or shared domain
contract file was changed by TASK-011.

The runtime requires an entrusted V2 relationship and an active
recipient-initiated `Interaction`. It applies relationship, recipient, source,
topic, generation, trigger, high-risk, safety, and owner-review checks before
returning content. There is no free-chat or unrestricted personality API.

## Changed files

- `src/features/agent/RecipientScopedAgentRuntime.ts`
- `src/features/agent/runtimeTypes.ts`
- `src/features/agent/runtime.test.ts`
- `src/features/agent/errors.ts`
- `src/features/agent/index.ts`
- `src/adapters/agent/InMemoryAgentRuntimeRepository.ts`
- `src/adapters/agent/DeterministicAgentGenerationAdapter.ts`
- `src/adapters/agent/DeterministicOwnerReviewAdapter.ts`
- `src/adapters/agent/index.ts`
- `.loop/claims/TASK-011-opencode-20260802-task011.md`
- `.loop/reports/TASK-011-agent-runtime-v2.md`

## Source traces

`source_replay` example:

```text
outputMode: source_replay
sourceContextIds: [context-a]
sourceAssetIds: [asset-a]
generationMode: source_replay
aiGenerated: false
aiLabel: Original source
triggerReason: user_opened
```

`source_composition` example:

```text
outputMode: source_composition
sourceContextIds: [context-a]
sourceAssetIds: [asset-a]
generationMode: source_composition
aiGenerated: true
aiLabel: AI-generated
confidence: 1
ownerReview: owner-a at 2026-08-02T12:00:00.000Z
```

`bounded_persona_inference` example:

```text
outputMode: bounded_persona_inference
sourceContextIds: [context-a]
generationMode: persona_inference
aiGenerated: true
aiLabel: AI-generated
confidence: 0.75
sensitivity: medium
triggerReason: user_opened
```

`bounded_persona_inference` maps to the TASK-009 domain provenance value
`persona_inference`; the narrower runtime output name remains explicit on
`outputMode`.

## Denied output cases

- Relationship boundary: missing relationship, non-V2 relationship, and any
  relationship not in `entrusted` state.
- Recipient boundary: mismatched relationship or recipient, non-recipient
  initiation, and completed interactions.
- Policy boundary: missing or cross-relationship generation policy, disallowed
  output mode, forbidden topic, topic absent from the generation allowlist,
  high-risk request, and an unauthorized trigger.
- Trigger boundary: absent trigger policy falls back to `pull_only` with
  `user_opened`; non-pull modes require opt-in and an allowed reason.
- Source boundary: no source, missing source, private source,
  cross-relationship or wrong-recipient source, source outside the policy
  allowlist, multiple replay sources, and missing or mismatched original asset.
- Generated-content boundary: empty/invalid adapter result, confidence outside
  0..1, a new factual claim, a major decision, or unreviewed intent.
- Review boundary: rejected review, missing review identity/time, or review by
  anyone other than the relationship owner.
- Chat boundary: unknown modes such as `free_chat` are rejected with
  `MODE_NOT_ALLOWED`; the generation adapter receives only approved sources,
  an allowlisted topic, and one bounded generation mode.

Tests directly cover all acceptance-critical denials: cross-recipient,
inactive/non-recipient entry, private, cross-relationship, unapproved and empty
sources, missing original assets, unsolicited triggers, disallowed/free-chat
modes, forbidden/unapproved topics, high risk, new facts, major decisions,
unreviewed intent, and absent/wrong-owner review.

## Deterministic adapters

`DeterministicAgentGenerationAdapter` derives output only from approved source
meanings and returns explicit safety declarations and confidence. It requires
no API key. `DeterministicOwnerReviewAdapter` makes owner-review outcomes
controllable and reproducible in tests. `InMemoryAgentRuntimeRepository`
provides deterministic V2 relationship, Context, asset, and policy lookup.

## Verification

- `npm test -- src/features/agent --run`: passed, 2 files / 24 tests.
- `npm run typecheck`: passed.
- `npm test -- --run`: passed, 14 files / 73 tests.
- `npm run build`: passed, TypeScript project build and Vite production build.

The shared workspace branch was changed concurrently by TASK-014 after this
session created `feat/agent-runtime-v2`; TASK-011 modified only its claimed
source scope and required handoff files.
