# Claim: TASK-022

- Task: `TASK-022-browser-judge-path`
- Session: `opencode-20260803-1048-task022-browser`
- Status: `completed`
- Scope: Playwright judge path, Vite/Vitest test isolation, and the minimal recipient async lifecycle fix discovered by browser execution.
- Files owned by this claim: `package.json`, `package-lock.json`, `playwright.config.ts`, `vite.config.ts`, `tests/e2e/judge-demo.spec.ts`, `src/features/recipient/RecipientExperience.tsx`, `.loop/tasks/TASK-022-browser-judge-path.md`, this claim, and the TASK-022 report.

## Evidence

- `npm run verify`: passed, 19 test files / 199 tests, typecheck, and production build.
- `npm run test:e2e`: passed, 6 tests across desktop `1440x1000` and mobile `390x844`.
- `git diff --check`: passed; only existing LF/CRLF conversion warnings were reported.

## Notes

The browser path exposed a real loading-state bug: the recipient presentation effect depended on `presentation`, so its cleanup ran after `setPresentation` and prevented the `finally` block from clearing `loading`. Removing that unnecessary dependency preserves the existing behavior and allows the verified recipient path to complete.
