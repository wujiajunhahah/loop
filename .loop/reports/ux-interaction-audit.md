# Loop device-center and interaction UX audit

Date: 2026-08-02
Scope: read-only audit of the current React/Vite app and an implementation contract
for OMI-RING-008, with native and final-audit handoffs to OMI-RING-009/010. This
report does not claim physical-device validation and does not authorize BLE,
microphone, camera, playback, or sharing from a hardware event.

## Executive finding

The existing MVP already protects several important boundaries: playback is
explicit, original and AI-organized content are visually separated, recipient
choices include postpone/skip/close, and the domain marks wearable telemetry as
weak context with no emotion, grief, or health inference. Those behaviors should
remain unchanged.

OMI-RING-008 is not currently represented in the route tree. There is no
`#/devices` page, device-center navigation, BLE permission/power state,
discovery UI, connection/reconnect UI, live-data freshness, capability matrix,
consent view, or clearly labeled simulator mode. The current hardware simulator
is a developer test bench, not a mobile device center. The recording-derived
creator/recipient interaction is also only partly present: capture is a long
form rather than bounded guidance, `mark_moment` has no capture handoff, and the
recipient flow has provenance and lifecycle gaps.

The implementation should treat OMI-RING-008 as a quiet operational page, not a
new marketing surface and not a replacement for the existing capture or
recipient policies.

## Current route and UI audit

### Route gaps

| Finding | Current evidence | Required behavior |
| --- | --- | --- |
| No device center | `src/app/App.tsx` has `/hardware` and three simulator routes, but no `/devices`. Unknown routes silently render Home. | Add exactly `#/devices`; unknown device paths must not look like a successful Home navigation. |
| Primary navigation is development-oriented | Primary links are Recorder, Recipient, and Hardware. Hardware opens an explainer, then a separate simulator. | Replace the primary Hardware label with Devices. Keep existing simulator routes available from a diagnostics/developer link, not as the main consumer entry. |
| Parent routes do not stay active | `NavigationLink` uses exact equality, so capture and recipient subroutes lose the active marker. It also lacks `aria-current`. | Match the route or its `/` descendants and expose `aria-current="page"`. |
| Capture deep links have no guard | A refresh on `#/capture/review` renders an empty in-memory draft; save has no failure state. | Redirect an absent draft to guided capture with a polite status. Preserve retry/cancel when save fails. |
| Recipient deep links bypass the visible gate | Any `/recipient/memory/:id` starts with an already-active demo session. The path ID is not used to select the memory. | Require a verified, recipient-initiated session and resolve the requested seed ID; otherwise return to the identity gate. |
| Permanent close is not permanent | Close updates component state, navigates home, then a new visit creates a fresh active session. | Persist the recipient's close choice. Reopening must require an explicit recipient settings action. |
| Hardware event loses provenance | A simulator touch routes directly to `/recipient/verify`; the recipient UI does not retain device/event/source or simulated status. `mark_moment` is not connected to capture. | Store a pending, verified handoff containing event ID, device, source, role, and time. The handoff may offer entry; it cannot grant content or sensor permission. |

### Current interaction gaps

1. `CaptureFlow` begins with a three-section form. It asks recipient, topic,
   meaning, and optional plan, but does not provide a low-pressure prompt
   sequence or a first-class situation field.
2. Audio and image are text simulations. That is truthful, but there is no
   separate pending, permission, ready, recording, stop, review, or failure
   state for eventual native capture.
3. The current `Memory` foundation has an immutable-looking original,
   relationship, recipient, meaning, and organized source IDs. It does not yet
   separately model situation, creator intent, hardware/audio source, consent
   receipt, derived-presentation identity, or review time.
4. Recipient loading has no caught empty/error/retry state. If Agent entry
   rejects, the page can remain unresolved. The original-play action sets
   `playing` but never exposes stop, completion, or playback failure.
5. The recipient source panel is hardcoded as Mei audio even if the selected
   memory is text/image. AI source IDs and owner-review evidence are not visible.
6. Recipient response saving has no saving, empty, error, retry, or explicit
   ownership message. It correctly avoids an immediate fake reply; preserve that.
7. Existing status UI covers only a generic ready/pending panel and the
   simulator's available/fallback strip. It does not cover the OMI-RING-008
   state matrix.
8. UI language alternates between Chinese and English within individual flows.
   This is usable for a demo but makes permission and provenance wording less
   predictable. Safety-critical labels should use one primary locale per build.

### Existing behavior to preserve

- A recipient explicitly presses Play before original audio starts.
- Original and AI-organized presentations remain distinct.
- `allowNewMemoryGeneration` remains false.
- Recipient actions remain accept, postpone, skip, and close.
- Recipient-authored responses remain outside creator-authorized source material.
- Wearable values remain weak context and never cause emotional inference or
  content playback.
