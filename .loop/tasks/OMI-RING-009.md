# OMI-RING-009 - Native iOS permissions, lifecycle, and diagnostics

## Objective
Generate the Capacitor iOS project and configure truthful native capabilities for BLE and OMI audio interaction.

## Allowed files
- ios/**
- Capacitor configuration and native scripts when required
- docs/hardware/ios-validation.md

## Dependencies
OMI-RING-002, OMI-RING-004, OMI-RING-007, and native requirements from the recording.

## Non-goals
No signing credentials, fabricated background entitlement, always-on microphone, HealthKit without an implemented adapter, or vendor secrets.

## Implementation notes
Run Capacitor add/sync reproducibly. Add human-readable Bluetooth and microphone usage descriptions. Add background modes only when implemented and justified. Document foreground/background limits, data protection, logging, Xcode signing, and physical-device validation.

## Recording-derived native requirements
- Microphone access is opt-in and only requested after the creator explicitly starts a recording or guided capture.
- A hardware mark event may wake the app into a pending capture state, but must not silently record, take a photo, or play emotional audio.
- Foreground BLE, notification subscriptions, disconnect recovery, and visible permission/diagnostic states are required; do not promise an always-on background listener until tested on a named iPhone and firmware.
- The physical object may also be a dock/charging/audio base, but the web/iOS app must keep hardware identity, audio source, and consent separate.

## Acceptance criteria
- npx cap sync ios is reproducible.
- iOS deployment target and plugin pods resolve.
- Usage descriptions match actual flows and consent.
- Simulator limitations and physical-device checks are explicit.

## Required checks
Web checks, Capacitor sync, CocoaPods/Xcode validation available on this machine, and unsigned simulator xcodebuild where possible.

## Real-device validation status
Native project build can be validated; BLE/microphone/firmware remain physical-device validation.

## Conflict boundary
Do not change product pages, protocol definitions, or introduce credentials/team identifiers.
