# TASK-020 - Echo Map Demo Integration Report

## Result

The first Echo Map playable is integrated into the current W·HERE recipient
Demo. The existing response flow remains available; identity confirmation now
offers a separate Echo Map journey entry.

## Integration Changes

- Added `进入 Echo Map 旅程` after recipient identity confirmation.
- Kept the original `继续到今天的回应` path and existing capture/hardware flows.
- Added an in-memory entry grant. Direct or refreshed Echo Map URLs without
  confirmation show identity-required recovery and create no JourneySession.
- Captured one timestamp per frozen offline Agent run so owner review and
  provenance remain deterministic and correctly ordered under the real clock.
- Added an App-level glimmer journey from `/recipient` through identity,
  proposal, action, original/AI layers, recipient response, postcard, and lit node.
- Updated README with the runnable two-minute Echo Map route and verified counts.

## Evidence

- App test proves exact original and composition Context IDs, Asset IDs,
  `aiGenerated` values, labels, and modes.
- App test proves recipient response attribution and exclusion from recorder
  Context.
- Direct-route test proves no session is created without identity confirmation.
- Existing recipient tests prove the original response route remains available.
- Journey domain, orchestration, UI, capture, Agent, artifact, hardware, and
  existing App tests all remain green.

## Scope Reconciliation

`src/data/offlineDemo.ts` was added to TASK-020 ownership after App integration
exposed a real-clock timestamp mismatch that fixed-time TASK-018 tests could not
reproduce. The change is limited to using one captured timestamp for the frozen
Agent review/provenance call. No accepted policy or source boundary changed.

`src/features/journey/journey.css` belongs to completed TASK-019 browser-smoke
corrections and is recorded in the TASK-019 report, not as TASK-020 scope.

## Verification

- Integration focus: 2 files / 11 tests passed.
- Full suite: 19 files / 198 tests passed.
- Typecheck passed.
- Production build passed.
- `git diff --check` passed with existing line-ending warnings only.
- Desktop identity-entry smoke: 1440 x 1000 passed.
- Narrow identity-entry smoke: 500 x 900 passed with no overlap or clipping.
- Echo Map desktop and narrow smoke evidence is recorded in TASK-019.
- Local Demo URL: `http://127.0.0.1:5174/#/recipient`.

## Limitations

- Identity authorization is in-memory Demo state, not production authentication.
- Refresh intentionally requires confirmation again.
- Journey progress, hide, reject, and completion reset with the Demo.
- The first playable remains one relationship, one rainy-day source, one neutral
  fallback action, and one map node.
- No persistence, GPS, sensors, real hardware requirement, LLM, generated wish,
  reward, streak, Memory Garden, or multiplayer scope was added.

## Final Judgment

TASK-016 through TASK-020 now provide an implementation-ready design, pure
state machine, deterministic offline orchestration, responsive recipient UI, and
discoverable integrated Demo for the first Agent-game vertical slice.