- Simulator and offline flows remain deterministic and do not masquerade as
  physical-device validation.

## Exact mobile device-center information architecture

Use one route, `#/devices`, with in-page disclosures. Do not create a maze of
BLE subroutes. At 320 px the screen order is:

1. **Route heading**: `设备`, a compact subtitle `OMI 与智能戒指`, and one-line
   overall status such as `1 台已连接 · 演示数据关闭`.
2. **Role mode**: a native-radio segmented control with `记录这一刻` and
   `接收陪伴`. The mode controls what a verified hardware event may offer. It
   never changes content ownership or permissions.
3. **Environment strip**: foreground/platform state plus a real switch labeled
   `使用演示数据`. When enabled, keep a persistent `演示数据` label at the page
   and value level.
4. **Bluetooth gate**: exactly one of loading, unsupported, permission needed,
   permission denied/restricted, Bluetooth off, ready, scanning, scan error, or
   empty result. The primary action belongs here: Allow, Open Settings, Scan,
   Stop, or Retry.
5. **Device list**: OMI and ring are independent rows. Each row contains name,
   device type, connection state, last update, signal if available, and one
   Connect/Cancel/Disconnect/Retry action. An OMI failure must not hide a
   connected ring, and vice versa.
6. **Expanded device detail**: an unframed region directly below its row, split
   by rules into Capabilities, Live data, and Device status. Do not put cards
   inside a device card.
7. **Consent and handoff**: `触碰后的动作` states that marks only create a
   pending prompt. Show `麦克风：仅在你点击开始录音时询问`, `自动播放：关闭`,
   and `分享：每次确认`. These are policies/statuses, not fake permission
   toggles.
8. **Diagnostics disclosure**: collapsed by default. Show redacted operation,
   typed error, time, retryability, support tier, app foreground state, and
   firmware only when actually observed. Never show raw audio, packet bytes,
   physiological history, recipient identity, or a full persistent device ID.
9. **Pending event sheet**: rendered only after a verified event. In creator
   mode it asks whether to enter guided capture. In recipient mode it asks
   whether to enter the identity gate. Dismiss is always available.

On desktop, keep the same information order. The discovery/device list may use
the left four columns and the selected device detail the right eight columns,
but all state and actions must remain in DOM order matching the mobile flow.

### Device detail content

**OMI**

- Identity: observed display name, model/firmware only if read, transport, and
  validation tier.
- Connection: state, signal, battery if available, last transport event.
- Capabilities: audio notification and codec/battery roles only when supported
  by the reviewed profile. Touch, commands, acknowledgement, and background
  listening remain `等待设备协议` or `需要真机验证`.
- Audio: `未在录音` by default. A connected audio notification stream is not
  permission to record, transcribe, save, or play.

**Ring**

- Identity and connection use the same row contract as OMI.
- Show only profile-supported values. Missing HR/HRV/SpO2/temperature/activity
  is `暂无数据`, `需要真机`, or `等待设备协议`, never zero.
- Every physiological/motion value includes unit, observed time, freshness, and
  `弱情境 · 不用于判断情绪、悲伤或健康`.
- Raw PPG/ACC belongs in diagnostics only as stream status/count, never as an
  emotion score or an endlessly updating accessible live region.

### Hardware handoff copy

Creator pending sheet:

> 戒指记录到一次标记。要为这一刻留个位置吗？

Actions: `进入记录引导`, `稍后`, `忽略`. The first action navigates to capture;
only a later explicit source action may request microphone/camera access.

Recipient pending sheet:

> 戒指记录到一次触碰。一段经过托付的内容可以由你决定是否打开。

Actions: `确认这是给我的`, `稍后`, `忽略`. Do not show the memory body, start
audio, or assemble Agent content before identity confirmation and active entry.

## Interaction state machines

### Creator capture

```text
creator_idle
  -- verified mark_moment --> pending_mark

pending_mark
  -- ignore --> creator_idle
  -- later --> parked_mark
  -- enter guide --> guided_prompt

guided_prompt
  -- answer/skip bounded prompt --> source_choice
  -- cancel --> creator_idle

source_choice
  -- text --> source_draft
  -- photo --> camera_preflight
  -- audio --> microphone_preflight

microphone_preflight
  -- explicit Continue --> native_permission_prompt
  -- choose text --> source_draft
  -- cancel --> guided_prompt

native_permission_prompt
  -- denied/restricted --> permission_blocked
  -- granted --> audio_ready

audio_ready
  -- explicit Start recording --> recording
  -- cancel --> guided_prompt

recording
  -- Stop --> original_review
  -- interruption/failure --> recoverable_capture_error

source_draft/original_review
  -- keep --> relationship_prompt
  -- redo/delete --> source_choice

relationship_prompt
  --> situation_prompt
  --> creator_intent_prompt
  --> optional_future_interaction_prompt
  --> memory_seed_review

memory_seed_review
  -- approve source/policy/derived labels --> saving
  -- edit --> corresponding bounded prompt
  -- cancel --> discard_confirmation

saving
  -- success --> saved
  -- failure --> save_error (Retry / Keep draft / Discard)
```

