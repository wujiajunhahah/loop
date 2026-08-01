# Interface Request: Hardware Bridge V2

## Status

Requested by the hardware workstream. No core domain files were changed.

## Problem

The foundation `HardwareEvent` uses `id`, `bridgeId`, `type`, optional `actorId`,
and optional `context`. The foundation `HardwareBridge` only supports event
subscription, simulation, light, and vibration. It cannot represent the required
device identity, recipient, verification state, payload, binding, entrustment,
deduplication, confirmation feedback, or hardware availability fallback.

## Proposed Integration

Adopt or re-export the port and event model implemented under
`src/adapters/hardware`. The App owner should also mount these feature exports:

- `/hardware-simulator` -> `HardwareSimulatorPage`
- `/hardware-simulator/bind` -> `HardwareBindPage`
- `/hardware-simulator/trigger` -> `HardwareTriggerPage`

Until the shell integrates these routes, the feature remains independently
renderable and tested. Verified events notify the recipient boundary through the
`loop:hardware-recipient-entry` browser event and navigate to `#/recipient`.
