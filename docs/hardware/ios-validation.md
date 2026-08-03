# iOS native validation

## Scope and current status

The Capacitor iOS project is generated with the repository-pinned Capacitor
8.5.0 toolchain and the Capacitor Community Bluetooth LE 8.2.0 plugin. The
project uses Swift Package Manager (SPM), not CocoaPods, and targets iOS 15.0 in
both the Xcode project and `ios/App/CapApp-SPM/Package.swift`.

Native dependency resolution and an unsigned simulator build can validate the
project structure. They cannot validate Bluetooth radio behavior, microphone
consent, OMI firmware framing, or a ring vendor profile. Those claims require
the named physical-device checks below.

The production device center now creates a Capacitor BLE transport on native
iOS. OMI uses its official discovery boundary and enables metadata parsing only
when firmware model, version, and reviewed fragment sizes are all configured.
Ring discovery requires explicit reviewed name/service hints and still reports
vendor-profile-required capabilities. Two important limits remain:

- the native runtime and disconnect propagation are build/simulator tested, not
  physical-radio tested;
- there is no phone-microphone recording implementation, so Loop does not currently
  request microphone permission. The positive microphone flow below remains a
  release gate for the task that implements explicit creator recording.

## Reproducible generation and sync

Use the pinned package lock and build the web assets before syncing:

```sh
npm ci
npm run build
test -d ios || npx cap add ios
npx cap sync ios
```

`npx cap add ios` is the one-time project-generation command. Do not run it over
an existing customized native project. `npx cap sync ios` is repeatable: it
refreshes `ios/App/App/public`, `capacitor.config.json`, `config.xml`, and the
managed `CapApp-SPM/Package.swift` while preserving `Info.plist` usage
descriptions and native source files.

Keep the generated Xcode project, app source, asset catalog, storyboards,
`Info.plist`, `CapApp-SPM/Package.swift`, shared workspace data, and
`Package.resolved`. Build output, `DerivedData`, `xcuserdata`, copied web assets,
and generated Capacitor config files remain excluded by `ios/.gitignore` and
are recreated by the commands above.

The root ignore rule used during the earlier Capacitor-foundation task has been
removed now that the native-project task owns `ios/`. Keep the native source
tree under version control while allowing `ios/.gitignore` to exclude copied
web assets, generated Capacitor config files, build output, and user-specific
Xcode state.

## Permissions and consent

`ios/App/App/Info.plist` contains these user-facing descriptions:

- Bluetooth: Loop discovers and connects only to a device the user selects,
  receives foreground device events, and presents connection diagnostics.
- Microphone: Loop uses the phone microphone only after the creator explicitly
  starts recording or guided capture, to create audio the creator chooses to
  save.

The usage-description key does not request permission by itself. No launch,
scan, connection, BLE notification, device mark, recipient action, or app
resume may request microphone access. The request belongs at the future
creator-initiated recording boundary, immediately before audio capture starts.
Denial must leave the creator in a visible non-recording state.

Phone microphone audio and OMI BLE audio are separate sources and require
separate UI identity and consent. A dock, charging base, ring, and wearable must
also retain separate hardware identities. A BLE `mark_moment` or touch event
may present a pending capture offer only. It must never silently start a
recording, take a photograph, play audio, share content, or grant recipient
access.

There are no camera, photo-library, HealthKit, or background-mode declarations.
Do not add them without a separately implemented and reviewed feature.

## Foreground and background lifecycle

The supported native BLE lifecycle is foreground-only:

1. Initialize Bluetooth and expose denied, powered-off, and unsupported states.
2. Start a user-visible scan, stop it before connecting, and discover services.
3. Subscribe to the reviewed characteristic once per active session.
4. Surface disconnects and perform bounded, visible reconnect handling.
5. Stop notifications and disconnect when the session or transport closes.

`UIBackgroundModes` is intentionally absent. Once iOS suspends the app, Loop
does not promise continued JavaScript execution, scans, notification delivery,
reconnect timers, OMI audio delivery, or hardware-event wake-up. A callback
that arrives during a foreground-to-background transition must still obey the
same pending-only consent policy. On foreground resume, inspect the current
connection state and require a visible reconnect when needed; do not infer that
the session remained active.

Background BLE, background audio, and an always-on listener remain unsupported
until an implementation exists and is validated on an exact iPhone, iOS build,
wearable model, and firmware. Passing a simulator build is not that evidence.

## Data protection and diagnostics

The app runs in the normal iOS sandbox and defines no custom file-protection
entitlement or weaker protection class. The current device-center runtime is
in-memory. If a host injects runtime persistence, its contract permits only
selected device references, profile selections, scalar preferences, and consent
settings. It does not persist active connection claims, raw BLE packets, raw
audio, continuous sensitive telemetry, or runtime diagnostic history.

Runtime diagnostics are bounded and redacted. They may contain an operation,
phase, fixed error code/message, timestamp, adapter reference, and retry count.
They must not contain runtime device identifiers, advertisement payloads, GATT
packet bytes, audio samples, physiological values, signing data, or vendor
secrets. Do not add packet or audio dumps to JavaScript logs or the Xcode
console. Redact diagnostics before attaching them to an issue.

The copied web bundle in `ios/App/App/public` is application code, not a place
for captured user content. Before any recording feature writes an audio file,
that feature must define iOS file protection, backup exclusion, retention,
deletion, and export consent and must validate them on a physical device. This
native-project task does not claim that storage implementation exists.

## Xcode and signing

An unsigned simulator build needs no Apple account:

```sh
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.5' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

For a physical-device build:

1. Run `npm run build && npx cap sync ios`.
2. Open `ios/App/App.xcodeproj` in Xcode and select the `App` target.
3. In Signing & Capabilities, use automatic signing and select an authorized
   development account locally.
4. Connect and trust the target iPhone, enable Developer Mode, choose it as the
   run destination, and build.
5. Do not commit a development team, provisioning profile, certificate,
   credential, device identifier, or user-specific Xcode data. If the configured
   bundle identifier cannot be registered by the account, stop and coordinate a
   deliberate app-identifier change rather than committing an ad hoc value.
6. Do not add Background Modes, HealthKit, microphone background audio, or other
   Signing & Capabilities entries as a workaround.

## Simulator limits

The iOS simulator validates compilation, package linkage, launch assets, web
asset loading, hash routing, and non-radio UI. The BLE plugin documents
Bluetooth as unsupported in the simulator, so scan, connect, service discovery,
notifications, disconnect recovery, OMI audio, and firmware behavior must be
tested on hardware.

A simulator microphone can be routed from the Mac, but it does not prove the
physical iPhone permission prompt, audio route, interruption handling, lock
behavior, data protection, or real microphone capture. A simulator mark event
proves pending-state UI only; it is not firmware or radio evidence.

## Named physical-device validation

The first recorded host target is an iPhone 17 (`iPhone18,3`) on iOS 26.5.2
beta. On 2026-08-03, Xcode could list the paired device but `devicectl` could not
establish a connection, so no signed install or physical test below is marked
as passed. Record no user-assigned device name, UDID, serial number, team
identifier, or provisioning details in test evidence.

The first OMI firmware target is a physical unit advertising the exact name
`Omi` on firmware v1.0.3, using the repository's pinned official audio profile.
That exact unit was not available during native-project validation. Firmware
v1.0.3 is a named test target, not a claim that later firmware behaves the same.
The generic ring adapter has no authorized exact model, firmware, GATT profile,
or parser, so an Alloop/ring physical test is blocked until those exact values
come from a reviewed vendor source.

Run and retain a redacted result for each check:

| ID | Physical check on the iPhone 17 test target | Pass condition | Current status |
| --- | --- | --- | --- |
| `IOS-BLE-01` | Install fresh, leave Bluetooth permission undetermined, open the physical-device flow, and explicitly start discovery. Repeat once denied and once allowed. | The system prompt uses the committed description; denial is visible and causes no crash; allowance discovers only after the user action. | Not run: native transport is wired; the paired phone was unreachable. |
| `IOS-BLE-02` | With OMI `Omi` firmware v1.0.3 in range, scan, connect, discover the official service, read the codec characteristic, and start the audio notification. | One connection and one notification subscription exist; codec/profile mismatches fail visibly without packet or audio logging. | Not run: named OMI unit unavailable. |
| `IOS-BLE-03` | While connected in the foreground, power-cycle the OMI unit and toggle iPhone Bluetooth. | Disconnect, powered-off, and reconnect states are distinguishable; cleanup is idempotent; no stale callback attaches to the new session. | Not run. |
| `IOS-BLE-04` | Move Loop to the background and lock the phone during an active OMI session, then return to the foreground. | The app makes no background-delivery claim, starts no media, and shows the actual state or a visible reconnect path on resume. | Not run. |
| `IOS-FW-01` | Stream known audio from OMI firmware v1.0.3 with the exact negotiated MTU and reviewed fragment layout recorded in redacted evidence. | Codec ID, sequence, fragment order, discontinuity handling, and reconnect reset match the pinned profile; raw audio is absent from diagnostics. | Not run: physical firmware and MTU evidence required. |
| `IOS-MIC-01` | Fresh-install Loop, launch it, scan/connect BLE, receive a mark event, dismiss or enter the pending capture offer, and inspect microphone permission state before starting a recording. | No microphone prompt appears and no recording, photograph, playback, or share begins. | Not run: signed install unavailable; mark firmware profile is also unavailable. |
| `IOS-MIC-02` | From the creator capture flow, explicitly press the future record/guided-capture control; test both deny and allow on a fresh permission state, then stop capture and lock the phone. | The prompt appears only after the explicit press; denial records nothing; allowance shows an active recording state; stop/background ends capture according to the implemented foreground policy. | Blocked: no microphone capture implementation exists. |
| `IOS-RING-01` | After a reviewed profile exists, record the exact ring model, firmware, advertised name, GATT source, and parser, then trigger one physical mark. | Exactly one pending offer appears with source attribution; no microphone, camera, playback, sharing, or content access starts. | Blocked: exact vendor profile and firmware are unavailable. |

Do not promote BLE, microphone, OMI firmware, ring, or background status from
`requires_real_device` or `requires_vendor_profile` on simulator evidence.

## Host validation commands

Use these checks after every native-project or dependency change:

```sh
npm run typecheck
npm test
npm run build
npx cap sync ios
plutil -lint ios/App/App/Info.plist
plutil -extract NSBluetoothAlwaysUsageDescription raw ios/App/App/Info.plist
plutil -extract NSMicrophoneUsageDescription raw ios/App/App/Info.plist
xcodebuild -project ios/App/App.xcodeproj -scheme App -resolvePackageDependencies
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.5' \
  CODE_SIGNING_ALLOWED=NO build
```

CocoaPods 1.16.2 is installed on the validation host, but this Capacitor 8.5.0
project has no `Podfile`; `pod install` is therefore not part of the build.
Podspec syntax can still be inspected without converting the SPM project:

```sh
pod ipc spec node_modules/@capacitor/ios/Capacitor.podspec >/dev/null
pod ipc spec node_modules/@capacitor-community/bluetooth-le/CapacitorCommunityBluetoothLe.podspec >/dev/null
```
