# OMI-RING-003 - Versioned telemetry and communication protocol

## Objective
Define a normalized, versioned wire envelope and telemetry model shared by all device adapters.

## Allowed files
- src/devices/protocol/**
- Protocol tests and fixtures beside those files
- Narrow exports in src/devices/contracts/**

## Dependencies
OMI-RING-001.

## Non-goals
No BLE plugin, vendor parser, UI, storage, emotion scoring, or medical claims.

## Implementation notes
Use schema version 1. Preserve provenance, device time versus received time, sequence, quality, unit, raw-frame metadata, command id, acknowledgement, and parse failures. Support optional heart rate, HRV inputs, SpO2, temperature, steps, battery, accelerometer, wear state, touch events, and OMI audio chunks without forcing every adapter to provide all fields.

## Acceptance criteria
- Encode/decode rejects unknown versions and malformed lengths safely.
- Measurements retain source, units, timestamps, and optional quality.
- Commands are idempotent through command ids and typed acknowledgement status.
- No metric maps directly to emotion, grief, or intervention decisions.

## Required checks
Focused edge/property tests, npm run typecheck, npm test, npm run build.

## Real-device validation status
Fixture validated only; byte layout remains adapter-specific.

## Conflict boundary
Do not add vendor UUIDs, transport calls, app state, or UI.

