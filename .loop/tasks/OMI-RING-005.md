# OMI-RING-005 - OMI adapter and streaming parsers

## Objective
Connect an OMI device through a configurable, source-documented GATT profile and expose audio/events through normalized contracts.

## Allowed files
- src/devices/adapters/omi/**
- docs/hardware/omi.md
- OMI packet fixtures and tests

## Dependencies
OMI-RING-001, OMI-RING-003, OMI-RING-004.

## Non-goals
No speech-to-text cloud service, invented UUID, unsupported firmware write, emotion detection, or UI.

## Implementation notes
Separate profile, discovery matching, session lifecycle, framed/chunked packet parsing, audio chunk metadata, touch events, battery, commands, and acknowledgements. Every built-in UUID or opcode must cite an official OMI source and firmware/version; otherwise require injected configuration and report requires_vendor_profile.

## Acceptance criteria
- Fragmented and coalesced notifications parse without data loss.
- Invalid frames fail locally without tearing down unrelated streams.
- Audio format/rate/channel metadata is explicit.
- Reconnect does not duplicate subscriptions or sequence numbers.

## Required checks
Fixture/parser/session tests, npm run typecheck, npm test, npm run build.

## Real-device validation status
Parser fixture validated; connection/audio require a named OMI firmware on a physical iPhone.

## Conflict boundary
Do not edit ring adapter, runtime, UI, global hardware bridge, or ios/.

