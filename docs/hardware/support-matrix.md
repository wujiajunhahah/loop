# OMI and ring support matrix

Status is evidence-based. `Implemented` means code exists; it does not imply a
physical-device pass. `Simulator verified` and `iPhone build verified` are kept
separate from radio, firmware, and sensor validation.

| Capability | Implemented | Simulator / automated evidence | iPhone build | Physical device | Remaining requirement |
| --- | --- | --- | --- | --- | --- |
| Device transport/adapter contracts | Yes | Contract and lifecycle tests | Compiled | Not required for shape | None |
| Versioned normalized protocol | Yes | Encode/decode, malformed input, privacy tests | Compiled | Not run | Validate producer mapping on hardware |
| Capacitor BLE scan/connect/GATT/notifications | Yes | Mock BLE lifecycle and disconnect tests | SPM resolved; unsigned simulator build passed | Not run | Reachable signed iPhone and BLE peripherals |
| Browser fallback | Yes | Unsupported state and deterministic simulator UI tests | Compiled | Not applicable | None |
| OMI official discovery/GATT/codec boundary | Yes | Source-pinned adapter/parser fixtures | Compiled | Not run | Named OMI, firmware, codec and MTU evidence |
| OMI audio metadata parsing | Configurable | Split/coalesced/discontinuity fixtures | Compiled | Not run | Reviewed fragment sizes in `VITE_OMI_FRAGMENT_LAYOUT` |
| Raw OMI audio recording/transcription/playback | No | Metadata only | Permission description compiled | Not run | Explicit product/storage/audio implementation and consent validation |
| Ring discovery boundary | Configurable | Explicit discovery-hint tests | Compiled | Not run | Reviewed exact model/name/service source |
| Ring telemetry parser | Configurable | Fixture profile/parser and simulated HR | Compiled | Not run | Vendor GATT/parser plus exact firmware constraints |
| Ring mark/touch | Simulator only | HR -> mark -> touch runtime/UI integration | Compiled | Not run | Reviewed vendor profile; no UUID/opcode is guessed |
| Interaction consent and revocation | Yes | Default deny, delivery gate, purge tests | Compiled | Not run | Physical event validation |
| Binding/entrustment/recipient identity | Yes, local mock bridge | Wrong recipient, duplicate, unbound, creator and recipient handoff tests | Compiled | Not production auth | Replace `LOOP-DEMO` proof with product identity service |
| Unexpected disconnect visibility | Yes | Transport -> adapter -> runtime failure tests | Compiled | Not run | Power-cycle and Bluetooth-toggle tests on iPhone |
| Parse diagnostics | Yes | Fixed typed redaction test | Compiled | Not run | Confirm Xcode/device logs remain redacted |
| Creator bounded capture and provenance | Yes for text/demo inputs | Device mark -> review -> save/cancel tests | Compiled | Not run | Native media capture remains unimplemented |
| Recipient entry/presentation/response | Yes | Deep-link gate, source, text/image/audio choice, permanent close, response tests | Compiled | Not run | Image remains unavailable without an authorized photo source |
| Background BLE/audio | No | No background entitlement | Compiled without modes | Not run | Separate implementation and named-device validation |
| HealthKit | No | No entitlement or adapter | Compiled without HealthKit | Not run | Separate scoped feature and consent review |

## Configuration boundary

- OMI parsing activates only when firmware model, firmware version, and a
  positive integer fragment layout are all present. Configuration provenance is
  still `fixture_only` until physical evidence is recorded.
- Ring names/service IDs identify discovery candidates only. They do not enable
  telemetry, touch, history, haptics, lights, or commands.
- Raw BLE frames and audio remain below the normalized event boundary and are
  excluded from runtime diagnostics and handoff storage.

See `docs/hardware/omi.md`, `docs/hardware/smart-ring.md`, and
`docs/hardware/ios-validation.md` for protocol sources and physical checklists.
