# OMI-RING-006 - Alloop and configurable smart-ring adapter

## Objective
Expose ring wellness/activity streams through a configurable GATT profile, using a repository-local reviewed Alloop protocol reference.

## Allowed files
- src/devices/adapters/ring/**
- docs/hardware/smart-ring.md
- Ring fixtures and tests

## Dependencies
OMI-RING-001, OMI-RING-003, OMI-RING-004.

## Non-goals
No reverse engineering beyond supplied sources, Oura cloud OAuth, medical diagnosis, grief inference, or UI.

## Implementation notes
Model identity, battery, wear state, heart rate, RR/HRV inputs, SpO2, temperature, steps/activity, PPG, accelerometer, history-sync progress, and commands as optional capabilities. Exact services, characteristics, opcodes, checksums, scaling, and firmware constraints must come from a repository-local reviewed specification; unknown values stay configurable and disabled.

## Acceptance criteria
- A generic profile declares service/characteristic roles and parsers without adapter code changes.
- Supplied Alloop fixture packets parse with bounds, checksum, signedness, scaling, and unit tests only where the source establishes them.
- Unsupported metrics are capability states, not zeros.
- Raw physiological data remains local weak context unless the user explicitly exports it.

## Required checks
Fixture/profile/parser tests, npm run typecheck, npm test, npm run build.

## Real-device validation status
Requires exact ring model, firmware, UUIDs, and physical iPhone validation.

## Conflict boundary
Do not edit OMI adapter, runtime, UI, native project, or files outside this repository.