Rules:

- A mark enters only `pending_mark`; it cannot skip to any permission, capture,
  generated presentation, or save state.
- Prompts are bounded and skippable. They may ask what happened, who this is
  for, why it matters, and whether there is a future invitation. Do not render
  an unconstrained chat that impersonates the creator.
- No source is saved until its modality and provenance are visible in review.
- Cancel remains available before save; deleting a captured source requires a
  confirmation because it is destructive.

### Recipient companionship

```text
recipient_locked
  -- verified entrusted touch --> pending_entry
  -- open App manually --> pending_entry

pending_entry
  -- later --> parked
  -- ignore --> recipient_locked
  -- continue --> identity_gate

identity_gate
  -- mismatch --> access_denied
  -- postpone/skip --> recipient_locked
  -- permanent close + confirm --> persistently_closed
  -- verified + explicit open --> seed_loading

seed_loading
  -- presentable source --> seed_explore
  -- empty --> seed_empty
  -- error --> seed_error

seed_explore
  -- choose text/image/audio presentation --> presentation_ready
  -- postpone/skip/close --> corresponding recipient choice

presentation_ready
  -- explicit Play (audio only) --> playing
  -- view derived content --> derived_view
  -- open invitation --> plan_invitation
  -- respond --> response_draft

response_draft
  -- review and save --> response_saving
  -- cancel --> seed_explore

response_saving
  -- success --> response_saved_without_agent_reply
  -- failure --> response_error

plan_invitation
  -- accept --> plan_active
  -- postpone/skip/close --> corresponding recipient choice
```

Rules:

- No hardware or navigation deep link skips identity and active-entry checks.
- Audio never autoplays. Playback exposes Play/Pause/Stop, completion, and
  failure without changing layout.
- A recipient response is owned by the recipient and is not silently added to
  creator-authorized Agent context.
- Success copy says the response was saved. It does not manufacture an
  immediate reply from the absent person.
- `close` is confirmed and persistent; `skip` is this encounter only;
  `postpone` keeps a neutral future entry. The labels must not be synonyms.

## Memory Seed provenance contract

A Memory Seed is not an AI summary. It is a provenance-bearing group whose
minimum meaning is:

```text
real original source
+ relationship and intended recipient
+ situation
+ creator intent / why it matters
+ policy and creator review
= Memory Seed
```

### Required facts

1. **Seed identity**: seed ID, creator/owner ID, relationship ID, intended
   recipient ID, created time, and state (`draft`, `reviewed`, `entrusted`, or
   `closed`).
2. **Original source**: modality, capture time, capture origin (`phone_mic`,
   `omi_mic`, `camera`, `import`, or `text`), hardware event reference when
   applicable, checksum when available, and consent receipt reference. Device
   identity and audio source are separate fields.
3. **Situation**: creator-written situation plus optional sourced context such
   as weather, photo, plan, daily action, or a wearable observation reference.
   Each contextual fact has source and observed time. Wearable facts retain
   `weak` context strength.
4. **Creator intent**: why this is for this recipient, desired future
   interaction, and any exact invitation. Intent is human-authored, not inferred
   from sensor data.
5. **Policy snapshot**: visibility, original playback permission, organization/
   paraphrase permission, generated modality permission, proactive-delivery
   rule, no-new-will rule, review state, and review time.
6. **Derived presentation**: its own ID, modality, generated/organized time,
   exact source memory IDs, generator/version where relevant, owner review
   status, and approved/rejected status. It never replaces the original.
7. **Recipient response boundary**: recipient owner, response-to seed ID,
   recipient consent, and an explicit default exclusion from creator-authorized
   source material.

### Required presentation

- First band: `原始来源` with creator, modality, captured time, and source.
- Second band: `为什么留给你` and `当时的情境`, using creator-authored text.
- Third band: presentation choice. Every derived item has a persistent
  `基于已审核素材整理` or `生成呈现` label and a source-count disclosure.
- Source disclosure lists approved source IDs/titles and owner-review state; it
  does not expose private URIs or device identifiers.
- Recipient response appears in a separate `你的回应` region and never under
  `Mei 的素材`.
- If a required source is missing or unauthorized, hide the derived body and
  show a typed unavailable state. Do not substitute plausible generated copy.

