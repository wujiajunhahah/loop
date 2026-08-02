# Protocol research: OMI and Alloop smart ring

Date: 2026-08-02  
Scope: read-only research for OMI-RING-005 and OMI-RING-006. No adapter, transport,
native project, package, task card, or UI files were changed.

## Executive boundary

The OMI protocol has a usable, source-documented audio profile, but the source
does not document touch events or command opcodes. The Alloop repository exposes
typed Flutter callbacks over a closed Android AAR; it does not contain a reviewed
BLE byte-level specification. Therefore:

- OMI audio UUIDs and the 3-byte audio framing may be built into an OMI profile,
  with the cited source and firmware caveats below.
- OMI touch, write commands, acknowledgements, and any additional sensor
  characteristics must remain injected configuration and report
  `requires_vendor_profile` until an official source names them.
- Alloop UUIDs, opcodes, checksums, signedness, scaling, and firmware constraints
  must not be inferred from this repository or reverse-engineered from the AAR.
  The ring adapter can only expose the normalized capabilities already proven by
  the Dart API or use a separately reviewed, repository-local profile supplied by
  the vendor.

## Sources checked

### OMI official sources

The current `main` ref at the time of research is
`eb35343053ffda69676d13eb88874b576f71f180` (`git ls-remote`, 2026-08-02).

