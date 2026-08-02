# Device wire protocol

Schema version 1 is a vendor-neutral, JSON-native boundary between device
adapters and consumers. It defines no BLE service, characteristic, opcode,
codec id, or firmware assumption. Adapters supply opaque characteristic and
raw-frame references only; raw frames never enter this protocol.

`sequence` is supplied by the session owner and must strictly increase within a
session. The codec validates a positive safe integer but is intentionally
stateless, so session code remains responsible for monotonic ordering.

Telemetry is optional weak context. Heart rate, RR intervals, SpO2,
temperature, steps/activity, acceleration, battery, and wear state must never be
treated as emotion, grief, diagnosis, or intervention signals. Every emitted
measurement carries its own source, device/receipt timestamps, unit, optional
quality, and provenance.

Commands retain one `commandId` across retries. Acknowledgements echo that id
and mark whether the receiver deduplicated the retry. Parse failures are normal,
non-fatal messages with enum-only details. Codec errors use fixed redacted text;
raw audio and physiological values must not be logged or copied into errors.
