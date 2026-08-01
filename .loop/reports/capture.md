# Capture Session Report

## Scope

Implemented the creator-side capture MVP within `src/features/capture/**`, with only local route and style wiring outside that boundary. The flow is available at:

- `/capture`: recorder entry and flow overview
- `/capture/new`: new record form
- `/capture/review`: original and AI-organized preview, plus policy confirmation
- `/capture/success`: save confirmation and optional next capture

## Delivered

- Text, simulated audio, and image placeholder input modes.
- Relationship selection using the FOUNDATION `RelationshipStore`.
- Topic and explicit reason-for-recipient fields.
- Content labels for real memory, future blessing, shared plan, original-only playback, and AI organization.
- Optional shared-plan title and invitation fields in the capture form.
- Separate original content and AI-organized preview panels.
- AI organization is off by default and is disabled for original-only records.
- Final save is blocked until the recorder confirms the reviewed AI boundary.
- Basic validation and visible error messages for required fields and policy confirmation.
- Saving uses `ContextCaptureService.capture`; no direct mutation of domain state was added.

## Interfaces Used

- `ContextCaptureService.capture` saves the relationship-scoped original memory.
- `RelationshipStore.getRelationship` loads the available recipient relationship.
- `AgentPolicy` is constructed during review with `allowAiOrganization`, `allowParaphrase`, `allowNewMemoryGeneration: false`, and recipient-entry delivery policy.

## Tests

- `npm test -- --reporter dot`: passed, 11 files / 41 tests.
- Capture-specific test: passed, 3 tests.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite emitted the production bundle successfully.
- `git diff --check`: passed for this change set.

## Interface Request

FOUNDATION should consider adding the following in a future interface revision, without changing them in this task:

1. A relationship listing or recipient directory method. The current capture flow must use the seeded relationship id because `RelationshipStore` can only query a relationship by known id.
2. A policy persistence service or policy field on the capture contract. The current flow reviews an `AgentPolicy` in memory, but the policy cannot be saved through the provided contracts.
3. A first-class content type on `Memory` and `CaptureMemoryInput`. The five requested labels currently have to be encoded in the topic and local UI state.
4. A `PlannedInteraction` creation method. The MVP collects the optional shared-plan title and invitation, but cannot persist a plan without bypassing the service boundary.
5. A capture output/update operation that can persist reviewed `OrganizedContent` alongside the new memory. `capture` currently accepts only original memory input, so the AI-organized preview remains a review-time projection.

Potential impact: these additions would make policy, content classification, organized provenance, recipient discovery, and future plans durable and queryable for the recipient and agent flows. They should be reviewed as a coordinated contract change because they affect agent orchestration and recipient presentation.

## Remaining Issues

- The simulated audio and image modes persist placeholder URIs with text entered by the recorder; hardware/media adapters are outside this task.
- Shared-plan fields are captured for the demo UI but are not persisted until a plan service is available.
