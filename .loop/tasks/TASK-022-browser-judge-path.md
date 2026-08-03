# TASK-022 - Browser Judge Path

## Objective

Add one reproducible browser acceptance path for the two-minute W·HERE judge Demo, covering desktop and `390 x 844` mobile behavior without changing product scope.

## Allowed Files

- `package.json`
- `package-lock.json`
- `playwright.config.ts`
- `vite.config.ts` (exclude Playwright files from Vitest collection)
- `tests/e2e/judge-demo.spec.ts`
- `tests/e2e/fixtures/**`
- `src/features/recipient/RecipientExperience.tsx` (minimal async lifecycle fix discovered by the judge path)
- `.loop/claims/TASK-022--<session-id>.md`
- `.loop/reports/TASK-022-browser-judge-path.md`

## Requirements

- Use Playwright with a pinned project dependency and a local Vite server.
- Cover home → recipient → identity confirmation → Echo Map entry gate.
- Cover the existing core recipient path through source-backed response and postcard.
- Cover direct/deep-link behavior: a refreshed journey URL must not bypass recipient identity confirmation.
- Save screenshots or traces only on failure.
- Do not modify product source, domain contracts, routes, copy or product dependencies.
- The single allowed product-source change is limited to preventing the existing recipient loading state from remaining stuck after a resolved presentation request.

## Acceptance Criteria

- Desktop and mobile tests pass against a clean `npm ci` install.
- Tests assert user-visible outcomes and source/AI/recipient separation, not implementation internals.
- A failing browser test produces enough evidence to diagnose the route and viewport.
- Existing `npm run verify` remains green.

## Smoke Path

```text
#/ → 收到回应 → 主动进入 → 是留给我的，继续
→ Echo Map identity gate / core recipient flow
```

## Budget

- Maximum attempts: 2
- Maximum time: 60 minutes
- Maximum source files: 6
- Dependency changes: Playwright only, explicitly allowed above.

## Forbidden Scope

- No UI redesign.
- No persistence, real authentication, network AI, hardware or new journey node.
- No canonical status, decisions, risks or queue edits.

## Verification

```powershell
npm run verify
npm run test:e2e
git diff --check
```