The current model can support an initial projection using `Memory.original`,
`relationshipId`, `recipientId`, `meaning`, `organized.sourceMemoryIds`, and
`reviewedByOwner`. It cannot truthfully display separate situation, capture
origin, consent, or derived-presentation identity until those fields are owned
by a follow-on domain/capture change. Do not smuggle that domain expansion into
OMI-RING-008's device UI scope.

## `我在` wording safety

`我在` may be a compact Loop identity cue only when an adjacent sentence makes
the subject and provenance unambiguous. It must not appear as an unqualified
first-person utterance from an absent person.

Safe patterns:

- `我在` / `Loop 在这里，等你决定是否记下这一刻。`
- `我在` / `一段 Mei 亲自留下并审核过的内容在这里。是否打开，由你决定。`
- `根据 Mei 已审核的 1 条真实记录整理。`
- `Mei 亲自留下了「五道家常菜」这段未来邀请。`
- `戒指记录到一次触碰。要进入吗？`

Unsafe patterns:

- `妈妈在这里陪你` or `Mei is here with you`.
- `她知道你今天很难过` or any sensor-derived emotional claim.
- `她现在想让你……` unless this is visibly an exact original invitation.
- A generated sentence in quotation marks or a chat bubble styled as Mei.
- `她回复了你`, `她会一直看着你`, `你该走出来了`, or cure/recovery copy.
- A notification such as `妈妈有话对你说` triggered only by telemetry.

The current recipient title `母亲想和你继续做五道菜` should become
`Mei 亲自留下了「五道家常菜」邀请` unless the current-will wording is shown
as a reviewed original quotation.

## Complete device-center state matrix

State is layered. Do not collapse environment, permission, discovery,
per-device connection, capability support, freshness, consent, and simulation
into one `connected` boolean.

### Environment, permission, and discovery

| State | Required message | Required actions/behavior |
| --- | --- | --- |
| Bootstrap/loading | `正在读取本机设备状态` | Stable-height placeholder, `aria-busy=true`; no scan action yet. |
| Unsupported platform | `此环境不能扫描蓝牙设备` | Offer `使用演示数据`; explain that browser/iOS Simulator is not physical validation. |
| Permission not requested | `需要蓝牙权限才能查找附近设备` | One explicit `继续并允许蓝牙` action; do not request on page load. |
| Permission denied | `蓝牙权限未开启` | `前往设置` and `使用演示数据`; do not loop the native prompt. |
| Permission restricted | `此设备限制了蓝牙权限` | Settings/help route; distinguish it from denial. |
| Bluetooth powered off | `蓝牙已关闭` | Platform-appropriate Settings action; retain known devices as disconnected. |
| Ready/idle | `可以开始查找附近设备` | `扫描设备`. |
| Scanning, no result yet | `正在查找附近设备` | `停止扫描`; polite announcement once, not per animation frame. |
| Scanning with results | `找到 N 台设备` | Results remain operable while scan can stop; deduplicate by opaque transport ID. |
| Empty result | `没有找到可用的 OMI 或戒指` | `重新扫描`, troubleshooting disclosure, `使用演示数据`; zero is not an error. |
| Scan failed | Typed, user-safe error such as `扫描没有完成` | Retry only when retryable; diagnostics contains redacted code. |
| App backgrounded | `扫描已暂停` | Stop scan/foreground subscriptions according to runtime policy; no background promise. |
| Returning foreground | `正在恢复设备状态` | Re-read power/permission and reconcile known sessions before enabling actions. |

Microphone, camera, and sharing are separate from Bluetooth. Their states are
`not_requested`, `preflight`, `native_prompt`, `granted`, `denied`, and
`restricted` (sharing is product consent rather than an OS permission). They
appear only after the corresponding explicit creator action, not during device
connection.

### Per-device connection and reconnect

| State | Required message | Required actions/behavior |
| --- | --- | --- |
| Known/disconnected | `未连接` | `连接`; show last known profile without claiming availability. |
| Connecting | `正在连接` | Disable duplicate connect; expose Cancel if runtime supports cancellation. |
| Discovering services/opening adapter | `正在确认设备能力` | Keep a stable row; do not show fake zero measurements. |
| Connected/full | `已连接` | Disconnect action, observed support tier, and fresh live values. |
| Connected/partial capability | `已连接 · 部分功能暂不可用` | Keep working capabilities active; name each real-device/vendor-profile requirement. |
| Expected disconnect | `已断开` | Return to known/disconnected without an alarm. |
| Unexpected disconnect | `连接中断` | Preserve last values with stale labels; show reconnect policy and Retry now/Stop. |
| Reconnect waiting | `将在 N 秒后重试` | Do not announce every second to a screen reader; allow Retry now/Stop. |
| Reconnecting | `正在重新连接` | Show attempt count only if the runtime supplies it; stale callbacks cannot win. |
| Reconnect exhausted | `暂时无法恢复连接` | `再次连接`, diagnostics, simulator option; no infinite retry loop. |
| Connection failed | Safe typed reason | Retry only when retryable; permission/power failures route to their dedicated state. |
| One device fails, one succeeds | Overall `1 / 2 台已连接` | Slots remain independent; never clear the successful session. |

