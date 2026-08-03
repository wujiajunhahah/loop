# TASK-019 - Echo Map Recipient UI Report

## Result

Implemented and accepted the complete Echo Map recipient UI against the accepted
`EchoMapJourneyData` port. The explicit route is
`#/recipient/echo-map` with proposal, action, memory, response, postcard, and
completion subroutes.

## Files Written

- `src/features/journey/ui/EchoMapJourneyExperience.tsx`
- `src/features/journey/ui/EchoMapJourneyExperience.test.tsx`
- `src/features/journey/journey.css`
- `src/app/pages/RecipientPage.tsx`
- TASK-019 claim and this report

## Implemented Screens And Controls

- stable one-node Echo Map with neutral Traveling Messenger;
- accessible quiet/glimmer/deep segmented radio control;
- inspectable proposal with rationale, trigger, source IDs, Loop authorship,
  fallback action, skip, reject, hide confirmation, close, and back;
- explicit simulated action declaration and stop;
- source-first memory with no autoplay, optional original reveal, separate
  AI-composed layer, and per-layer provenance;
- recipient text or explicit omission before postcard;
- postcard with original/generated/recipient layers and provenance;
- postcard-preserving node retry, read-only lit/stopped states, and map resume;
- restart-required, loading, typed recovery, terminal, hidden, and rejected views.

## Recovery And Accessibility

- route rendering is guarded by stored Journey state;
- active states map back to their exact resumable route;
- module-level WeakMap requests deduplicate and reattach memory/postcard promises
  across StrictMode and component unmount/remount;
- node completion does not redirect after the user leaves the postcard route;
- error alerts receive focus; headings receive route focus;
- hide confirmation sets initial focus, traps Tab, supports Escape, and restores
  trigger focus;
- intensity controls have visible keyboard focus and native radio semantics;
- reduced motion disables node pulse while preserving status.

## Independent Review

Four review rounds drove fixes for terminal route misuse, async cleanup races,
completed/stopped postcard controls, hide confirmation, missing postcard-layer
provenance, focus handling, active-map resume, StrictMode, real unmount/remount,
and node redirect behavior. Final review accepted with no high or medium defect.

## Verification

- Focused UI: 1 file / 10 tests passed.
- Full suite: 19 files / 195 tests passed.
- Typecheck passed.
- Production build passed.
- `git diff --check` passed with existing line-ending warnings only.

## Browser Smoke

- Local URL: `http://127.0.0.1:5174/#/recipient/echo-map`.
- Edge headless desktop screenshot: 1440 x 1000, nonblank map and controls, no
  overlap or clipping.
- Edge headless narrow screenshot: 500 x 900 with CSS mobile layout, square map,
  wrapped labels/title, no horizontal clipping, and next controls visible.
- Edge headless enforces a 496px minimum inner viewport when passed 390px; 390px
  behavior is covered by max-width CSS constraints and component rendering, but
  a real-device 390px screenshot was not available in this environment.
- Screenshot files are in the approved temporary directory:
  `loop-echo-desktop-2.png` and `loop-echo-mobile-500.png`.

## Limitations

- TASK-019 adds the explicit route seam only. Discoverable entry from the
  existing recipient identity screen and App-level full-flow evidence belong to
  the final integration task.
- No persistence, GPS, sensors, hardware requirement, LLM, recorder invitation,
  progression garden, reward, streak, or multiplayer UI was added.

## Unresolved Decisions

None for the first offline slice.
