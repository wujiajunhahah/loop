# Smart ring adapter

## Protocol boundary

This adapter is a generic, configurable foundation. It intentionally ships with
no default vendor ring profile.

The repository-local protocol research in
`.loop/reports/protocol-research-20260802.md` is authoritative for this
boundary. The Alloop Dart bridge exposes typed callbacks through a closed
Android AAR, but the reviewed source does not contain a BLE byte-level contract.
The AAR is not a protocol reference. No Alloop UUIDs, opcodes, checksums,
endianness, signedness, scaling, units, or firmware compatibility values may be
inferred from it.

The ring adapter therefore accepts those values only from an injected,
vendor-reviewed profile. The empty profile has no discovery hints, GATT roles,
parsers, encoders, enabled capabilities, or native subscriptions. Unsupported
roles stay unavailable instead of returning a zero or placeholder metric.

## Profile configuration

`RingProfile` records the provenance and exact device constraints alongside
discovery hints and optional role definitions. A role may reference a GATT
characteristic, a notification/read source, a parser, and, for commands, an
explicit reviewed encoder. The adapter never supplies these values.

The available role names are:

| Role | Intended normalized surface |
| --- | --- |
| `identity` | Model/device identity metadata |
| `battery` | Battery metric or status |
| `wear` | Worn/removed status |
| `heart_rate` | Heart-rate metric |
| `rr_hrv` | RR interval or HRV metric |
| `spo2` | SpO2 metric |
| `temperature` | Temperature metric |
| `steps_activity` | Steps or activity history/metric |
| `ppg` | Raw PPG, local-only |
| `accelerometer` | Raw accelerometer data, local-only |
| `history_sync` | History records and progress |
| `commands` | Explicitly reviewed command encoders |

Illustrative configuration with no protocol values filled in:

```ts
const profile = createRingProfile({
  profileId: 'vendor-ring-model-firmware-v1',
  provenance: {
    sourceReference: '<official-document-or-reviewed-trace>',
    sourceUrl: '<source-url>',
    validation: 'fixture_only',
  },
  constraints: {
    model: { exact: '<exact-ring-model>' },
    firmware: { exact: '<exact-firmware-string>' },
  },
  discovery: {
    serviceIds: ['<reviewed-service-id>'],
    names: ['<reviewed-advertised-name>'],
    namePrefixes: ['<reviewed-name-prefix>'],
  },
  roles: {
    heart_rate: {
      capability: { status: 'requires_real_device' },
      gatt: {
        serviceId: '<reviewed-service-id>',
        characteristicId: '<reviewed-heart-rate-characteristic-id>',
      },
      source: 'notification',
      parser: reviewedHeartRateParser,
    },
  },
})
```

Only a profile that has an exact model and firmware constraint, a configured
GATT reference, a notification source, and an injected parser can declare a
data role `implemented`. This foundation does not activate `source: 'read'`
roles because the current `DeviceSession` has no explicit normalized read
trigger; such a declaration is rejected instead of silently claiming a metric.
A role marked `requires_vendor_profile` or
`requires_real_device` is never subscribed, read, or written. The adapter
matches only connectable BLE discoveries against the configured service/name
hints; discovery hints are not identity proof.

## Parser boundary

`createRingFrameParser` is a rule-driven parser helper. Every rule is supplied
by the profile author:

- field offset and byte length;
- signedness and byte order;
- optional scale and offset;
- optional minimum and maximum after transformation;
- optional unit;
- optional checksum algorithm and checksum field.

With no checksum rule, no checksum is checked. With no scale, no scaling is
applied. With no unit, no unit is claimed. Parser output contains normalized
values or a status/history shape, never the input `Uint8Array`. Parser and
profile failures use fixed non-sensitive messages and omit device identifiers,
packet bytes, audio, physiological values, and raw payloads.

Unknown or malformed frames produce a local `parse_failure` event and do not
close other subscriptions or sessions. Listener exceptions are isolated so
one consumer cannot block parser recovery or another listener.

## Capability states

Every role has an explicit capability state:

| State | Meaning |
| --- | --- |
| `implemented` | A reviewed parser/encoder and the configured role boundary exist. Physical validation may still be required by the profile provenance. |
| `requires_real_device` | The profile is known, but the named model/firmware behavior is not physically validated in the required environment. |
| `requires_vendor_profile` | No reviewed role parser, GATT reference, or command encoder is configured. |

The session also reports the existing normalized device capability report. A
command is eligible only when both the corresponding normalized capability and
an injected `RingCommandDefinition.encode` function exist. Otherwise execution
returns `capability_unavailable` with `requires_vendor_profile` and performs no
write. There are no guessed writes or fallback opcodes.

## Context and privacy

Ring metric, status, and history events carry explicit profile provenance and:

```text
contextStrength = weak
interpretationPolicy = no_emotion_grief_or_health_inference
```

These events are weak context only. The adapter does not infer diagnosis,
medical meaning, emotion, grief, mood, identity, or a recipient from wearable
data. A connection, wear signal, or metric cannot grant microphone, playback,
sharing, content access, or any other consent.

Raw PPG and accelerometer roles are forcibly marked `local_only` and
`exportConsentRequired`, even if an injected parser is misconfigured. The
adapter deliberately omits their values from normalized events and rejects
status/history-shaped output from those roles. They must remain inside an explicitly consented local
processing/export boundary; this adapter does not silently export or share raw
physiological data.

## Required physical validation

Before promoting a fixture-only role to a usable physical capability, record a
diagnostic trace for one exact ring model and firmware. Do not commit raw audio,
physiological values, advertisement payloads, or secrets.

The trace must identify:

1. iPhone model and iOS version, app build, ring model, exact firmware, and the
   advertised name. Runtime identifiers must remain opaque and must not cross
   the normalized adapter boundary.
2. Discovered services and characteristics with their read/write/notify
   properties, sourced from an official document or reviewed vendor trace.
3. Permission behavior and foreground lifecycle behavior on a physical iPhone;
   simulator results do not count for BLE validation.
4. Notification/read delivery, timing, units, signedness, scaling, bounds, and
   parser recovery for each enabled role.
5. Fragmentation/coalescing and sequence behavior, reconnect cleanup, and proof
   that each configured role creates at most one native subscription.
6. History sync progress and terminal behavior where `history_sync` is
   configured.
7. Command writes and acknowledgements only when an official profile explicitly
   authorizes the command, including response mode, checksum, and failure
   behavior.
8. Consent behavior proving that a ring event or mark cannot silently start
   capture, playback, sharing, or content access.

Until this trace and the corresponding reviewed profile exist, the truthful
status for Alloop/ring byte-level behavior is
`requires_vendor_profile`, and physical-device behavior is
`requires_real_device`.
