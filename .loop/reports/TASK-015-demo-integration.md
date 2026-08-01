# TASK-015 Demo Integration Report

## Outcome

Integrated one shared, judge-readable offline V2 path through the App Shell.
`OfflineDemoService` is the single in-memory state boundary for Context capture,
owner-reviewed derived content, V2 Agent lookup, recipient interaction, and
source-backed InteractionArtifact creation.

The main Demo no longer requires a plan, ring, HRV, passive sensing, random
push, family network, free personality simulation, or external API. The
hardware simulator remains optional and interchangeable with software fallback.

## Verified path

```text
Context text / simulated audio / image description
  -> relationship and recipient selection
  -> owner review and generation policy
  -> recipient actively enters and confirms identity
  -> V2 Agent source_replay + optional source_composition
  -> Context ID / Asset ID / generation mode / trigger provenance
  -> completed interaction creates postcard artifact
  -> recipient response is recipient-authored and ineligible as recorder context
  -> unavailable hardware can produce a traceable software fallback event
```

The integration smoke test renders `App`, records a new Context, approves its
derived suggestion, navigates into Recipient, verifies dynamic Context
provenance, creates the postcard, saves a response, and verifies unavailable
hardware fallback. The captured Context ID is dynamic, so the test proves the
recipient is reading the shared state rather than the former fixed fixture.

## Integration changes

- Added `src/data/offlineDemo.ts` with shared V2 Context, asset, policy,
  trigger-policy, Agent runtime repository, and artifact service wiring.
- Injected the shared capture service from `src/app/pages/CapturePage.tsx`.
- Injected the shared recipient data seam from
  `src/app/pages/RecipientPage.tsx`.
- Updated the Recipient feature seam to accept shared data, route by the saved
  Context ID, display the current source modality, and fall back to
  `source_replay` when AI composition was not approved.
- Passed the relationship ID from the simulator trigger UI so its default
  pull-only policy is evaluated in the correct relationship scope.
- Updated `README.md` and `.loop/DECISIONS.md` with the actual V2 path and
  integration conflict resolution.
- Added `src/app/App.integration.test.tsx`.

## Verification

- `npm test -- --run`: passed, 15 test files / 77 tests.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite production bundle generated.
- `git diff --check -- src/app src/data src/features/recipient src/features/hardware/HardwareSimulatorPage.tsx README.md`: passed.
- `git diff --check`: executed. It reports three pre-existing trailing-space
  lines in `00_PROJECT_CONTEXT.md`, an unrelated user/workspace change. No
  task-scope whitespace errors were reported.
- Vite dev server returned HTTP 200 at `http://127.0.0.1:4173/`.

## Manual Demo verification

The end-to-end sequence was verified by the App integration smoke test in
`src/app/App.integration.test.tsx`, including Context entry, owner review,
recipient entry, provenance, postcard, response, and software fallback.

The local environment has no Chrome, Edge, or Firefox executable, so a real
browser click-through, responsive layout inspection, and actual audio playback
could not be manually observed in this session. Simulated audio is a text data
URI and image input is a description placeholder; these are documented Demo
limits, not production media claims.

## Handoff status

TASK-015 is the only task window claiming end-to-end completion. Upstream reports
`TASK-009` through `TASK-014` were confirmed present before the TASK-015 claim
was created.
