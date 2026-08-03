# OMI / ring final integration audit

Date: 2026-08-03

## Delivery

The ten planned tasks are implemented as one layered system:

| Task | Result | Commit before final integration |
| --- | --- | --- |
| OMI-RING-001 | Vendor-neutral transport/adapter contracts | `90f4dd6` |
| OMI-RING-002 | Capacitor iOS foundation | `3dde816` |
| OMI-RING-003 | Versioned normalized wire protocol | `cb5ebe4` |
| OMI-RING-004 | Capacitor BLE transport and browser fallback | `6c3ef42` |
| OMI-RING-005 | Source-pinned OMI audio adapter/parser | `bc12ba2` |
| OMI-RING-006 | Configurable smart-ring profile/parser boundary | `d40e204` |
| OMI-RING-007 | Multi-device runtime, persistence and simulators | `79eb815` |
| OMI-RING-008 | Device center, consent and source-aware UI | `e08268b` |
| OMI-RING-009 | Generated native iOS project and validation guide | `934ce09` |
| OMI-RING-010 | Native runtime wiring, lifecycle, trusted handoff, narrative flows, tests and docs | `0cacedd` plus final lifecycle hardening |

OpenCode generated the bounded `ios/**`/native-validation result for task 009.
Codex then inspected its files, made the native tree trackable, and independently
reran web, Capacitor, plist, dependency, and Xcode checks. A device-core sub-agent
implemented task 010 lifecycle/consent/diagnostic changes in `src/devices/**`;
the primary agent inspected that diff and reran repository checks.

A final parallel UI review found that an active BLE discovery session could outlive
the runtime's `scanning` phase. The follow-up adds an explicit `discoveryActive`
snapshot state, a bounded ten-second foreground scan, cancellation on background
or connect, native Bluetooth power refresh on resume, immediate stale values after
disconnect, and lifecycle forwarding for the unconfigured OMI adapter.

## Proven paths

- Browser: unsupported physical state, deterministic simulator fallback, OMI and
  ring independent sessions, consent, freshness, partial capabilities, redacted
  diagnostics, and reconnect UI.
- Native build: Capacitor BLE transport is assembled on iOS; OMI is discoverable
  without guessed framing and fully parsed only with complete reviewed config;
  ring discovery requires explicit hints.
- Creator: simulator -> runtime -> normalized mark -> interaction consent ->
  verified binding -> pending prompt -> provenance-preserving capture -> explicit
  review/save or cancel.
- Recipient: simulator touch -> runtime -> consent -> binding/entrustment/identity
  verification -> pending prompt -> identity confirmation -> explicit presentation
  choice -> optional playback/plan/response. Direct deep links are gated and a
  permanent-close choice persists locally.
- Safety: telemetry does not enter the interaction handoff; mark/touch does not
  request microphone/camera/playback/share; wearable data remains weak context and
  cannot infer emotion, grief, mental state, or health.

## Verification evidence

Primary-agent results:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test -- --run --maxWorkers=1` | 25 files, 172 tests passed |
| `npm run build` | Passed |
| `npx cap sync ios` | Passed; Bluetooth LE 8.2 plugin included through SPM |
| plist syntax and usage strings | Passed; Bluetooth and microphone descriptions present; `UIBackgroundModes` absent |
| Capacitor/Bluetooth podspec parse | Passed |
| `xcodebuild ... -resolvePackageDependencies` | Passed; Capacitor 8.5.0 resolved |
| unsigned iPhone 16 Pro / iOS 18.5 simulator build | `BUILD SUCCEEDED` |
| simulator -> runtime -> UI creator/recipient integration | 2 tests passed |
| Playwright desktop/mobile horizontal-overflow checks | 6 routes/viewports passed; screenshots inspected |
| tracked-source path/credential scan | No local audio path or common key pattern found after redaction |

The final command set was rerun after the foreground-lifecycle review fixes.

## Evidence boundaries

Passing an unsigned simulator build does not verify physical BLE or microphone
behavior. No successful signed install or radio test occurred. The paired iPhone
was visible to Xcode but unavailable to `devicectl`; no device identifier was
recorded.

The following remain explicit release gates rather than claimed support:

- named OMI unit, exact firmware, codec, negotiated MTU and fragment layout;
- exact Alloop/ring model, firmware, reviewed GATT UUIDs, opcodes and parsers;
- physical scan/permission/notification/disconnect/reconnect checks;
- phone microphone recording, protected storage, retention and deletion;
- background BLE/audio and HealthKit, neither of which is enabled;
- production identity proof replacing the local `LOOP-DEMO` bridge credential.

The authoritative capability table is `docs/hardware/support-matrix.md`; the
physical test procedure is `docs/hardware/ios-validation.md`.
