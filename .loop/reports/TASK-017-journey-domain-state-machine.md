# TASK-017 - Journey Domain And State Machine Report

## Result

Implemented and independently reviewed the pure domain foundation for the first
Echo Map vertical slice. The implementation is confined to
`src/features/journey/domain/**` and introduces no orchestration, shared Demo
state, routing, UI, persistence, hardware, package, or existing domain changes.

## Files Written

- `src/features/journey/domain/types.ts`
- `src/features/journey/domain/journey.ts`
- `src/features/journey/domain/index.ts`
- `src/features/journey/domain/journey.test.ts`
- `.loop/claims/TASK-017--opencode-20260802-181500-task017.md`
- `.loop/reports/TASK-017-journey-domain-state-machine.md`

## Exported Contracts

- Journey intensity, output mode, state, terminal state, proposal request/result,
  source selection, and fallback reason.
- `ApprovedJourneyInvitation` and discriminated recorder/Loop action authorship.
- `JourneyPresentation` backed by existing `RecipientAgentResult` contracts.
- Recipient response with `eligibleAsRecorderContext: false`.
- `JourneySession`, `EchoMapNodeState`, node completion input/result, postcard
  view, typed events, validation inputs, and `JourneyError` codes.
- `LOOP_FALLBACK_ACTION` with immutable fixture ID and exact neutral text.

## State And Event Table

| State | Accepted event | Next state |
|---|---|---|
| `map_ready` | select intensity | `intensity_selected` |
| `map_ready`, `intensity_selected` | close | `closed` |
| `intensity_selected` | inspect proposal | `proposal_inspected` |
| `proposal_inspected` | accept validated action | `action_accepted` |
| `proposal_inspected` | skip | `skipped` |
| `proposal_inspected` | reject | `rejected` |
| eligible pre-artifact states | confirmed hide | `hidden` |
| accepted through postcard-created states | stop | `stopped` |
| `action_accepted` | complete explicit action | `action_completed` |
| `action_completed` | open validated presentation | `memory_opened` |
| `memory_opened` | save recipient response/omission | `response_recorded` |
| `response_recorded` | request postcard | `postcard_creating` |
| `postcard_creating` | accept matching artifact | `postcard_created` |
| `postcard_creating` | postcard failure | `response_recorded` |
| `postcard_created` | node failure | `postcard_created` |
| `postcard_created` plus matching node/artifact | atomic completion | `node_lit` |

Direct `LIGHT_NODE` through the general reducer is rejected. The only completion
entry is `completeEchoMapNode`, which returns both updated records together.

## Enforced Invariants

- Automation reduces or preserves intensity and never raises it.
- Proposal entry requires an active, recipient-initiated, relationship-matching
  session and unique visible policy-approved Context sources.
- Quiet permits source replay only. Composition requires both higher recipient
  intensity and generation-policy authorization.
- Recorder actions require an exact owner-reviewed invitation in the same
  relationship and recipient scope. The Loop fallback cannot be relabeled.
- Memory opening requires full recipient-scoped Agent results, `user_opened`,
  approved visible Context and Asset provenance, and owner-reviewed composition.
- Recipient text or explicit omission is relationship-scoped and cannot become
  recorder Context.
- Postcard acceptance compares the real `SourceBackedInteractionArtifact` with
  the stable Interaction ID, request time, exact output, response, source asset,
  provenance, AI label, and recipient attribution.
- Node completion requires the deterministic artifact ID and matching
  relationship/recipient/session/node tuple. Same-tuple replay is idempotent;
  mismatched or stale links return a typed conflict without mutation.
- `completedAt` is created only by successful node completion. Every other
  terminal state remains incomplete.
- Event, invitation, review, response, provenance, request, and completion times
  are validated where they enter the domain boundary.

## Independent Review

Three skeptical review rounds found and drove fixes for:

- direct completion bypass;
- ID-only action, presentation, response, and artifact acceptance;
- cross-relationship invitation and Context access;
- missing composition-policy and quiet-intensity guards;
- incomplete artifact retry tuple comparison;
- duplicate invitation sources and stale node links;
- non-monotonic or malformed timestamps.

The final review found no remaining high or medium implementation defect.

## Verification

- Focused: 1 test file / 78 tests passed.
- Full suite: 16 test files / 163 tests passed.
- Typecheck passed.
- Production build passed.
- `git diff --check` passed with existing line-ending warnings only.
- No source file outside `src/features/journey/domain/**` was changed by the
  TASK-017 implementation.

## Limitations

- Contracts and reducers are not yet connected to `OfflineDemoService`.
- There is no journey repository, proposal assembler, runtime/artifact
  orchestrator, UI, route, browser persistence, GPS, sensor, LLM, or hardware
  dependency in this task.
- Atomicity is represented by a pure two-record completion result; the next
  in-memory orchestration task must validate first and commit both map writes
  without an asynchronous boundary.

## Unresolved Decisions

None. The implementation follows accepted TASK-016 and V2-008 contracts.

## Recommended Next Task

Implement deterministic offline journey orchestration and in-memory repositories
using these contracts, existing `RecipientScopedAgentRuntime`, and existing
`InteractionArtifactService`, without UI work.

No orchestration or UI was changed by TASK-017.
