# Integration Queue

## Queue status

The previous offline MVP is already integrated. The queue below is the V2
migration graph. `TASK-009` is the next node; no feature window should start
before its contract is reviewed.

All coordination artifacts are read from and written to
`D:\Codex-Workspace\Loop\.loop`, even when an OpenCode window uses a separate
Git worktree for source changes.

## Baseline verification

- Tests: passed, 11 files / 45 tests.
- Typecheck: passed.
- Build: passed.
- Current known interface requests remain in:
  `.loop/requests/agent-interface.md`
  `.loop/requests/hardware-interface.md`

## Strict execution order

This is a gated sequence. Do not interpret it as “start everything now”.

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

## Join criteria

The Gate 2 parallel wave may join only when each task has:

- one claim file;
- one report file;
- no writes outside its allowed scope;
- passing task tests, typecheck, and build;
- explicit Interface Requests for unresolved contracts.

N7 is the only node allowed to claim end-to-end completion.

## Current integration blockers

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
