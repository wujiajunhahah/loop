# Hardware Workstream Report

## Scope

Implemented a hardware-neutral bridge, in-memory hardware simulator, verified
device binding and entrustment, recipient-flow notification, abstract feedback,
event lifecycle inspection, and software fallback. No real BLE, NFC, hardware
SDK, API key, or physical-form assumption was added.

## Event Contract

Every adapter event contains:

- `eventId`
- `deviceId`
- `deviceType`
- `recipientId`
- `eventType`
- `occurredAt`
- `verificationStatus`
- `payload`

Supported sources are `touch`, `tap`, `gesture`, `nfc`, `ble`, and `simulated`.
Business consumers subscribe only to verified `HardwareEvent` values. Simulator
observers may separately inspect `produced`, `verified`, `rejected`, and
`consumed` transitions.

## Identity And Delivery

- Device binding requires a verified owner proof.
- Entrustment requires both the bound owner proof and an independent recipient
  proof.
- An event is rejected if its recipient differs from the verified entrustment.
- Duplicate `eventId` values are rejected before a second business publication.
- Accepted events dispatch `loop:hardware-recipient-entry`, navigate to
  `#/recipient`, and are then marked consumed.

The mock verification value is `LOOP-DEMO`. It is local demo data, not an API key
or production authentication mechanism.

## Feedback And Fallback

Abstract feedback exposes LED, vibration, and confirmation state. Accepted and
rejected events update those states consistently. If physical hardware is marked
unavailable, the same request becomes a verified `simulated` event whose payload
retains the original source type and a fallback marker.

## Simulator Pages

Feature components and route definitions are available for:

- `/hardware-simulator`
- `/hardware-simulator/bind`
- `/hardware-simulator/trigger`

The shared App router is outside this task's file boundary. The integration
request is documented in `.loop/requests/hardware-interface.md`; no core domain,
shared contract, or App shell file was changed by this workstream.

## Verification

- Hardware tests: 4 files, 17 tests passed
- Full tests: 11 files, 41 tests passed
- Type check: passed
- Production build: passed
- `git diff --check` for hardware-owned files: passed

Coverage includes all six event sources entering one recipient flow, invalid
recipient identity, failed binding proof, unbound devices, duplicate events,
software fallback, lifecycle stages, simulator controls, and browser recipient
notification.

## Integration Request

The foundation event and bridge interfaces cannot express the required event
schema and lifecycle. See `.loop/requests/hardware-interface.md` for the proposed
port adoption and App route mounting. The request avoids changing `src/domain`
or `src/adapters/contracts` from this workstream.