### Capability, live-data, stale, partial, and simulated states

| State | Required rendering |
| --- | --- |
| Capability implemented and available | `可用`, with physical/simulated source and latest observed time. |
| Requires real device | `需要真机验证`; never render it as working because a fixture passed. |
| Requires vendor profile | `等待设备协议`; no guessed UUID, command, or zero value. |
| Temporarily unavailable | `当前连接不可用` plus the connection/permission cause; do not alter the underlying support tier. |
| No sample yet | `暂无数据`; never `0`, `0 bpm`, `0%`, or `正常`. |
| Fresh sample | Value + unit + observed time. Freshness comes from `observedAt` and a named policy threshold. |
| Delayed sample | `更新延迟` and observed time; retain the last value without treating it as current. |
| Stale sample | `数据已过期` and observed time; remove any live styling and offer retry/resubscribe where valid. |
| Parse failure with other capabilities alive | `部分数据无法读取`; preserve the last good value as stale and put the typed parser error in diagnostics. |
| Partial profile | Render known roles and an explicit list of unavailable roles. Do not hide the entire device. |
| Simulation off | No simulated values/events remain in the physical snapshot. |
| Simulation on | Persistent page banner, `模拟` beside every device/value/event, deterministic scenario selector, and no physical-validation language. |
| Switching simulation while physically connected | Confirm the switch or keep physical and simulation in visibly separate slots; never silently replace a real session. |

Suggested default freshness policy for UI tests: live audio/stream status becomes
delayed after 5 seconds without a frame; low-frequency status/telemetry becomes
delayed after 15 seconds and stale after 60 seconds. Production thresholds
should be runtime/profile configuration, not duplicated literals in components.

### Consent and event states

- `mark_received`: pending prompt only; microphone/camera/playback calls remain zero.
- `capture_preflight`: explains source and why permission is needed.
- `capture_active`: visible timer/source/Stop action and system capture indicator.
- `playback_ready`: no playback until explicit Play.
- `playback_active`: Pause/Stop and clear source label.
- `share_review`: exact recipient, assets, original/derived status, and explicit
  confirm/cancel.
- `event_duplicate`, `wrong_recipient`, `unbound_device`, and `expired_event`:
  reject without content disclosure; put only a safe reason in diagnostics.
- `simulated_event`: may exercise the same pending state but remains visibly
  simulated through the full handoff.

## Accessibility requirements

1. On hash navigation, update the document title and move focus to the new
   `h1` (temporarily `tabIndex=-1`). Preserve a predictable back action.
2. Set `aria-current="page"` on parent navigation for all descendants.
3. Role mode uses a labeled radio group; simulation uses a real checkbox switch;
   device options use buttons or radios, not clickable `div`s.
4. Every icon button has an accessible name and tooltip. Use familiar Lucide
   icons only if an icon dependency is added; primary commands should retain
   visible text at 320 px.
5. Minimum pointer target is 44 by 44 CSS pixels. The current `.button` minimum
   height is 42 px and `.text-button` has no target padding; both need a device
   center override or shared correction.
6. Add visible `:focus-visible` treatment for links, buttons, summary, radios,
   switches, and selects. Current global CSS only gives custom focus to text
   fields.
7. Announce permission, scan phase, connect/disconnect, and save outcomes through
   a concise polite status region; use `role=alert` for actionable failures.
   RSSI and streaming telemetry must not be live regions.
8. Link field errors with `aria-invalid` and `aria-describedby`; move focus to
   the error summary only after submit. Do not rely on a global error block.
9. Capability and freshness meaning uses text/icon in addition to color. The
   current coral `#d7674c` on paper `#f6f4ef` is approximately 3.22:1, so it
   fails WCAG AA for 12 px eyebrow/status text; darken it or use it decoratively.
10. Use semantic `ul`, `dl`, `time`, `meter`/text, and `details/summary` where
    applicable. A visual signal bar needs an exact textual equivalent.
11. Honor `prefers-reduced-motion`; no essential pulse/spinner animation. Keep
    layout dimensions stable while status icons or loading copy change.
12. Set the primary document language for the build and mark isolated English
    technical terms when needed. Units must remain readable at text zoom 200%.

