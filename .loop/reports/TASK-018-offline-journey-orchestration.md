# TASK-018 - Offline Journey Orchestration Report

## Result

Implemented and accepted deterministic offline orchestration for the first Echo
Map journey. `OfflineDemoService` now exposes a UI-neutral journey data port and
injects frozen rainy-day source data, the existing recipient-scoped Agent runtime,
the existing artifact service, deterministic time, and reset behavior.

## Files Written

- `src/features/journey/services/types.ts`
- `src/features/journey/services/OfflineJourneyOrchestrator.ts`
- `src/features/journey/services/OfflineJourneyOrchestrator.test.ts`
- `src/features/journey/services/index.ts`
- `src/data/offlineDemo.ts`
- `src/data/offlineDemo.journey.test.ts`
- TASK-018 claim and this report

## Port Methods

- snapshot and reset through the shared Demo boundary;
- start session, select intensity, inspect proposal, and accept action;
- explicit action completion and source-backed memory loading;
- recipient text or explicit omission;
- postcard create/retry and authoritative-store integrity check;
- node light/retry with synchronous two-record commit after async authority checks;
- skip, stop, reject, hide, and close exits.

## Storage Ownership

The orchestrator owns in-memory maps for proposals, frozen source snapshots,
sessions, presentations, recipient responses, artifacts, and one Echo Map node.
`OfflineDemoService.reset()` recreates the orchestrator and artifact service,
restores the fixed rainy-day source, resets IDs, and exposes one available node.

## Recovery And Integrity

- Agent and postcard continuations re-read current session state after awaits.
- Reset increments an epoch; stale Agent, artifact, or node continuations cannot
  repopulate cleared state.
- The source snapshot is frozen at start and the entry fixture remains rainy-day
  even when recorder capture changes the current recipient Context.
- Artifact retry compares the authoritative store with the validated cached
  artifact; mismatches are typed integrity errors.
- Node lighting validates the authoritative artifact before a synchronous domain
  completion and two-map commit.
- A lit, hidden, or rejected one-node map cannot start another journey before
  reset.
- Pull-only `user_opened` trigger policy is checked before proposal creation.
- All exits preserve TASK-017 terminal-state and false-completion invariants.

## Independent Review

Three review rounds identified and drove fixes for stale async overwrites, second
starts after completion, mutable sources, local-only artifact retry, reset during
artifact creation, authoritative node integrity, typed recovery, and missing
trigger-policy checks. Final review found no remaining high or medium defect.

## Verification

- Focused: 2 files / 20 tests passed.
- Full suite: 18 files / 183 tests passed.
- Typecheck passed.
- Production build passed.
- `git diff --check` passed with existing line-ending warnings only.

## Limitations

- No Echo Map UI, route, shared style, browser persistence, GPS, sensor, LLM,
  hardware, or recorder-invitation fixture was added.
- The current in-memory hide/reject/completion lifecycle lasts until Demo reset.
- One fixed map node and one active journey are intentionally supported.

## Unresolved Decisions

None for the offline first slice.

No recipient UI, app routing, shared style, persistence, or hardware code was
changed by TASK-018.
