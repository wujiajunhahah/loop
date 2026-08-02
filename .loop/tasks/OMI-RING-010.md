# OMI-RING-010 - Integration tests, documentation, and final audit

## Objective
Prove browser fallback and native boundaries work together, document truthful support, and close regressions found by audit.

## Allowed files
- Cross-module integration and app tests
- README.md
- docs/hardware/**
- .loop/reports/**
- Minimal production fixes required by failing checks

## Dependencies
OMI-RING-001 through OMI-RING-009 and all requirements extracted from the supplied recording.

## Non-goals
No new feature family, unsupported hardware promise, medical claim, secret, or broad refactor.

## Implementation notes
Exercise simulator-to-runtime-to-UI, mark-moment handoff, disconnect recovery, partial profiles, parse failures, privacy defaults, and existing recorder/recipient flows. Maintain a support table separating implemented, simulator-verified, iPhone-build-verified, physical-device-verified, and vendor-profile-required behavior.

## Recording-derived audit cases
- Creator can mark a moment, enter a bounded conversational capture, review provenance, and explicitly save or cancel.
- Recipient can open a memory seed, see why it was selected for them, choose a text/image/audio presentation, and send a response without the system faking an immediate reply from an absent person.
- Context-aware presentation can use weather/photo/plan inputs while showing source and generated status.
- Tests prove that touch does not equal permission to record, and telemetry does not trigger grief language or unsolicited playback.
- The UI and docs may use 我在 / I am here as a product cue, but must not imply literal presence or digital resurrection.

## Acceptance criteria
- Legacy and new critical paths pass.
- Build output has no secrets, absolute local paths, or raw sensitive logs.
- README explains web demo, iOS setup, OMI/ring configuration, troubleshooting, and known limitations.
- Final report lists exact checks and never claims hardware verification that did not occur.

## Required checks
npm run typecheck, npm test, npm run build, Capacitor sync, available xcodebuild, and desktop/mobile screenshot review.

## Real-device validation status
Report exact observed status per capability; never infer pass from simulator.

## Conflict boundary
Only fix issues demonstrated by final checks; do not expand scope.
