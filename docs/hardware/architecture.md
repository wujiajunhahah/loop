# Hardware adapter architecture

## Scope

This document defines the vendor-neutral boundary for physical devices used by Loop. It lets an OMI-class wearable, a smart ring, a marker, a dock, or a simulator follow the same lifecycle without exposing vendor packets to product code.

This task is contract-only. It adds no Bluetooth calls, native integration, persistence, vendor profile, vendor service/characteristic identifier values, or real-device claim. The existing `HardwareBridge`, its simulator, binding rules, entrustment checks, event verification, and recipient flow remain unchanged.

## Layers

```text
platform transport implementation
  BLE / NFC / USB / simulator lifecycle
  filtered discovery, characteristic I/O, copied byte frames
             |
             v
DeviceTransport + DeviceTransportSession
  the only layer allowed to expose raw Uint8Array frames
             |
             v
vendor profile implementation of DeviceAdapter
  recognizes and decodes a device protocol
  reports capability state
             |
             v
DeviceSession
  complete capabilities, extensible normalized events, commands, acknowledgements
             |
             v
future explicit HardwareBridge mapper
  identity, binding, entrustment, verification, deduplication, consumption
             |
             v
existing recipient and capture flows
```

Raw transport frames and `DeviceCharacteristicRef` values stop at the `DeviceAdapter` boundary. A `DeviceSession` cannot expose vendor packets, service or characteristic identifiers, advertisement payloads, or protocol-specific command bytes. Product code consumes only normalized contracts. Characteristic references are opaque adapter-supplied profile values; this contract contains no vendor UUID values.

## Lifecycle

1. Open a `DeviceTransport` and inspect its typed result.
2. Start discovery with optional service/name filters, timeout, and `AbortSignal`; receive `DiscoveredDevice` values with normalized advertised service identifiers but without advertisement packets.
3. Stop discovery before connecting. Explicit stop and abort converge on the same idempotent cleanup.
4. Connect the selected discovery result with an explicit timeout and optional `AbortSignal` to obtain a `DeviceTransportSession`.
5. Select a `DeviceAdapter` with `matches` and open a normalized `DeviceSession` over the transport session. A successful open transfers transport-session ownership to the device session; a failed open leaves ownership with the caller.
6. Let the adapter discover and validate its injected profile, then use characteristic-scoped read, write, and notification operations.
7. Read the normalized session capability report before subscribing or sending commands.
8. Subscribe to `NormalizedDeviceEvent` values and execute normalized `DeviceCommand` values.
9. Receive a typed result containing either a `CommandAcknowledgement` or a `DeviceError`.
10. Close the device session and await its owned transport-session cleanup. Finally close the transport for cascading cleanup of any remaining discovery or sessions.

Transport and device sessions expose their lifecycle state so implementations can make opening, closing, disconnection, and failure visible. After `DeviceAdapter.openSession` succeeds, callers close only the returned `DeviceSession`; its `close` must await subscription cleanup and the owned `DeviceTransportSession.close`. `DeviceTransport.close` remains the final cascading safeguard and may close any still-open session. Discovery `stop`, notification `unsubscribe`, transport-session `close`, device-session `close`, and transport `close` are idempotent: repeated calls return success without repeating native cleanup. Closing a transport session first stops every notification it owns and then disconnects. Abort invalidates callbacks before native cleanup, and late scan, connection, or notification callbacks from an older session must be ignored.

## Characteristic operations and byte ownership

`DeviceCharacteristicRef` identifies a service and characteristic only inside the transport/adapter layers. Adapter profiles inject reviewed values. Discovery filters may use service identifiers for platform scanning. `DiscoveredDevice.advertisedServiceIds` may expose only platform-normalized identifier strings as transport-level matching hints so `DeviceAdapter.matches` can select a profile. They are not identity proof and must not be copied into `NormalizedDevice`, normalized events, or product diagnostics. Raw advertisement, manufacturer, and service-data payloads never cross this boundary.

`DeviceTransportSession` provides:

- `read(characteristic, options)` for a characteristic-scoped read;
- `write({ characteristic, payload, mode, ... })` with an explicit response mode;
- `subscribe(characteristic, listener, options)` for characteristic-scoped notifications.

Read and notification delivery both produce `DeviceTransportFrame`. Each frame includes characteristic provenance, receive source (`read` or `notification`), application receipt time, and a sequence that starts at 1 and increases monotonically within one transport session. A new session starts a new sequence. `createDeviceTransportFrameSequencer` copies exactly the incoming `Uint8Array` view, so adapter parsers never retain a native or pooled backing buffer. One sequencer must be shared by all reads and notifications in a session.

## Capability reporting

`deviceCapabilityIds` is the canonical list of all capabilities. `DeviceSession.capabilities` is a `DeviceCapabilityReport` record keyed by every ID in that list; sparse arrays and omitted capabilities are invalid. Every entry has one of exactly three states:

