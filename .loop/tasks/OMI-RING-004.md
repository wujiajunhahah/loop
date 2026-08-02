# OMI-RING-004 - Capacitor BLE transport and browser fallback

## Objective
Implement scanning, connection, service discovery, read, write, notifications, disconnect, cancellation, and diagnostic tracing behind the transport contract.

## Allowed files
- package.json, package-lock.json
- src/devices/transports/**
- Transport tests and mocks

## Dependencies
OMI-RING-001, OMI-RING-002, OMI-RING-003.

## Non-goals
No OMI/ring packet knowledge, feature page, native Info.plist editing, or background execution promises.

## Implementation notes
Use @capacitor-community/bluetooth-le through lazy/native-safe imports. Web fallback must be deterministic and labeled simulated. Serialize connect operations, make subscriptions disposable, and normalize plugin errors without logging sensitive identifiers.

## Acceptance criteria
- Web tests do not require a native bridge.
- Stop scan and disconnect release listeners.
- Notification frames are bytes with monotonic receive order.
- Permission, powered-off, timeout, disconnect, and unsupported-platform failures are distinguishable.

## Required checks
Transport unit tests, npm run typecheck, npm test, npm run build.

## Real-device validation status
Implementation can be fixture-verified; iPhone BLE behavior requires OMI/ring hardware.

## Conflict boundary
Do not edit adapters, runtime, app pages, global CSS, or ios/.

