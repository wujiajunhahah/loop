# Integration Queue

## Queue status

The offline MVP and V2 migration through `TASK-015` are integrated. TASK-016 is
accepted and Gate 5 has passed. The migration graph below remains as an audit
record. TASK-020 is accepted and Gate 9 has passed. The first Echo Map playable
is integrated; no implementation node is currently active.

All coordination artifacts are read from and written to
`D:\Codex-Workspace\Loop\.loop`, even when an OpenCode window uses a separate
Git worktree for source changes.

## Baseline verification

- Historical baseline: 15 files / 85 tests passed before the Echo Map slice.
- Typecheck: passed.
- Build: passed.
- Current known interface requests remain in:
  `.loop/requests/agent-interface.md`
  `.loop/requests/hardware-interface.md`

## Strict execution order

Gates 0 through 9 are complete historical records. Do not restart them. New work
requires a separately reviewed evidence-backed task.

### Gate 0 — preparation

Codex has prepared the task files and baseline. No OpenCode implementation
window is active yet.

### Gate 1 — TASK-009 only

Start exactly one window for `TASK-009`.

The gate passes only when all conditions are true:

- the task has a claim file;
- the allowed files were the only product files changed;
- the task commit exists;
- the task report exists;
- domain tests pass;
- `npm run typecheck` passes;
- `npm test -- --run` passes;
- `npm run build` passes;
- Codex reviews the public contract and marks the task accepted.

Until this gate passes, do not start TASK-010, TASK-011, TASK-012, TASK-013,
TASK-014, or TASK-015.

### Gate 2 — four parallel windows

After Gate 1 passes, start exactly four windows at the same time:

- `TASK-010` Guided Context capture;
- `TASK-011` Agent runtime;
- `TASK-012` InteractionArtifact;
- `TASK-014` hardware-neutral trigger.

Each window owns a different directory. They may finish in any order, but Gate
2 does not pass until all four have their claims, commits, reports, task tests,
typecheck, full test suite, and build results.

### Gate 3 — TASK-013 only

After all four Gate 2 tasks pass, start one window for `TASK-013` Recipient
experience V2. Do not start it early.

Gate 3 requires its claim, commit, report, recipient tests, typecheck, full test
suite, and build.

### Gate 4 — TASK-015 only

After Gate 3 passes, start one window for `TASK-015` Demo integration. This is
the only window allowed to edit integration-owned files and claim end-to-end
completion.

Gate 4 requires the full test suite, typecheck, production build, manual offline
Demo path, and final integration report.

### Gate 5 — TASK-016 design only

Start exactly one OpenCode window for `TASK-016`. It may inspect the codebase but
may write only its claim and design report. It must not modify business code or
open parallel implementation tasks.

Gate 5 passes only when the temporary overview window reviews the player flow,
state machine, Agent contract, data ownership, reuse map, UI specification,
acceptance criteria, implementation decomposition, and unresolved decisions.
Implementation tasks may be created only after that review.

Gate 5 passed on 2026-08-02. The accepted result is
`.loop/reports/TASK-016-agent-game-first-playable-design.md`; DR-016-01 through
DR-016-03 are recorded in V2-008.

### Gate 6 — TASK-017 journey domain only

Start exactly one OpenCode window for `TASK-017`. It may implement and test the
pure journey contracts and transition rules under its owned journey-domain files.
It must not change orchestration, `OfflineDemoService`, recipient UI, app routing,
shared styles, hardware, persistence, package files, or existing domain contracts.

Gate 6 passes only with its claim, report, focused tests, full test suite,
typecheck, production build, `git diff --check`, and coordinator review. No
journey orchestration or UI task may start before Gate 6 passes.

Gate 6 passed on 2026-08-02. TASK-017 verification passed with 78 focused tests,
163 full-suite tests, typecheck, production build, and `git diff --check`.

### Gate 7 — TASK-018 offline orchestration only

Start exactly one OpenCode window for `TASK-018`. It may add journey services,
journey-service tests, and the explicitly owned `OfflineDemoService` integration.
It must not modify recipient UI, app routing, shared styles, hardware,
persistence, package files, or existing public domain contracts.

Gate 7 passes only with deterministic proposal/session/recovery tests, Agent and
artifact integration tests, relationship-isolation tests, focused and full test
suites, typecheck, build, `git diff --check`, report, and coordinator review.
No Echo Map UI task may start before Gate 7 passes.

Gate 7 passed on 2026-08-02. TASK-018 verification passed with 20 focused tests,
183 full-suite tests, typecheck, build, and `git diff --check`.

### Gate 8 — TASK-019 Echo Map UI

Start exactly one OpenCode window for `TASK-019`. It may add journey UI and local
styles/tests plus the narrow `RecipientPage` selection seam. It must use the
accepted `EchoMapJourneyData` port and must not change journey domain/services,
capture, Agent, artifact, hardware, package files, or broad app integration.

Gate 8 passes with screen/exit/retry/accessibility tests, responsive browser smoke,
full verification, `git diff --check`, report, and coordinator review.

Gate 8 passed on 2026-08-02. TASK-019 verification passed with 10 focused tests,
195 full-suite tests, typecheck, build, `git diff --check`, and responsive smoke.

### Gate 9 — TASK-020 final Echo Map integration

