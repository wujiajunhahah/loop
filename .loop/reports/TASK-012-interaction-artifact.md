# TASK-012 InteractionArtifact Report

## Outcome

Implemented a deterministic offline `InteractionArtifactService` for postcard,
letter, and memory-card artifacts. The service consumes the approved V2
`Interaction`, `V2Relationship`, `GenerationPolicy`, `ContextItem`,
`OriginalAsset`, `Provenance`, and `InteractionArtifact` contracts. It performs
no remote model or media calls and does not import or write Agent context.

## Changed files

- `src/features/artifact/types.ts`
- `src/features/artifact/errors.ts`
- `src/features/artifact/InteractionArtifactService.ts`
- `src/features/artifact/InteractionArtifactService.test.ts`
- `src/features/artifact/index.ts`
- `.loop/claims/TASK-012-opencode-20260802-task012.md`
- `.loop/reports/TASK-012-interaction-artifact.md`

No Recipient UI, App routing, capture, Agent, hardware, shared domain, or
artifact adapter file was changed.

## Artifact schema

`SourceBackedInteractionArtifact` structurally extends the approved V2
`InteractionArtifact` with:

- required `generatedSummary`, copied exactly from the completed interaction
  output;
- `generationLabel`: `AI-generated` or `Original source`;
- complete V2 `Provenance`, including Context IDs, asset IDs, generation mode,
  AI flag, model when present, and provenance creation time;
- optional `recipientResponseAttribution` with recipient author ID, fixed
  `authorRole: recipient`, and `eligibleAsRecorderContext: false`.

Artifact IDs are deterministically derived as `artifact:<interaction-id>`, and
artifact creation time is the completed interaction time. The default type is
`postcard`; callers can explicitly select `letter` or `memory_card`.

## Source validation evidence

Creation rejects an interaction unless it is completed and has output with
valid V2 provenance. Every provenance Context ID must be listed in the supplied
relationship generation policy, be supplied to the service, and pass V2
recipient visibility checks. Composition sources must also use an allowed,
non-forbidden topic and an approved generation mode. Every provenance asset ID
must belong to one of those approved Contexts; supplied original assets are
cross-checked against their Context IDs.

The focused tests prove rejection for no policy-approved Context, missing
Context, private Context, cross-recipient Context, unapproved composition topic,
incomplete interaction, missing output, and invalid asset provenance. They also
prove deterministic output, queryable stored provenance, all three artifact
types, and exact source replay without generated additions.

Recipient responses require the interaction recipient's ID at runtime. Stored
attribution is immutable, explicitly recipient-authored, and explicitly
ineligible as recorder Agent context. A recorder ID is rejected in tests.

## Verification

- `npm test -- src/features/artifact --run`: passed, 1 file / 6 tests.
- `npm run typecheck`: passed.
- `npm test -- --run`: passed, 14 files / 74 tests.
- `npm run build`: passed, TypeScript project build and Vite production build.
