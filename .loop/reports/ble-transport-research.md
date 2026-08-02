# BLE Transport Research: React Native to Capacitor

## Scope and evidence

This report compares the existing mobile BLE controller with the transport
contracts in this repository. It does not claim a real OMI or ring profile.
No vendor UUIDs or opcodes were found or inferred.

Observed sources:

- `../loop-mobile/package.json`: `react-native-ble-plx` 3.5.1.
- `../loop-mobile/src/ble/useBleController.ts`: scan, permission, connection,
  reconnect, binding, and cleanup lifecycle.
- `src/devices/contracts/DeviceTransport.ts`, `DeviceAdapter.ts`, `types.ts`,
  and `errors.ts`: current target ports.
- `@capacitor-community/bluetooth-le` 8.2.0 package documentation and type
  declarations (npm package README and `dist/esm/definitions.d.ts`).

The Capacitor plugin is a transport primitive only. Profile matching, packet
framing, telemetry interpretation, and commands remain adapter concerns.

## Capacitor API mapping

| Target operation | Capacitor BLE API | Mapping notes |
| --- | --- | --- |
| `DeviceTransport.open()` | `BleClient.initialize(options?)` | Call once per app/transport lifetime. On Android, choose `androidNeverForLocation` only when the product does not derive location from scan results and the manifest has the matching `neverForLocation` flag. |
| Adapter power state | `isEnabled()`, `startEnabledNotifications(callback)` | Replace the RN `BleManager.state()`/`onStateChange()` pair. Keep a transport-level `powered_on` snapshot and stop scans/sessions when it becomes false. |
| Discovery | `requestLEScan(filters, callback)` | The callback receives `device.deviceId`, `device.name`, `localName`, `rssi`, `txPower`, `uuids`, and optional manufacturer/service data. `stopLEScan()` is the only scan cancellation. Generate a local discovery-session id. |
| User-selected discovery | `requestDevice(filters?)` | This opens a native picker and is unsuitable for unattended reconnect or deterministic tests. Use only for an explicit “choose device” flow. |
| Reconnect lookup | `getDevices(deviceIds)` | Required on iOS/web to recover a previously known opaque id without scanning. Android can connect directly by id. Persist the opaque id as a device reference, not a MAC assumption. |
| Connected lookup | `getConnectedDevices(services)` | On iOS, a non-empty service filter is required. Treat an empty result as “not confirmed,” not as proof of disconnection. |
| Connect | `connect(deviceId, onDisconnect?, { timeout, skipDescriptorDiscovery? })` | The promise resolves after native connection. It does not return a device object; call `getServices(deviceId)` after connect. Register `onDisconnect` in the same serialized operation. |
| Service discovery | `getServices(deviceId)`; `discoverServices(deviceId)` only when a device changes its GATT at runtime | `getServices` returns service/characteristic/descriptor metadata. Do not surface vendor packets from this layer. Keep descriptor discovery enabled until the target profile is validated. |
| Read | `read(deviceId, serviceUuid, characteristicUuid, { timeout? })` | Returns a `DataView`. Copy only `byteOffset..byteOffset+byteLength` into a new `Uint8Array`; do not retain or log the backing buffer. |
| Write | `write(...)` / `writeWithoutResponse(...)` | Both take a `DataView`. Native platforms encode it as hex internally. Select the mode explicitly in the transport request; do not infer mode from payload length. |
| Notifications | `startNotifications(deviceId, service, characteristic, callback, { timeout? })` and `stopNotifications(...)` | The wrapper has one listener per device/service/characteristic and warns to start each notification once. Session code must deduplicate subscriptions and release them before disconnect. |
| RSSI / MTU | `readRssi(deviceId)`, `getMtu(deviceId)` | Native only (not web). Report unavailable as a typed operation/capability result, never as zero. Maximum write value is MTU minus 3. |
| Close | `stopLEScan()`, `stopNotifications(...)`, then `disconnect(deviceId)` | Make close idempotent and await cleanup. Remove every callback/listener before dropping the session reference. |

### Discovery result normalization

Use `device.deviceId` as an opaque transport device id. Map `localName` before
`device.name` for the display label, because iOS may return a cached GAP name
after the first connection. Preserve `rssi` as optional and keep advertisement
bytes in adapter diagnostics only; they must not be promoted to normalized
telemetry without a profile.

