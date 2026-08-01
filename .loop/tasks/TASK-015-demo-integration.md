# TASK-015 — Demo integration and V2 migration verification

## Owner

One OpenCode window, branch `feat/demo-integration-v2`.

## Dependency

`TASK-009` through `TASK-014` have reports and the Codex desktop review has
approved their integration order.

## Allowed files

- `src/app/**`
- `src/data/**`
- `src/styles/**`
- `README.md`
- end-to-end and smoke tests
- `.loop/reports/**`, `.loop/DECISIONS.md`, `.loop/RISKS.md`, and
  `.loop/INTEGRATION_QUEUE.md`

Do not rewrite feature internals except for a documented conflict resolution.

## Deliverables

Integrate one judge-readable offline path:

1. subject records a real text / simulated audio / image Context;
2. relation and recipient are selected;
3. owner reviews derived content and generation policy;
4. recipient actively enters;
5. Agent returns source-backed content with provenance;
6. one interaction produces a 远行明信片 artifact;
7. recipient can respond or close;
8. hardware simulator is optional and interchangeable;
9. offline fallback works without API, network, or device.

Use the rainy-day mother/daughter example only as demo data, not as a domain
requirement. Keep shared plans optional and secondary to the Context → Agent →
Artifact loop.

## Acceptance criteria

- No ring, HRV, free personality simulation, random push, family network, or
  game system is required for the main Demo.
- Full test suite, typecheck, production build, and a manual smoke path pass.
- README and `.loop/reports/TASK-015-demo-integration.md` state actual limits,
  not production claims.

## Required OpenCode handoff

Create
`D:\Codex-Workspace\Loop\.loop\claims\TASK-015-<session-id>.md` before
editing. Write
`D:\Codex-Workspace\Loop\.loop\reports\TASK-015-demo-integration.md` only after all upstream reports
are present and the full Demo has been verified. This is the only task allowed
to claim end-to-end completion.

## Test commands

```powershell
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

Also perform the manual offline path described in the task and record the
result, including any unverified browser or media behavior.
