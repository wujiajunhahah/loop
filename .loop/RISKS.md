# Integration Risks

## INT-RISK-001 In-memory persistence

Reloading the page resets the demo state. This is intentional for the offline
MVP and must be replaced by durable storage before production use.

## INT-RISK-002 Placeholder media

The demo audio URI is a playback contract placeholder. No real recording or
hardware SDK is required for the presentation, but a bundled media asset is
needed for a production-quality media demo.

## INT-RISK-003 Mock identity proof

`LOOP-DEMO` is only a local simulator proof. It demonstrates the verification
boundary and must not be treated as authentication outside the demo.

## V2 Migration Risks

### V2-RISK-001 Contract drift

The implementation still exposes the older `Memory` and boolean policy shape.
Mitigation: block dependent work on `TASK-009` and require a report with
domain invariants and compatibility decisions.

### V2-RISK-002 UI-owned persistence

`CaptureFlow` directly mutates demo policies, plans, and organized content.
Mitigation: move these writes behind the approved capture / policy / artifact
ports in `TASK-010`.

### V2-RISK-003 Over-conservative Agent

The current Agent disables all generated text, while V2 permits bounded,
source-backed generation. Mitigation: implement explicit generation modes and
provenance in `TASK-011`; do not relax the boundary by enabling free chat.

### V2-RISK-004 Artifact missing from the current loop

No `InteractionArtifact` exists in `src/`, so the current Demo ends at a plan
or response rather than the required collectible result. Mitigation:
`TASK-012` before recipient integration.

### V2-RISK-005 Duplicate hardware ports

The old foundation bridge under `src/adapters/contracts` and the feature bridge
under `src/adapters/hardware` describe different events. Mitigation:
`TASK-014` documents and tests one business-facing event boundary before final
integration.

### V2-RISK-006 Context files are not committed

The latest product context is currently an uncommitted working-tree update.
OpenCode must not overwrite or revert those files while implementing tasks.

### V2-RISK-007 Game concept scope regression

The game exploration can pull the stable P0 Demo toward routes, progression,
tasks, sensors, and multiplayer permissions before the core relationship loop is
validated. Mitigation: preserve the existing P0 and require one explicit P1
hypothesis per future task.

### V2-RISK-008 Bereavement-state inference

HRV, heart rate, sleep, movement, and other body signals cannot establish grief,
intent, or psychological condition. Mitigation: direct user choice has priority;
automation may only reduce content intensity, and physiological inference remains
P2 pending safety evidence.

### V2-RISK-009 Location and action coercion

Routes, GPS history, unfinished wishes, and reward systems can expose sensitive
locations or pressure a recipient to act. Mitigation: no continuous tracking,
no default push, no generated wishes, and every action must support skip, reject,
delete, and permanent disable without penalty.
