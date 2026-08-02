# OMI-RING-001 - Hardware architecture and adapter contracts

## Objective
Define stable vendor-neutral boundaries for OMI, smart rings, BLE transport, telemetry, commands, and capability reporting without changing the existing relationship-agent behavior.

## Allowed files
- docs/hardware/architecture.md
- src/devices/contracts/**
- Contract-focused tests beside those files

## Dependencies
None.

## Non-goals
No Capacitor dependency, BLE calls, vendor UUIDs, UI, persistence, or health interpretation.

## Implementation notes
Expose small interfaces for DeviceAdapter, DeviceTransport, discovered devices, sessions, subscriptions, commands, and capability states: implemented, requires_real_device, and requires_vendor_profile. Telemetry is weak context and must never infer grief or diagnose health. Keep an explicit integration boundary with the existing HardwareBridge.

## Acceptance criteria
- OMI and rings can implement the same lifecycle without leaking vendor packets upward.
- Unsupported operations return typed capability/error results.
- Public contracts have deterministic unit tests and no any types.

## Required checks
npm run typecheck, focused tests, npm test, npm run build.

## Real-device validation status
Contract-only; no hardware claim.

## Conflict boundary
Do not edit existing hardware bridge implementations, app pages, CSS, package manifests, lockfiles, or native projects.

