# TASK-016 - Agent game first playable design

## Role

One OpenCode window acts as the product and technical designer for Loop's first
playable Agent-game vertical slice. This is a design and codebase-research task,
not an implementation task.

## Objective

Turn the confirmed Agent-game direction into one implementation-ready vertical
slice:

```text
choose intensity -> inspect journey proposal -> accept or skip
-> complete one simulated action -> open sourced memory
-> add present-life response -> create postcard -> light one map node
```

The design must preserve Loop's Context, relationship permission, provenance,
recipient control, and offline Demo boundaries.

## Required Reading

Read these sources in order before proposing a design:

1. `00_PROJECT_CONTEXT.md`
2. `04_SOFTWARE_UPDATE_2026-08-01.md`
3. `.loop/STATUS.md`
4. `.loop/DECISIONS.md`
5. `.loop/RISKS.md`
6. `.loop/INTEGRATION_QUEUE.md`
7. `.loop/reports/concept-review-2026-08-02.md`
8. `.loop/checklists/quality-redlines.md`
9. Existing domain, Agent, recipient, artifact, app, and data code relevant to
   the current end-to-end Demo

If these sources conflict, do not guess. Record the conflict and create a
Decision Request in the report.

## Ownership And Allowed Files

Before research, create:

`D:\Codex-Workspace\Loop\.loop\claims\TASK-016--<session-id>.md`

The task may write only:

- `.loop/claims/TASK-016--<session-id>.md`
- `.loop/reports/TASK-016-agent-game-first-playable-design.md`

Do not change `src/`, tests, package files, product context, decisions, risks,
status, queue, or existing reports. The temporary overview window will review
the proposal and perform coordination updates.

## Design Constraints

- Echo Map is the primary game surface.
- Traveling Messenger is a neutral Agent representation, not the deceased.
- The Agent is a journey director and source-backed memory curator.
- The first slice uses the rainy-day Mei / Lin mother-daughter Demo data.
- Quiet / glimmer / deep intensity is selected by the recipient; automation may
  reduce intensity but never increase it.
- The player can inspect, accept, skip, stop, reject, and permanently hide.
- A recorder-authored invitation must be distinguishable from an Agent-suggested
  neutral action.
- Original content, derived content, Agent output, and recipient-authored content
  remain separate and traceable.
- The session ends with one postcard InteractionArtifact and one lit map node.
- The design must work deterministically offline without GPS, HRV, a real route,
  an LLM, account persistence, network access, or real hardware.
- Do not add grief scores, recovery percentages, streaks, decay, plant death,
  reward economies, generated wishes, random pushes, or autonomous deceased NPCs.

## Required Deliverable

Write `.loop/reports/TASK-016-agent-game-first-playable-design.md` containing:

1. **Design judgment** - one recommended form and rejected alternatives.
2. **Player promise** - one sentence explaining what the player does and gets.
3. **Two-minute playable flow** - exact screens, actions, transitions, and exit
   paths from entry through postcard and map-node completion.
4. **State machine** - named states, events, guards, failure/recovery paths, and
   terminal states.
5. **Agent contract** - TypeScript-shaped input and output schemas for journey
   proposal, source selection, intensity, rationale, fallback, provenance, and
   user controls.
6. **Data ownership** - where recorder Context, derived content, Agent output,
   JourneySession, recipient response, postcard, and map-node state belong.
7. **Reuse map** - existing files, domain types, services, and components that
   can be reused unchanged, extended, or must remain isolated.
8. **UI specification** - information architecture and component-level desktop
   and mobile behavior; no marketing page and no decorative card nesting.
9. **Acceptance criteria** - observable Given / When / Then checks suitable for
   unit, integration, and manual smoke verification.
10. **Implementation decomposition** - the smallest ordered follow-up tasks with
    file ownership and dependency boundaries, without writing implementation.
11. **Risks and Decision Requests** - unresolved product, safety, privacy, or
    architecture choices requiring coordinator approval.

## Acceptance Criteria

- The proposal is implementable without inventing missing product decisions.
- Every Agent-generated or composed result identifies its source Context IDs.
- Recipient-authored content cannot become recorder or deceased-person Context.
- Skip and stop paths are first-class and do not produce false completion.
- Offline fallback is the primary Demo path, not an error-only afterthought.
- The design clearly separates what reuses the current P0 from what is new.
- No source file outside the allowed documentation paths is changed.
- `git diff --check` passes.

## Handoff

End the report with:

- files read;
- files written;
- unresolved decisions;
- recommended first implementation task;
- verification performed;
- explicit statement that no business code was changed.