| State | Meaning |
| --- | --- |
| `implemented` | The active adapter and environment implement the operation. This is not, by itself, user consent. |
| `requires_real_device` | The contract or simulator path exists, but the behavior cannot be claimed without physical-device validation. |
| `requires_vendor_profile` | Transport access may exist, but protocol decoding or command encoding has not been configured and verified. |

An unavailable operation returns `DeviceResult` with `code: capability_unavailable`, its capability ID, exact capability state, and a reason. It must not silently succeed, guess a protocol, or downgrade to a different physical action. `requireCommandCapability` maps every normalized command to its required capability and returns that typed failure unless the report says `implemented`; adapters call it before encoding or writing a command. Existing lifecycle errors remain available, while transport implementations additionally distinguish `powered_off`, `unsupported_platform`, `timeout`, `disconnected`, `services_discovery_failed`, `read_failed`, `write_failed`, and `notification_failed`. Permission denial and cancellation remain separate errors. Error messages must not include device identifiers, advertisement bytes, packet data, audio, or physiological values.

The baseline capability IDs cover interaction events, telemetry, haptic feedback, light feedback, status reporting, and audio capture. Reporting `audio_capture` as implemented does not grant microphone permission or allow silent capture; consent remains an application/platform responsibility.

## Events and telemetry

The default `DeviceSession` subscription emits `NormalizedDeviceEvent`, which currently has three forms:

- `interaction`: a vendor-neutral mark, touch, confirmation, dismissal, or gesture.
- `status`: a connection, wear, removal, or low-battery state.
- `telemetry_reference`: a reference to separately governed telemetry, never a vendor packet or an interpretation.

`DeviceSession<Event>` and `DeviceAdapter<Event>` accept an event type extending `NormalizedDeviceEventBase`, while defaulting to `NormalizedDeviceEvent` for existing callers. Future adapter tasks may extend the union with normalized `audio_chunk` and `parse_failure` events. Extensions carry reviewed metadata, references, and typed parse errors only; `transportFrame` and characteristic provenance are forbidden at this product-facing boundary. Raw notification bytes remain inside the adapter/parser.

Every `TelemetryReference` is structurally marked with:

```text
contextStrength: weak
interpretationPolicy: no_emotion_grief_or_health_inference
```

Telemetry may only contribute weak context after applicable consent. It is never a grief detector, emotion detector, mental-state classifier, health diagnosis, or permission to trigger content. Hardware events can create a pending capture or recipient state; they cannot grant microphone, playback, sharing, identity, or content-access permission.

## Commands and acknowledgements

Commands are normalized requests for haptic feedback, light feedback, status, or telemetry. `commandCapability` identifies the required capability and `requireCommandCapability` enforces the complete session report before transport I/O. A supported command returns a command acknowledgement with the original command ID, session ID, status, and timestamp. A device-level rejection can be represented by a rejected acknowledgement; undeclared or unavailable behavior cannot silently succeed and uses the typed capability error.

No normalized command contains vendor command bytes or characteristic identifiers. A vendor profile is responsible for selecting a `DeviceCharacteristicRef`, encoding a command below the adapter boundary, and decoding its acknowledgement back into the normalized form.

## Existing HardwareBridge boundary

`DeviceAdapter` does not replace or extend the current `HardwareBridge`. The two abstractions own different concerns:

| Boundary | Responsibility |
| --- | --- |
| `DeviceTransport` / `DeviceAdapter` | Platform connection, discovery, protocol decoding, normalized device capabilities, events, and commands. |
| Existing `HardwareBridge` | Loop binding and entrustment, recipient identity verification, event deduplication, software fallback, feedback state, and event consumption. |

A later integration task may add a dedicated mapper that accepts a normalized device interaction and calls the existing bridge API. That mapper must preserve the bridge's verification lifecycle and map only explicit supported fields. It must not pass telemetry as identity proof, infer a recipient, bypass binding, or auto-consume an event. Keeping this mapper separate prevents vendor protocol details from entering relationship-agent or recipient code and keeps existing behavior untouched.

## Real-device limits

The contracts and deterministic contract tests validate shape, lifecycle composition and ownership, cancellation and idempotence semantics, copied frame ordering, complete capability reports, typed command rejection, extensible normalized events, advertised-service matching, and packet isolation only. They do not validate radio power and permissions, filtered discovery reliability, connect cancellation races, reconnect behavior, service discovery, notification cleanup, background execution, firmware protocol details, command timing, sensor accuracy, haptics, lights, microphone behavior, battery reporting, or telemetry quality. Those capabilities remain `requires_real_device` or `requires_vendor_profile` until a named device, firmware, platform, and consent flow are tested.