1. [OMI device protocol source](https://github.com/BasedHardware/omi/blob/main/sdks/device/PROTOCOL.md)
   (`sdks/device/PROTOCOL.md` at the above ref): shared GATT table, codec IDs,
   default stream assumptions, 3-byte header, and little-endian payload rule.
2. [OMI TypeScript protocol helpers](https://github.com/BasedHardware/omi/blob/main/sdks/device/typescript/src/index.ts)
   at the above ref: the same UUID constants, `PACKET_HEADER_BYTES = 3`, codec
   enum, 16 kHz/mono constants, and header-strip helper.
3. [OMI App-Device Protocol docs](https://docs.omi.me/doc/developer/Protocol.md):
   official app discovery name, battery/device-information details, firmware
   notes, and a more expansive codec table. This page is generated documentation,
   so its differences from the shared source must be treated as a profile/version
   compatibility issue rather than silently merged.
4. [OMI React Native SDK docs](https://docs.omi.me/doc/developer/sdk/ReactNative.md):
   iOS CoreBluetooth setup, physical-device requirement, connect/codec/audio/
   battery flow, and the warning that an iOS simulator cannot scan BLE.

### Repository-local Alloop sources

1. `alloop_hackathon/README.md`, section 5: the complete Dart API and entity
   tables. It explicitly says the low-level implementation is a closed-source
   Android AAR and that callers should use the Dart interfaces only.
2. `alloop_hackathon/packages/alloop_blue_lite/lib/src/alloop_blue_lite_base.dart`:
   method/event-channel lifecycle, single-active-device assumption, stream
   fan-out, and the `queryDeviceStatus` history-sync side effect.
3. `alloop_hackathon/packages/alloop_blue_lite/lib/src/models/*.dart`: typed
   fields and conversions for status, SpO2, PPG, ACC, and history records.
4. `alloop_hackathon/packages/alloop_blue_lite/android/src/main/kotlin/com/alloop/alloop_blue_lite/AlloopBlueLitePlugin.kt`:
   a platform-channel bridge into `com.alloop.core.api.AlloopCore`; no packet
   bytes, UUIDs, opcodes, or checksum code are present.
5. `alloop_hackathon/packages/alloop_blue_lite/android/repo/com/alloop/core/1.0.0/core-1.0.0.aar`:
   the binary artifact. Its public class names expose the same facade/callback
   surface; it is not a protocol reference.

### Loop task and product constraints

- `.loop/tasks/OMI-RING-005.md` requires every built-in OMI UUID/opcode to cite
  an official source and firmware/version, and explicitly disallows invented
  UUIDs, unsupported writes, and UI/STT work in the adapter.
- `.loop/tasks/OMI-RING-006.md` requires a configurable ring profile and says
  unknown services, characteristics, opcodes, checksums, scaling, and firmware
  values stay disabled.
- `.loop/recording-requirements.md` requires explicit consent before capture,
  playback, or sharing; a hardware mark may open a pending state but cannot
  grant microphone/content permission; wearable data is weak context only.

## OMI: known protocol facts

The facts below are safe to encode in a versioned OMI profile, subject to the
named source and device-firmware checks.

| Role | Value | Evidence and caveat |
| --- | --- | --- |
| OMI service | `19b10000-e8f2-537e-4f6c-d104768a1214` | OMI shared `PROTOCOL.md` and TypeScript helper. |
| Audio data notify | `19b10001-e8f2-537e-4f6c-d104768a1214` | Same source; notifications carry framed audio. |
| Audio codec read | `19b10002-e8f2-537e-4f6c-d104768a1214` | Same source; first byte is the codec identifier. |
| Battery service / level | `0000180f-0000-1000-8000-00805f9b34fb` / `00002a19-0000-1000-8000-00805f9b34fb` | Bluetooth standard values repeated in OMI source. Docs say battery notifications require firmware v1.5+. |
| Audio header | bytes 0-1 packet number, byte 2 index; strip 3 bytes | OMI shared source and helper. Packet number wraps at 65535; payload is little-endian. |
| Shared codec IDs | `0` PCM 16-bit, `1` PCM 8-bit, `20`/`0x14` Opus | Shared source. Thin SDK default assumption is Opus, 16 kHz mono, 960 samples/frame. |
| PCM output | 16-bit little-endian mono, 16,000 Hz | Shared source. |
| Discovery hint | advertised name `Omi` | Official docs page. This is a matching hint, not identity proof; keep an injected name/prefix override. |

The generated Protocol docs additionally list codec IDs `10` and `11` as
8/16-kHz Mu-law and say firmware v1.0.3+ defaults to Opus while older firmware
used 8-kHz PCM. The shared source does not include those Mu-law IDs. A parser
must consequently treat codec `10`/`11` as an explicitly configured profile
variant (or unsupported), never assume Mu-law from an unknown byte, and always
surface sample rate, bit depth, channel count, codec, firmware, and source in
normalized audio metadata.

The official OMI docs also describe a standard Device Information Service
(`0x180A`) and characteristics `0x2A29`, `0x2A24`, `0x2A27`, and `0x2A26`, with
firmware availability notes. Those values are not in the shared
`sdks/device/PROTOCOL.md` contract, so they should be optional discovery reads,
gated by a firmware/profile declaration and a physical-device check.

## OMI: unknown or unsafe to assume

No checked official OMI source supplies any of the following as a stable contract:

- touch/button/gesture event characteristic or event payload;
- write-command UUID, opcode, command framing, acknowledgement, checksum, or
  retry semantics;
- a vendor-specific battery command beyond the standard Battery Service;
- a complete model/firmware matrix for consumer Omi, DevKit variants, or Omi
  Glass;
- whether a given device sends one complete 160-sample packet per notification
  or fragments/coalesces notifications differently after MTU negotiation;
- whether codec values, frame duration, sequence semantics, or notification
  behavior differ by firmware;
- background iOS delivery guarantees.

The OMI adapter should therefore:

1. Match by the configured service UUID/name/profile, then discover and validate
   the expected characteristics before subscribing.
2. Preserve raw notification bytes only inside the adapter/parser boundary,
   parse fragmented and coalesced input using packet number/index, and emit a
   local parse failure without closing unrelated streams.
3. Start sequence/loss tracking at a new session and reset it on reconnect; do
   not duplicate notification subscriptions.
4. Expose unsupported touch/commands as capability state
   `requires_vendor_profile`, not as simulated events or guessed writes.
5. Keep audio capture opt-in. A BLE event can create a pending capture state but
   cannot request microphone permission, start recording, or play audio by itself.

## Alloop: known API-level facts

The local Alloop demo can safely establish these normalized capabilities when
the Android Alloop Kit SDK is available:

- discovery: `LiteDevice { id, name, rssi }`;
- lifecycle: initialize, scan/stop scan, connect/disconnect, single active device,
  and `connecting`/`connected`/`disconnected` states;
- static/dynamic status: firmware version, battery percent, integer device state,
  and pending measurement/activity/sport history flags;
- measurement streams: SpO2 result (live and verification forms), raw PPG
  packets, and raw 3-axis ACC packets;
- history sync: typed measurement, sport, and activity records, per-type progress,
  terminal counts, and typed error event;
- known measurement fields/units from the README: HR bpm, HRV, SpO2 percent,
  respiratory rate, steps, activity count, active seconds, Celsius temperatures,
  and timestamp conventions. PPG is documented as 100 Hz four-channel raw values;
  ACC is approximately 25 Hz with documented integer bounds.

Important API behavior to preserve in an adapter/runtime:

- `queryDeviceStatus` has the documented side effect of starting pending history
  reporting; use `deviceStatusStream` for display and call the query only for a
  sync flow.
- `syncHistory` emits a terminal `allCompleted` or `error` event and closes its
  derived stream.
- The current bridge assumes one active device. SpO2/PPG/ACC payloads do not
  carry a device ID, so a multi-device runtime must not attribute those events to
  an arbitrary session.
- The plugin is Android-only (`pubspec.yaml` declares only an Android platform),
  and the README requires a physical Android device. It cannot be treated as an
  iOS implementation for the React/Vite app.

## Alloop: protocol unknowns and risk

The Alloop README says the low-level Bluetooth communication and protocol parsing
are in a closed-source AAR. The Kotlin plugin only forwards method calls and
callback maps to `AlloopCore`; the checked source contains no service UUID,
characteristic UUID, opcode, checksum, byte order, scaling formula, or firmware
compatibility table. The AAR is versioned `com.alloop:core:1.0.0`, but that is a
binary dependency version, not a ring firmware/protocol version.

Consequences for OMI-RING-006:

- Do not claim that Alloop's typed fields establish a byte-level ring protocol.
- Do not derive a web/iOS ring adapter by decompiling or guessing from the AAR.
- Require an exact ring model, firmware string, official/local reviewed profile,
  and fixture provenance before enabling any native UUID/opcode/parser.
- Keep unsupported metrics as capability states (`requires_vendor_profile` or
  `requires_real_device`), never as zero values. Raw physiological data remains
  local weak context and is not an emotion/grief/medical signal.
- If the vendor supplies a reviewed profile later, keep identity, battery, wear,
  HR/HRV, SpO2, temperature, steps/activity, PPG, ACC, history progress, and
  commands as separate optional roles. Test bounds, signedness, checksum,
  scaling, units, sequence, and terminal acknowledgements independently.

## Recommendations for OMI-RING-005

### Safe initial profile

Implement a source-cited `omi-audio` profile containing only the OMI service,
audio-data notify, audio-codec read, and optional standard battery roles above.
Inject the advertised-name matcher and firmware/model constraints. Audio chunks
must carry explicit `{ codec, sampleRateHz, bitDepth, channels, sequence,
fragmentIndex, receivedAt, source, firmware }` metadata. Unknown codec IDs and
short frames become typed local parse failures.

### Deliberately disabled capabilities

Touch, gesture, commands, acknowledgements, microphone activation, playback
triggering, and background behavior stay disabled/`requires_vendor_profile` (or
`requires_real_device`) until an official OMI source and a named physical device
prove them. No OMI STT/cloud integration belongs in this adapter task.

### Fixture and session tests

Cover empty/short notifications, one complete frame, fragmented/coalesced
notifications, packet-number wrap, index discontinuity, unknown codec, malformed
length, reconnect subscription cleanup, duplicate-session protection, and
independent propagation of parse errors. Fixtures must record source URL, OMI
model, firmware, MTU/transport assumptions, and expected decoded metadata.

## Recommendations for OMI-RING-006

Start with a configurable ring profile schema and capability matrix only. The
repository-local Alloop Dart API can inform normalized entity names/units and
history event shapes, but it is not sufficient evidence for BLE parsing. Keep
every service/characteristic/opcode/checksum/scaling field absent or disabled
until the exact model/firmware profile is reviewed. A physical iPhone validation
must confirm service discovery, notification delivery, reconnect behavior, and
actual units before any capability is promoted beyond simulator/fixture status.

## Required physical-device validation

For a named device and firmware, record a diagnostic trace containing:

1. iPhone model/iOS version, app build, device advertising name, stable runtime
   identifier, ring/OMI model, and firmware revision;
2. discovered services/characteristics and properties (read/write/notify), with
   no secrets or raw audio in committed logs;
3. permission and foreground lifecycle behavior; simulator results do not count;
4. codec/battery/status reads and notification timing;
5. packet fragmentation/coalescing, sequence continuity, parser error recovery,
   reconnect subscription count, and command acknowledgement only where an
   official profile authorizes the command;
6. consent behavior proving that touch/mark never silently grants microphone,
   playback, sharing, or content access.

Until this trace exists, the truthful status is: OMI parser/profile can be
fixture-verified from official audio framing, OMI connection/audio on iPhone is
`requires_real_device`, and Alloop/ring byte-level protocol is
`requires_vendor_profile` plus exact-device physical validation.

