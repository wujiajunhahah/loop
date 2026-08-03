# TASK-023 - Memory Game First Playable

## Objective

Build the first playable W·HERE memory game from the five-chapter product brief:
看见、说、寻找、去做、你在. The slice must be playable in one browser session and
must treat the recorded person as a source of memory, never as an always-on NPC.

## Allowed Files

- `src/app/App.tsx`
- `src/app/pages/HomePage.tsx`
- `src/app/pages/GamePage.tsx`
- `src/features/game/MemoryGame.tsx`
- `src/features/game/memory-game.css`
- `src/features/game/MemoryGame.test.tsx`
- `tests/e2e/memory-game-smoke.spec.ts`
- `.loop/claims/TASK-023--<session-id>.md`
- `.loop/reports/TASK-023-memory-game-first-playable.md`

## Requirements

- Add a discoverable game route without changing existing recipient or Echo Map behavior.
- Implement one continuous five-chapter flow with back/exit controls and explicit state.
- Use only synthetic Mei/Lin content and visibly distinguish original, AI-organized, and recipient-authored layers.
- No score, streak, intimacy rating, failure penalty, forced completion, or fake grief-recovery claim.
- The `去做` chapter must produce a recipient-authored new chapter only after explicit user confirmation.
- The final `你在` chapter must allow leaving without a formal completion gate.
- Responsive at desktop and 390px mobile widths; honor reduced motion.
- Use the existing app font and token language where practical, with scoped game visual tokens.

## Acceptance Criteria

- User can complete 看见 → 说 → 寻找 → 去做 → 你在 in one session.
- User can skip the optional note and can leave the experience before the final chapter.
- Search choices reveal source-backed content and do not punish incorrect exploration.
- New chapter content is marked as written by Lin today and is not presented as Mei's context.
- Existing tests and typecheck remain green.

## Smoke Path

```text
#/ → 进入记忆旅程 → 看见 → 说 → 寻找 → 去做 → 你在 → 离开
```

## Budget

- Maximum source files: 7
- No new dependencies
- One implementation pass and one browser polish pass

## Forbidden Scope

- No persistence, network AI, real hardware, sensor input, or account/auth changes.
- No changes to existing recipient/Echo Map contracts or state machine.
- No unrelated cleanup of existing dirty files.

## Verification

```powershell
npm run verify
npm run test:e2e
git diff --check
```