The current `DiscoveredDevice` can carry this id in `discoveryId`, but the
contract should document that it is the stable platform id returned by the
transport. An explicit `transportDeviceId` field is preferable if discovery
and persistence need to be separated later.

## Lifecycle and race findings

### Strengths in the existing controller

`useBleController` already uses scan and connection epochs (lines 118-123,
384-421, 299-311) to ignore stale callbacks, stops scanning before connecting
(lines 320-321), registers a disconnect callback after service discovery (lines
349-364), and cleans up on unmount (lines 816-839). These are the behaviors to
preserve behind the target port.

### Races to handle in the Capacitor implementation

1. **Single global scan listener.** `BleClient.requestLEScan` replaces its
   previous `onScanResult` listener. Do not start independent scans for OMI and
   ring sessions. Use one process-wide scan coordinator that multiplexes a
   single callback, or reject a second discovery with a typed busy result.
2. **Register before starting.** The plugin wrapper installs the scan listener
   before invoking native `requestLEScan`. Keep that order. Start the timeout
   only after the native call resolves, and invalidate the callback with a
   generation token before calling `stopLEScan`.
3. **Global notification keys.** Notification listeners are keyed by
   device/service/characteristic. Repeated `startNotifications` replaces the
   old listener. Track a reference-counted, idempotent subscription per key and
   make a second subscriber share the first native stream.
4. **Serialized native calls.** The plugin's `BleClient` queue is enabled by
   default and serializes BLE operations. Keep it enabled. Adapter callbacks
   must schedule follow-up reads/writes asynchronously rather than re-entering
   a queued call synchronously.
5. **Connect has no return object.** After `connect` resolves, a stale action
   may still be in flight. Guard every `getServices`, notification start, and
   adapter open step with a session generation. On cancellation, disconnect the
   id and discard all late results.
6. **Reconnect identity differs by platform.** iOS requires `getDevices` (or a
   fresh scan/request) before connecting to a saved id; Android can connect by
   id directly. A failed `connect` on Android can be cleared by a best-effort
   `disconnect` followed by one retry, as recommended by the plugin docs. Do
   not loop indefinitely.
7. **Disconnect cleanup ordering.** A disconnect callback may arrive after an
   explicit close. Mark the session closing first, remove notification handles,
   then disconnect; ignore callbacks from an older generation.
8. **Background transitions.** The existing controller stops scanning whenever
   the app is not active (lines 804-813). Keep this default. Do not claim iOS
   background BLE until `bluetooth-central`, state restoration, and a physical
   device test exist.
9. **Frame byte ownership.** Convert a `DataView` using its offset and length,
   then copy it. This prevents a pooled native buffer or a larger backing
   `ArrayBuffer` from leaking into parsers. Assign a session-local monotonic
   receive sequence at the notification callback boundary.
10. **Timeouts are local policy.** Capacitor defaults to 10 seconds for connect
    and 5 seconds for most calls. Pass explicit timeouts or wrap calls in a
    local deadline so `DiscoveryRequest.timeoutMs` and the runtime's reconnect
    policy remain deterministic.

## Permission and platform differences

### iOS

- Add `NSBluetoothAlwaysUsageDescription` to the app `Info.plist`. The first
  `initialize()` asks for Bluetooth authorization; there is no separate
  runtime permission request. If the user declines the first prompt, the plugin
  documents that the app must be enabled from Settings before retrying.
- BLE is unsupported in the iOS Simulator. A successful web build or Xcode
  compile is not hardware validation.
- Background central behavior requires `UIBackgroundModes` with
  `bluetooth-central`. The current product requirements prefer foreground
  diagnostics, so leave this out until a named device/firmware justifies it.

### Android

- For Android 12+ (API 31+), request/declare `BLUETOOTH_SCAN` and
  `BLUETOOTH_CONNECT`. If scan data is not used to derive location, set
  `androidNeverForLocation: true` and add the manifest `neverForLocation` flag.
- For API <= 30, location permissions and enabled Location Services remain
  relevant. `isLocationEnabled()` and `openLocationSettings()` provide the
  explicit diagnostic path. A granted permission with Location Services off
  still produces an empty scan.
- `requestEnable()` is Android-only. iOS should surface a Settings action for
  a denied permission or powered-off state.