## Responsive and safe-area requirements

- Test 320x568, 390x844, 768x1024, and 1440x900. At every width,
  `scrollWidth <= clientWidth` and no status/action overlaps another element.
- Device rows use `minmax(0, 1fr)` for the identity column; long device names,
  translated capability reasons, error messages, and diagnostic IDs use
  `overflow-wrap: anywhere`.
- At 320 px each device action moves to its own full-width row. Do not squeeze
  Connect/Disconnect beside a long name.
- Use fixed responsive type steps for the device-center heading (for example
  32 px mobile and 40 px desktop), not viewport-width font scaling. Compact
  panel headings remain 18-22 px.
- Apply safe-area padding with `max(base, env(safe-area-inset-*)))` to the app
  shell/navigation and any bottom action sheet. Use `100svh` only as a minimum;
  content must scroll and never sit behind the home indicator.
- Expanded device details are one column below 720 px. On desktop they may use
  two columns, but telemetry labels/units must have stable tracks and must not
  move controls when a value arrives.
- The pending event sheet has a maximum height with internal scrolling, a
  visible close button, focus trap, Escape support, focus return, and bottom
  safe-area padding.
- Top navigation cannot add a fourth cramped link at 320 px. Replace Hardware
  with Devices in the primary row and expose simulator diagnostics inside the
  device center.
- Test 200% text zoom and representative long labels such as a long OMI device
  name and `requires_vendor_profile` explanation.

## Suggested component and file boundaries

OMI-RING-008 should stay inside its conflict boundary and consume the external
device runtime. UI code must not import Capacitor BLE directly or parse packets.

| File | Responsibility |
| --- | --- |
| `src/features/devices/DeviceCenterPage.tsx` | Route-level composition, one `h1`, semantic section order, pending-sheet mount point. No transport logic. |
| `src/features/devices/useDeviceCenter.ts` | `useSyncExternalStore` binding to the OMI-RING-007 runtime and stable action callbacks. |
| `src/features/devices/deviceCenterSelectors.ts` | Pure projection of layered runtime state into permission/discovery/slot/freshness view models. Exhaustive switches. |
| `src/features/devices/deviceCenterCopy.ts` | Centralized Chinese/English safety copy, capability labels, typed errors, forbidden resurrection/emotion wording tests. |
| `src/features/devices/components/RoleModeControl.tsx` | Creator/recipient radio group and safe mode-change confirmation. |
| `src/features/devices/components/BluetoothGate.tsx` | Loading, platform, permission, powered-off, scan, error, and empty states. |
| `src/features/devices/components/DeviceList.tsx` | OMI/ring independent rows and accessible selection. |
| `src/features/devices/components/DeviceDetail.tsx` | Composes capability, live-data, and status regions without nested cards. |
| `src/features/devices/components/CapabilityList.tsx` | Supported/real-device/vendor-profile/temporary availability labels. |
| `src/features/devices/components/LiveDataList.tsx` | Value, unit, observed time, freshness, source, and weak-context notice. No inference. |
| `src/features/devices/components/ConsentSummary.tsx` | Bluetooth/capture/playback/share separation and explicit-action guarantees. |
| `src/features/devices/components/SimulationControl.tsx` | Switch, scenario picker, persistent simulated banner/labels. |
| `src/features/devices/components/DiagnosticsDisclosure.tsx` | Redacted, collapsible diagnostics and truthful validation tier. |
| `src/features/devices/components/PendingHardwarePrompt.tsx` | Creator/recipient pending handoff; navigation only after explicit action. |
| `src/features/devices/deviceCenter.css` | Feature layout, stable row dimensions, safe areas, focus, reduced motion, 320 px rules. |
| `src/features/devices/*.test.tsx` | Unit/component/integration tests listed below. |
| `src/app/App.tsx` | Register `/devices`, make parent nav active/accessible, replace primary Hardware label. |
| `src/styles/global.css` | Only shared target/focus/token/safe-area changes that genuinely apply across existing pages. |

Do not place BLE UUIDs, ring opcodes, packet bytes, native permission calls, or
freshness business rules inside React components. Do not edit existing capture
or recipient policy behavior under OMI-RING-008. Pass a pending handoff through
the runtime/store; a separately owned capture/recipient integration must consume
it.

Recommended test boundaries:

- `deviceCenterSelectors.test.ts`: exhaustive pure state and clock-based
  freshness tests.
- `BluetoothGate.test.tsx`: permission/power/scan/empty/error semantics.
- `DeviceDetail.test.tsx`: partial profiles, no-zero fallback, provenance, weak
  context, and simulation labels.
