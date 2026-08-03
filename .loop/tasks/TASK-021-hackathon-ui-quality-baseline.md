# TASK-021 - Hackathon UI Quality Baseline

## Objective

Produce a source-backed UI quality baseline for the accepted W·HERE Demo, rank the smallest competition-relevant improvements, and propose one bounded follow-up task without modifying product source.

## Allowed Files

- `.loop/claims/TASK-021--<session-id>.md`
- `.loop/reports/TASK-021-hackathon-ui-quality-baseline.md`
- `.loop/autonomous/runs/TASK-021-<session-id>.md`

## Requirements

- Review the current home, recipient entry, Echo Map and postcard path against the product constraints and `docs/AI_SKILLS.md`.
- Run `npx impeccable detect --json src/` and record reproducible findings rather than copying every detector opinion.
- Apply OilOil review, Hallmark audit and Impeccable critique principles as independent read-only lenses.
- Rank findings as P0/P1/P2 by impact on a two-minute judge Demo.
- Reject findings that conflict with existing product behavior, accessibility, source transparency, relationship scope, `pull_only`, offline behavior or hardware fallback.
- Recommend exactly one follow-up implementation task with proposed allowed files, acceptance criteria and smoke path.
- Do not edit `src/`, product documentation, canonical status, decisions, risks or integration queue.

## Acceptance Criteria

- Every retained finding cites a route and source file or deterministic detector rule.
- The report distinguishes functional/UX defects from subjective visual preferences.
- The proposed task is small enough for one worker, two attempts, 45 minutes and no dependency changes.
- `git diff --check` passes for the generated task evidence.
- The run ends as `ready-for-owner-review` or `blocked`; it does not begin implementation.

## Smoke Path

Audit these routes and the transitions between them when browser evidence is available:

```text
#/
→ #/recipient
→ identity confirmation
→ #/recipient/echo-map
→ source reveal
→ postcard completion
```

If browser evidence is unavailable, state that limitation and keep all findings source-backed.