### Web/simulator

Web Bluetooth scan support is browser-dependent and `requestLEScan` is behind a
flag in many browsers. Keep the deterministic simulator as an explicit
`simulated` transport and label every result/event as simulated. Never treat a
browser build as an iPhone BLE check.

## Exact target contract changes

The current ports are a good adapter boundary but do not yet expose the
characteristic-level operations and diagnostics required by Capacitor. Apply
these changes before implementing `src/devices/transports/capacitorBle`:

1. **Add a vendor-neutral GATT reference and operations.** In
   `DeviceTransport.ts`, add:

   ```ts
   export interface DeviceCharacteristicRef {
     serviceUuid: string
     characteristicUuid: string
   }

   export interface DeviceWriteRequest {
     characteristic: DeviceCharacteristicRef
     payload: Uint8Array
     mode: 'with_response' | 'without_response'
   }
   ```

   Change `DeviceTransportSession.send(payload)` to
   `write(request: DeviceWriteRequest): Promise<DeviceResult<void>>`, and add:

   ```ts
   read(ref: DeviceCharacteristicRef): Promise<DeviceResult<Uint8Array>>
   subscribe(
     ref: DeviceCharacteristicRef,
     listener: DeviceTransportFrameListener,
   ): DeviceResult<DeviceSubscription>
   ```

   Keep the UUIDs in the transport layer only. Adapters supply them from an
   injected, reviewed profile; no OMI/ring UUID belongs in this contract.

2. **Identify notification origin and order.** Extend
   `DeviceTransportFrame` with:

   ```ts
   sequence: number
   characteristic: DeviceCharacteristicRef
   source: 'notification' | 'read'
   ```

   `sequence` starts at 1 for each transport session and increases at the
   callback boundary. `payload` remains bytes and `receivedAt` remains the
   app-receipt time, not a device timestamp.

3. **Make discovery filters and cancellation explicit.** Extend
   `DiscoveryRequest` with optional `services`, `name`, `namePrefix`, and
   `signal?: AbortSignal`. `stop()` must be idempotent; aborting the signal must
   call `stopLEScan()` and complete the discovery session as cancelled.

4. **Expand typed transport errors.** In `errors.ts`, add distinct codes for
   `adapter_powered_off`, `unsupported_platform`, `operation_timeout`,
   `device_disconnected`, `scan_failed`, `services_discovery_failed`,
   `read_failed`, `write_failed`, and `notification_failed`. Preserve the
   existing `permission_denied` and `operation_cancelled` codes. Normalize
   Capacitor errors to these codes without including device ids or raw packet
   bytes in `message`.

5. **Add redacted diagnostics as a separate stream.** Add an optional
   `subscribeDiagnostics(listener)` to `DeviceTransport` or a runtime wrapper,
   with `{ operation, code, occurredAt, retryable }`. Do not log identifiers,
   advertisement payloads, audio, or physiological values by default.

6. **Define close and idempotence.** Document that `DeviceTransport.close`,
   `DeviceTransportSession.close`, discovery `stop`, and notification
   unsubscription are safe to call more than once. Closing a session must stop
   every notification owned by that session before disconnecting.

7. **Clarify id semantics.** Document that `DiscoveredDevice.discoveryId` is
   an opaque plugin id (`BleDevice.deviceId`), stable only within the platform's
   persistence rules. Add `displayName` from `localName` where available and
   never expose Android MAC addresses in diagnostics.

These changes keep the adapter contract vendor-neutral while making every
Capacitor operation representable and testable with a mock plugin.

## Implementation/test checklist

- Mock `BleClient` with delayed scan, connect, notification, timeout, power-off,
  permission-denied, and disconnect outcomes.
- Assert that a second discovery does not leak the first callback and that stop
  invalidates late scan results.
- Assert that two subscribers to one characteristic produce one native
  notification and two disposable logical subscriptions.
- Assert that close removes listeners, stops notifications, disconnects, and
  ignores late callbacks.
- Assert DataView offsets are copied correctly and frame sequences are
  monotonic per session.
- Run browser tests without importing Capacitor at module evaluation time;
  load the native plugin lazily or inject a client interface.
- Report iOS simulator as unsupported and physical OMI/ring behavior as
  unverified until tested on a named iPhone and firmware.

