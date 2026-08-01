# TASK-014 Hardware-Neutral Trigger Report

## Outcome

Implemented the hardware-neutral trigger bridge and simulator cleanup on branch
`feat/hardware-neutral-trigger`. The feature now publishes the TASK-009 domain
`EntryEvent` shape to business consumers; device identity and verification state
remain inside adapter lifecycle records and do not become recipient-domain fields.
No real SDK, network service, API key, or physical hardware is required.

## Event And Simulator Behavior

- Touch, tap, gesture, NFC, BLE, and software input use one trigger API.
- Touch, tap, and gesture normalize to the domain `device` source; NFC, BLE, and
  software retain their domain sources.
- Unavailable physical input becomes a traceable software fallback when allowed,
  retaining `originalSource` and `fallback` in payload data.
- Disabling fallback produces the explicit `unavailable_hardware` rejection.
- Only events that pass binding, entrustment, recipient identity, availability,
  and duplicate checks are published as `EntryEvent` and consumed.
- Lifecycle observers retain produced, verified, rejected, and consumed stages
  without adding verification fields to the business event.

## Trigger Policy

- Every controller call defaults to `triggerReason: user_opened` and the TASK-009
  `pull_only` policy.
- Results expose `triggerReason`, `triggerMode`, and `policyOutcome` explicitly.
- Reasons outside the policy allowlist are rejected before an adapter event is
  produced or a recipient is notified.
- `proactive_allowed` is rejected even when opted in; the hardware entry point
  cannot initiate strong proactive delivery. No random trigger exists.

## Foundation And Feature Bridge

The old foundation contract in `src/adapters/contracts/services.ts` publishes the
deprecated domain `HardwareEvent` (`id`, `bridgeId`, hardware event `type`, optional
actor/context) and exposes only simulation, light, and vibration. The TASK-014
feature bridge in `src/adapters/hardware` accepts generic trigger sources, enforces
verified binding and entrustment, handles identity mismatch, deduplication and
availability, and publishes the TASK-009 `EntryEvent` boundary.

The old foundation bridge was not edited because it is outside TASK-014's allowed
files. The existing recipient feature also still inspects the former feature
`eventType`; `simulatorStore.ts` contains a temporary type-only legacy view so the
shared build remains valid while all actual bridge publications stay `EntryEvent`.

Proposed consolidation path: in TASK-015, migrate the data service and recipient
subscriber to `EntryEventPort`/`EntryEvent`, make the feature bridge the sole
verified producer behind that port, then remove the deprecated foundation
`HardwareBridge`, `HardwareEvent`, duplicate mock, and temporary simulator typing
view in one integration change.

## Changed Files

- `src/adapters/hardware/**`
- `src/features/hardware/**`
- `.loop/claims/TASK-014-opencode-20260802-task014.md`
- `.loop/reports/TASK-014-hardware-neutral-trigger.md`

No domain, app route, recipient, or capture file was changed by TASK-014.

## Verification

- `npm test -- src/features/hardware src/adapters/hardware --run`: passed, 4 files / 19 tests.
- `npm run typecheck`: passed.
- `npm test -- --run`: passed, 14 files / 74 tests.
- `npm run build`: passed, TypeScript and Vite production build completed.
- `git diff --check -- src/features/hardware src/adapters/hardware`: passed.

Coverage includes all six input sources entering one recipient boundary, software
fallback, disabled fallback, default policy rejection, proactive-mode rejection,
binding proof, entrustment, recipient mismatch, duplicate events, lifecycle stages,
simulator controls, and browser recipient notification.
