# OMI-RING-007 - Device runtime, persistence, and simulators

## Objective
Coordinate multiple adapters, expose reactive snapshots, persist safe preferences/bindings, and provide deterministic OMI/ring simulation.

## Allowed files
- src/devices/runtime/**
- src/devices/simulators/**
- Runtime tests
- Narrow integration exports in adapter indexes

## Dependencies
OMI-RING-003, OMI-RING-004, OMI-RING-005, OMI-RING-006.

## Non-goals
No UI, cloud sync, background iOS promise, credentials, or replacement of the existing relationship store.

## Implementation notes
Implement an external-store style runtime with discovery, connection phases, capability matrix, latest values, bounded history, diagnostics, reconnect policy, cancellation, consent settings, and simulator scenarios. Persist only selected device/profile/preferences; do not persist raw audio or continuous sensitive telemetry by default.

## Acceptance criteria
- OMI and ring connect concurrently through independent sessions.
- Stale async results cannot overwrite a newer scan/connection.
- Reload restores preferences but not active connection claims.
- Simulator values/events are reproducible and labeled simulated.

## Required checks
Race/persistence/simulator tests, npm run typecheck, npm test, npm run build.

## Real-device validation status
Runtime fixture validated; reconnect/background behavior requires iPhone testing.

## Conflict boundary
Do not edit pages, CSS, native projects, or existing Agent policies.

