# TASK-020 - Echo Map Demo Integration

## Objective

Integrate the accepted Echo Map slice into the current W·HERE recipient Demo,
prove the full flow at App level, update Demo instructions, and reconcile final
coordination facts without adding product scope.

## Allowed Files

- `src/features/recipient/RecipientExperience.tsx`
- `src/features/recipient/RecipientExperience.test.tsx`
- `src/app/App.integration.test.tsx`
- `src/app/pages/RecipientPage.tsx`
- `src/data/offlineDemo.ts` (timestamp consistency fix discovered by App integration only)
- `README.md`
- `.loop/STATUS.md`
- `.loop/INTEGRATION_QUEUE.md`
- `.loop/claims/TASK-020--<session-id>.md`
- `.loop/reports/TASK-020-echo-map-demo-integration.md`

## Requirements

- Add a clear Echo Map entry after existing recipient identity confirmation while
  retaining the original memory path.
- Complete at least one App-level glimmer journey through lit node and postcard.
- Prove original/AI/recipient separation and exact source IDs.
- Preserve existing recipient, capture, hardware, and W·HERE shell behavior.
- Update README with the runnable two-minute Echo Map path and current test count.
- Run full verification, `git diff --check`, and desktop/mobile browser smoke.
- Record limitations and no-scope-expansion statement.