- `PendingHardwarePrompt.test.tsx`: touch/mark consent invariants.
- `DeviceCenterPage.test.tsx`: route composition, actions, independent OMI/ring
  sessions, diagnostics redaction, focus/live regions.
- `DeviceCenter.integration.test.tsx`: simulator-to-runtime-to-UI events and
  reconnect races.
- `src/app/App.test.tsx`: `/devices`, parent active navigation, direct URL, and
  unknown-route behavior.

## Exact test cases

### Device center and runtime projection

1. Bootstrapping renders one heading, stable busy region, and no enabled scan.
2. Unsupported web/iOS Simulator offers simulation and does not claim a BLE
   permission failure.
3. Permission is not requested on render; pressing Allow performs one request.
4. Denied and restricted permissions show distinct copy and never start scan.
5. Powered-off state retains known devices as disconnected and offers Settings.
6. Scan renders initial/no-results/results/stopped/failed states; late results
   after stop are ignored and duplicate devices are not repeated.
7. Connecting disables duplicate Connect; cancellation and a late success cannot
   produce a connected row.
8. OMI and ring connect independently; one failure leaves the other connected.
9. Unexpected disconnect retains last values as stale and exposes reconnect;
   stale reconnect callbacks cannot overwrite a newer session.
10. Reconnect waiting/reconnecting/exhausted render correct actions and do not
    retry forever.
11. A connected partial profile shows implemented roles plus each
    `requires_real_device`/`requires_vendor_profile` reason.
12. Missing telemetry renders `暂无数据`, never a numeric zero or health status.
13. A deterministic clock moves a fresh sample to delayed then stale without
    changing the row's geometry.
14. A parser failure preserves the last good value as stale and exposes only a
    redacted diagnostic.
15. Simulation switch labels page, device, value, and event; leaving simulation
    clears simulated values and cannot claim physical validation.
16. Diagnostics omit raw bytes/audio/physiology, recipient identity, and full
    device ID; they include operation, typed code, time, retryability, and tier.

### Consent and narrative

17. A physical or simulated `mark_moment` renders only the creator pending
    prompt. Assert microphone, camera, playback, capture, and share service calls
    are all zero.
18. Entering the creator guide still does not request microphone; choosing audio
    and pressing the explicit Continue/Start action is the first allowed request.
19. Recipient touch renders only pending entry. Agent assembly and playback calls
    are zero until identity confirmation and explicit open.
20. A simulated handoff retains its simulated label after navigation.
21. Wrong recipient, unbound, duplicate, and expired events disclose no memory.
22. Every visible telemetry string and snapshot is free of grief/emotion/health
    inference and cannot trigger playback.
23. `我在` snapshots always include the adjacent Loop/provenance qualifier.
24. Derived text shows source count and owner-review state and is never styled as
    a live quotation from Mei.
25. Recipient response save produces only a saved status, not an Agent/Mei reply.
26. Close persists across unmount/reload; postpone and skip remain distinct.

### Accessibility and responsive behavior

27. Keyboard-only flow reaches role mode, scan, device rows, disclosures,
    connect/disconnect, simulator, diagnostics, and pending-sheet actions in
    logical order.
28. Hash navigation updates title, focuses `h1`, and gives the Devices parent
    link `aria-current=page`.
29. Status changes announce once; streaming RSSI/telemetry does not flood the
    live region.
30. Automated accessibility scan has no critical/serious findings; all controls
    have names and errors are associated with their fields.
31. At 320x568 with long labels and at 200% text zoom there is no horizontal
    scroll, overlap, clipping, or unreachable action.
32. Desktop/mobile Playwright screenshots cover permission denied, scanning
    empty, connected partial/stale, simulated, and both pending-event sheets.
33. Reduced-motion mode removes nonessential animation while all state remains
    understandable.
34. iPhone safe-area emulation keeps navigation and sheet actions clear of the
    notch/home indicator.

### Legacy regression

35. Existing capture tests still prove AI organization defaults off and original
    only cannot enable organization.
36. Existing recipient tests still prove no autoplay and recipient-controlled
    plan/response flow.
37. Direct recipient/capture deep-link guard tests are added before claiming the
    recording-derived flow is complete.
38. Required checks remain `npm run typecheck`, `npm test`, `npm run build`,
    desktop/mobile screenshot review, Capacitor sync/build where available, and
    explicitly separate physical-iPhone validation.

## Recording requirement ownership checklist

Legend: **Build** is primary implementation responsibility; **Native** is iOS
configuration/lifecycle responsibility; **Prove** is integration/audit evidence.

