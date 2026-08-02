# OMI-RING-008 - iOS device center and Loop interaction design

## Objective
Build a quiet device center that makes connection, capability, live data, diagnostics, consent, and simulation understandable inside the existing Loop narrative.

## Allowed files
- src/features/devices/**
- src/app/App.tsx
- src/styles/global.css
- UI tests
- Icon dependency only if necessary

## Dependencies
OMI-RING-007 plus the transcribed interaction requirements attached before execution.

## Non-goals
No marketing landing page, medical score, grief score, hidden auto-play, decorative redesign, or nested card UI.

## Implementation notes
Add #/devices with scan/connect/disconnect, OMI and ring sections, capability status, restrained live measurements, signal/data freshness, consent controls, simulator toggle, and a collapsible diagnostic view. A hardware mark_moment event may offer recorder flow, but requires explicit user action before microphone/camera/content capture. Use familiar icons with accessible labels and tooltips.

## Recording-derived interaction requirements
- Make the experience work in two explicit modes: creator capture and recipient companionship.
- In creator capture, a physical touch/mark can open a low-pressure, guided conversation. Do not force an immediate answer or make the user manage a complex form.
- In recipient mode, the app should feel like an optional companion: preserve original recordings and memories, let the recipient explore context, and avoid claiming to heal grief.
- Treat a memory seed as a real source plus relationship, situation, and creator intent. A generated image/video or response must be visibly derived and must never invent an unapproved new will.
- Support a compact "I am here" / 我在 identity cue and an explicit prompt to speak or respond. The interaction may be playful or warm, but not a surprise autoplay.
- Prefer structured, human-authored prompts and bounded QA over an unconstrained impersonation chat. Replies can combine recipient input, prior approved material, and contextual signals.
- Context examples include weather, a photo, a shared plan, or a small daily action. Sensor data is only weak context and never an emotion detector.

## Acceptance criteria
- Loading, empty, permission-denied, scanning, connecting, connected, partial-capability, stale-data, disconnect, reconnect, and simulated states are complete.
- Telemetry is never described as detecting grief or deciding when emotional content plays.
- 320px mobile, desktop, safe areas, long labels, keyboard, screen reader, and reduced motion do not overlap or shift layout.
- Existing capture and recipient behavior remains intact.

## Required checks
UI tests, npm run typecheck, npm test, npm run build, Playwright desktop/mobile screenshots.

## Real-device validation status
UI and simulator validated; native scan/notification requires physical iPhone.

## Conflict boundary
Do not modify protocol parsers, transport internals, existing capture/recipient policy behavior, or native files.
