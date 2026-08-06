# OMI audio adapter

## Scope and validation status

`apps/software-mvp/src/devices/adapters/omi` implements the source-documented OMI audio profile on
the existing `DeviceAdapter` and `DeviceTransportSession` contracts. It performs
discovery matching, reads the codec characteristic before subscribing, parses
the official three-byte audio header, and emits normalized metadata without raw
audio bytes.

The parser is fixture-validated only. OMI connection and audio delivery still
require validation on a named physical device, firmware, iPhone/iOS version, and
negotiated BLE MTU. The adapter does not request microphone consent, transcribe,
play audio, or claim background delivery.

## Official profile sources

The built-in `omi-audio-official-eb353430` profile is pinned to OMI repository
commit `eb35343053ffda69676d13eb88874b576f71f180`, recorded by the protocol
research on 2026-08-02.

- [OMI shared device protocol at the pinned commit](https://github.com/BasedHardware/omi/blob/eb35343053ffda69676d13eb88874b576f71f180/sdks/device/PROTOCOL.md)
  is the source of the three audio GATT UUIDs, three-byte header size, codec IDs
  `0`, `1`, and `20`, and the 16 kHz mono shared assumptions.
- [OMI TypeScript helpers at the same commit](https://github.com/BasedHardware/omi/blob/eb35343053ffda69676d13eb88874b576f71f180/sdks/device/typescript/src/index.ts)
  repeat the UUIDs, `PACKET_HEADER_BYTES = 3`, codec enum, 16 kHz constant, and
  mono constant.
- [Official generated App-Device Protocol documentation](https://docs.omi.me/doc/developer/Protocol.md)
  documents the advertised name `Omi`, packet-number bytes 0-1 in little-endian
  order, fragment index byte 2, packet-number wrap at 65535, and firmware notes.
  It is not commit-pinned, so it is treated as firmware/profile documentation,
  not silently merged into the shared contract.

The built-in audio GATT values are exactly:

| Role | UUID |
| --- | --- |
| OMI audio service | `19b10000-e8f2-537e-4f6c-d104768a1214` |
| Audio data notify | `19b10001-e8f2-537e-4f6c-d104768a1214` |
| Audio codec read | `19b10002-e8f2-537e-4f6c-d104768a1214` |

No touch, gesture, command, acknowledgement, checksum, sensor, or vendor battery
UUID/opcode is present in the profile.

## Firmware and codec caveat

The pinned shared contract describes codec ID `0` as PCM 16-bit, `1` as PCM
8-bit, and `20` (`0x14`) as Opus. Its TypeScript helper exposes a shared 16 kHz
sample-rate constant and mono channel constant. The built-in profile follows
that pinned shared contract:

| ID | Normalized codec | Sample rate | Bit depth | Channels |
| --- | --- | --- | --- | --- |
| `0` | `pcm_s16le` | 16,000 Hz | 16 | 1 |
| `1` | `pcm_u8` | 16,000 Hz | 8 | 1 |
| `20` | `opus` | 16,000 Hz | 16-bit decode target | 1 |

The generated official documentation currently describes ID `1` differently
as 8 kHz, 16-bit PCM and additionally lists Mu-law IDs `10` and `11`. Those
values are not merged into the built-in pinned profile. A firmware-specific
variant must provide its own source URL, reference, firmware caveat, codec table,
and physical-device evidence. Unknown codec IDs fail locally before the audio
subscription starts.

OMI's source says header size and codec behavior are firmware-coupled. Firmware
v1.0.3+ is documented as defaulting to Opus, while older firmware used PCM; this
adapter never infers a firmware from the codec byte.

## Configurable framing

The official three-byte header has no payload-length field or synchronization
marker. A byte stream therefore cannot safely distinguish a coalesced next
header from arbitrary compressed audio solely by inspecting bytes. The adapter
requires a reviewed `payloadBytesByFragmentIndex` configuration whose keys are
fragment indexes and whose values are payload bytes after the header:

```ts
const adapter = createOmiAudioAdapter({
  framing: {
    payloadBytesByFragmentIndex: {
      0: reviewedFirstFragmentPayloadBytes,
      1: reviewedSecondFragmentPayloadBytes,
    },
  },
  firmware: {
    model: reviewedDeviceModel,
    version: reviewedFirmwareVersion,
    validation: 'physical_device',
  },
})
```

There is deliberately no default MTU or payload length. With a reviewed layout,
the parser retains split headers/payloads across transport frames and drains
multiple coalesced OMI frames without dropping bytes. An unknown fragment layout
produces `invalid_fragment_layout` and clears only that parser's unsynchronized
buffer; it does not close the device session or affect another session.

## Parsed metadata and errors

Each normalized `audio_chunk` event contains metadata only:

- codec, sample rate, bit depth, and channel count;
- transport sequence and parser-local session sequence;
- little-endian OMI packet sequence and fragment index;
- `receivedAt` and transport receive source;
- profile ID, source URL/reference, firmware caveat, configured model/firmware,
  and validation status.

Raw header and audio bytes remain in the transport-to-parser-to-adapter path and
are not attached to normalized events. Parse failures use typed codes
(`empty_input`, `incomplete_frame`, `invalid_fragment_layout`, `unknown_codec`,
and `fragment_discontinuity`) with generic messages and non-sensitive receive
metadata. They never include payload, audio sample, codec byte, device identifier,
or physiological values. A discontinuity emits a local failure and preserves the
otherwise valid current audio chunk so later frames continue.

## Discovery and lifecycle

The default matcher accepts a connectable BLE discovery result containing the
official service UUID or the exact official `Omi` name hint. A name is only a
matching hint, not device identity. Profile variants may inject reviewed exact
names or prefixes while retaining explicit provenance.

Opening a session reads and validates the codec characteristic before requesting
the audio notification. `DeviceTransportSession.subscribe` then validates the
audio notify characteristic before native notifications start. One transport
session can own only one active OMI adapter session, while multiple normalized
listeners share that single transport subscription.

Close stops frame acceptance, flushes a pending short-frame failure, unsubscribes,
and closes the owned transport session. Concurrent and repeated close/unsubscribe
calls reuse idempotent cleanup. A reconnect uses a new transport session, parser,
normalized session ID, and parser-local sequence starting at 1; late callbacks
from the closed session are ignored.

## Unsupported capabilities

The official reviewed sources do not define touch/gesture events, writes,
commands, acknowledgements, status operations for this audio-only profile, or
additional sensors. The adapter reports interaction, telemetry, haptic, light,
and status capabilities as `requires_vendor_profile`; normalized command attempts
return the existing typed capability-unavailable result and perform no write.
Audio reports `requires_real_device` until the named firmware/device and consent
flow are validated. No unsupported operation is simulated or guessed.