Start exactly one OpenCode window for `TASK-020`. It may add a discoverable Echo
Map entry to the existing recipient confirmation flow, App-level integration
tests, README Demo instructions, final browser evidence, and coordination updates.
It must not add persistence, sensors, GPS, hardware requirements, new game nodes,
or change accepted journey safety contracts.

Gate 9 passes with the full quiet/glimmer path, provenance, recipient attribution,
all critical exits/retries, desktop/mobile smoke, full verification,
`git diff --check`, report, and final coordinator review.

Gate 9 passed on 2026-08-02. TASK-020 verification passed with 11 integration
tests, 198 full-suite tests at that historical checkpoint, typecheck, build, `git diff --check`, identity-entry
smoke, and Echo Map responsive smoke.

## Workflow graph node contracts

| Node | Owner | Inputs | Writes | Output / acceptance | Failure route |
|---|---|---|---|---|---|
| N0 Baseline | Codex coordinator | product docs, Git state, current tests | `.loop/STATUS.md`, queue, tasks | baseline and priorities recorded | reread source of truth |
| N1 Domain contract | OpenCode / `TASK-009` | V2 product docs, current domain and interface requests | `src/domain/**`, `src/adapters/contracts/**`, allowed fixture updates | typecheck, domain tests, full tests, build, report | return to TASK-009; pause on product ambiguity |
| N2 Capture | OpenCode / `TASK-010` | accepted N1 contract | `src/features/capture/**` and local tests | capture/editor tests, typecheck, build | TASK-010 Interface Request |
| N3 Agent | OpenCode / `TASK-011` | accepted N1 contract | `src/features/agent/**`, `src/adapters/agent/**` | provenance, policy, isolation tests, typecheck, build | TASK-011 or Decision Request |
| N4 Artifact | OpenCode / `TASK-012` | accepted N1 contract | `src/features/artifact/**`, artifact adapter/tests | source-backed artifact tests, typecheck, build | TASK-012 |
| N5 Hardware | OpenCode / `TASK-014` | accepted N1 contract | `src/features/hardware/**`, `src/adapters/hardware/**` | generic event/fallback tests, typecheck, build | TASK-014 |
| N6 Recipient | OpenCode / `TASK-013` | N1, N3, N4 reports | `src/features/recipient/**`, local tests/styles | active entry, provenance, artifact tests, typecheck, build | TASK-013 or dependency node |
| N7 Integration | OpenCode / `TASK-015` | all upstream reports and accepted decisions | `src/app/**`, `src/data/**`, `src/styles/**`, README, integration evidence | full tests, typecheck, build, manual Demo smoke path | route defect to owner; cross-cutting defect stays in N7 |
| N8 Game design | OpenCode / `TASK-016` | accepted P0, V2-007, concept review, current code | TASK-016 claim and report only | implementation-ready first playable design | Decision Request or revise TASK-016 report |
| N9 Journey domain | OpenCode / `TASK-017` | accepted TASK-016 and V2-008 | `src/features/journey/domain/**`, local tests, TASK-017 claim/report | pure contracts, validation, transitions, terminal/idempotency tests | revise TASK-017; Decision Request for contract conflict |
| N10 Journey orchestration | OpenCode / `TASK-018` | accepted TASK-017, current Agent/artifact services, OfflineDemoService | `src/features/journey/services/**`, owned OfflineDemoService changes/tests, TASK-018 claim/report | deterministic full journey port with recovery and isolation | revise TASK-018; Decision Request for contract conflict |
| N11 Echo Map UI | OpenCode / `TASK-019` | accepted TASK-018 data port and TASK-016 UI spec | `src/features/journey/ui/**`, local tests/styles, narrow RecipientPage seam, TASK-019 claim/report | complete responsive journey screens and exits | revise TASK-019; integration deferred |
| N12 Echo Map integration | OpenCode / `TASK-020` | accepted TASK-019 and current W·HERE app shell | recipient entry seam, app integration tests, README, final evidence | discoverable complete Demo and reconciled status | route defect to owner; no new scope |

## Join criteria

The Gate 2 parallel wave may join only when each task has:

- one claim file;
- one report file;
- no writes outside its allowed scope;
- passing task tests, typecheck, and build;
- explicit Interface Requests for unresolved contracts.

N7 is the only node allowed to claim end-to-end completion.

## Historical integration findings

The findings below triggered `TASK-009` through `TASK-015` and are retained as
audit context. Their current disposition is recorded in the task reports and
`.loop/STATUS.md`; they are not current blockers for `TASK-016`.

- The current capture flow writes a `Memory` first, then directly mutates
  `demoPolicies`, `demoPlans`, and the returned memory in
  `src/features/capture/CaptureFlow.tsx`.
- The current agent policy hard-codes `allowNewMemoryGeneration: false`; V2
  needs bounded, source-backed generation rather than free persona simulation.
- No `InteractionArtifact` implementation exists in `src/`.
- Two hardware contracts exist: the old foundation contract under
  `src/adapters/contracts` and the integrated feature bridge under
  `src/adapters/hardware`.
- `src/app/pages/HomePage.tsx` and `src/features/recipient/RecipientExperience.tsx`
  still describe the ring as the primary entry, although V2 makes hardware
  post-MVP and interchangeable.
- `.loop/STATUS.md` and this queue were missing before this audit.

## Current implementation status

TASK-016 through TASK-020 are accepted. The first Echo Map vertical slice is
complete. There is no open implementation gate.
