# TASK-022 Browser Judge Path Report

## Result

`completed`

The W·HERE two-minute judge path is now executable as a reproducible Playwright suite. The test runner starts a local Vite server and keeps screenshots/traces only for failures.

## Coverage

- Desktop viewport: `1440x1000`.
- Mobile viewport: `390x844`.
- Direct `#/recipient/echo-map` URL shows the identity gate and remains gated after reload.
- Home -> `收到回应` -> `主动进入` -> Echo Map identity confirmation.
- Echo Map glimmer selection -> source inspection -> recipient response -> postcard -> node completion.
- Core recipient path -> source-backed response -> artifact -> independently scoped recipient note.

## Commands

```text
npm run verify
npm run test:e2e
git diff --check
```

## Evidence

- `npm run verify`: exit 0; 19 test files passed / 199 tests passed; typecheck passed; Vite build passed.
- `npm run test:e2e`: exit 0; 6 tests passed using desktop and mobile projects.
- `git diff --check`: exit 0; only existing Windows line-ending warnings.

## Browser Bug Found And Fixed

The core recipient route initially remained at `正在准备留给你的内容。` in a real browser. The async effect depended on `presentation`; after the promise resolved, `setPresentation` caused cleanup before `finally` could clear `loading`. Removing `presentation` from that effect dependency list fixed the lifecycle race without changing routes, copy, domain contracts, or data behavior.

## Limitations

- This verifies the offline Demo only; it does not test production authentication, network Agent services, hardware, persistence, or real user data.
- Playwright browsers must be installed after a clean `npm ci` with `npx playwright install chromium`.