| Recording-derived requirement | OMI-RING-008 | OMI-RING-009 | OMI-RING-010 / evidence |
| --- | --- | --- | --- |
| Explicit creator-capture and recipient-companionship stages | **Build** role mode and distinct pending prompts. | Preserve pending state across foreground lifecycle only where implemented. | **Prove** both end-to-end paths and no cross-role event leakage. |
| Keep device identity, audio source, and consent separate | **Build** separate device/source/consent regions and view-model fields. | **Native** separate Bluetooth and microphone usage/permission flows. | **Prove** source/consent lineage and document support tier. |
| Mark/touch never silently starts mic/camera/playback | **Build** pending-only handoff. | **Native** request mic only after explicit capture action; no fabricated background mode. | **Prove** zero-call spies for mark/touch and physical validation checklist. |
| Low-pressure bounded creator prompts | Device center owns only `进入记录引导`; it must not imitate chat. | Native capture permission preflight supports the explicit source step. | Audit existing CaptureFlow gap. Full bounded guidance needs an owned capture change; tests alone cannot close it. |
| Ask situation, desired future interaction, relationship, plan, and why | Handoff preserves event/source context. | No native ownership beyond source metadata. | Existing flow has relationship/why/plan but lacks a first-class situation prompt; record as blocker or implement under an approved capture scope. |
| Memory Seed is real source + relationship + situation + creator intent | Show only observed handoff provenance; do not fabricate missing seed fields. | Record actual audio source/consent where implemented. | **Prove** immutable source lineage, review, and missing-field behavior; domain expansion needs explicit ownership. |
| Generated image/video/text is visibly derived | Device center simulator/diagnostics labels never imply original content. | No native-generated-content claim. | **Prove** persistent generated label, source list, owner review, and no source substitution. |
| Recipient experience is optional and exploratory | **Build** pending entry with Later/Ignore; no content before gate. | Foreground lifecycle does not autoplay on resume/reconnect. | **Prove** accept/postpone/skip/persistent close and direct-deep-link guards. |
| Preserve original recording and provenance | Handoff carries source/event reference only. | Keep capture source truthful; do not log raw audio. | **Prove** original playback is explicit and derived presentation points to approved source IDs. |
| No cure, move-on, resurrection, or new-will claim | **Build** centralized safe copy and weak-context notice. | Usage descriptions stay functional and neutral. | **Prove** snapshots/forbidden-phrase audit, including `我在` qualifier. |
| Weather/photo/plan/daily action may be context | Render only sourced facts, observed time, and user controls. | Native has no right to infer context from permissions. | **Prove** source labels and absence behavior. Current UI has plan only; other contexts remain unimplemented. |
| Wearable data is weak context, never a grief detector | **Build** per-value weak-context label and no trigger wiring. | Do not add HealthKit/background claims without an adapter and validation. | **Prove** telemetry cannot invoke Agent/playback and docs state limits. |
| Explicit consent before capture, playback, or sharing | **Build** consent summary and pending-only event flow; preserve explicit Play. | **Native** human-readable, action-bound usage descriptions. | **Prove** service-call ordering and share review. Current app has explicit playback but no implemented sharing flow. |
| Prefer foreground BLE and visible diagnostics | **Build** foreground/pause/resume states and redacted disclosure. | **Native** foreground BLE configuration and truthful simulator/physical limitations. | **Prove** sync/build and label native vs physical verification separately. |
| Recipient response stays separate from creator-authorized memory | Device center does not merge stores. | Native logs contain neither response nor raw content. | **Prove** ownership/exclusion and no fake immediate reply. |
| Optional dock/base remains a separate device/audio role | Use category/profile-driven rows; do not hardcode ring identity as audio source. | Native configuration documents actual implemented source only. | **Prove** support matrix; do not claim dock support until an adapter/profile exists. |

## Acceptance gate for OMI-RING-008/009/010

OMI-RING-008 should not be marked complete until `/devices`, the layered state
matrix, independent OMI/ring slots, consent-safe pending handoffs, simulator
labels, accessible interaction, and mobile screenshots exist. OMI-RING-009 can
validate the native build and permission wording but cannot validate BLE or OMI
audio on a simulator. OMI-RING-010 must report capability evidence separately as
implemented, simulator-verified, iPhone-build-verified, physical-device-verified,
or vendor-profile-required.

Five current blockers are especially important:

1. `/devices` and all required permission/discovery/connect/reconnect/data states
   are absent.
2. Hardware handoffs are incomplete: no creator mark flow, and recipient touch
   loses event/source/simulation provenance.
3. Capture is not a bounded guided conversation and cannot yet represent a full
   Memory Seed situation/source/consent contract.
4. Recipient deep links, persistent close, load/play/save errors, and full source
   provenance are not safe or complete.
5. 320 px/safe-area/keyboard/screen-reader/reduced-motion state coverage and
   screenshot tests do not exist, and the current small coral text contrast is
   insufficient.
