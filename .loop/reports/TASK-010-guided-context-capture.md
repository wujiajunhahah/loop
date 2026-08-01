# TASK-010 Guided Context Capture Report

## Outcome

Replaced the fixed legacy relationship form with a guided V2 Context editor on
branch `feat/guided-context-capture`. The implementation is contained in
`src/features/capture/**`; no Domain, Agent, recipient, hardware, app shell,
seed, or shared service implementation was modified by this task.

## Changed files

- `src/features/capture/CaptureFlow.tsx`
- `src/features/capture/CaptureFlow.test.tsx`
- `src/features/capture/captureTypes.ts`
- `src/features/capture/captureService.ts`
- `src/features/capture/capture.css`
- `.loop/claims/TASK-010-opencode-20260802-task010.md`
- `.loop/reports/TASK-010-guided-context-capture.md`

## Delivered behavior

- Lists relationships and their recipients instead of loading a fixed ID.
- Displays subject, recorder/editor, recipient, and buyer as separate roles.
- Captures text, simulated audio, and image descriptions as original assets.
- Captures topic, why the item matters, intended scenarios, importance,
  sensitivity, and optional emotion weights.
- Labels user-entered and model-suggested emotion values as editable weights,
  never as emotion detection; model suggestions require an extra review step.
- Keeps original material separate from AI-derived summaries in the review UI
  and persisted aggregate.
- Requires each AI suggestion to be approved, edited and approved, removed, or
  rejected. Pending or actively edited suggestions block save.
- Persists Context, original asset, accepted derived content, provenance,
  generation policy, and trigger policy through a capture-local service port.
  The default in-memory service independently validates relationship scope,
  owner review, provenance, and policy scope before storing cloned values.
- Does not import or mutate `demoPolicies`, `demoPlans`, returned memory objects,
  or other legacy fixture state.
- Keeps shared plans entirely outside the P0 save aggregate and flow.

## Contract mismatches / interface request

The approved shared contracts are insufficient for direct integration without
changes owned by a later integration task:

- `RelationshipContextPort` can fetch one known relationship but cannot list the
  relationships and role-bearing users available to the recorder.
- `ContextCapturePort.capture` persists only `ContextItem` and `OriginalAsset`.
  It has no operation for an atomic reviewed save containing `DerivedContent`,
  provenance, `GenerationPolicy`, and `TriggerPolicy`.
- `OriginalAsset` has only a URI and no text/blob payload or media-store port.
  The capture-local implementation therefore uses an encoded data URI for the
  simulated original asset.
- `ContextItem` stores emotion label/intensity but not whether the value was
  owner-entered or model-suggested. The editor enforces that distinction during
  review, but the shared persisted type cannot retain the origin.
- `DerivedContent` records successful owner review but has no rejected/removed
  review state. Rejected and removed suggestions are intentionally omitted from
  the saved aggregate.

TASK-010 uses the capture-local `GuidedCapturePort` as the temporary interface.
A shared relationship-directory and reviewed-capture transaction contract
should be reconciled by the owning contract/integration task; no shared contract
or service file was changed here.

## Verification

- `npm test -- src/features/capture --run`: passed, 1 file / 4 tests.
- `npm run typecheck`: passed.
- `npm test -- --run`: passed, 14 files / 74 tests.
- `npm run build`: passed, Vite production build completed.
