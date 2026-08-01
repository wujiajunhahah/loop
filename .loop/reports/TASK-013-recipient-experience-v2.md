# TASK-013 Recipient Experience V2 Report

## Outcome

Implemented the recipient-facing V2 flow within `src/features/recipient/**`.
Entry is explicitly initiated by the recipient and uses the default
`pull_only` / `user_opened` trigger. The flow does not depend on ring hardware
or a shared plan for P0 entry, and it exposes no free-form deceased-person chat.

## Delivered behavior

- Keeps explicit recipient entry and identity confirmation before creating an
  active recipient-initiated `Interaction`.
- Does not subscribe to hardware events or autoplay original audio.
- Runs the recipient-scoped Agent runtime with approved source Context and
  `source_replay` plus `source_composition` output modes.
- Visibly distinguishes `Original source` from `AI-generated` content.
- Displays source Context IDs, source Asset IDs, generation mode, trigger
  policy/reason, and model provenance where present.
- Provides accept, postpone, skip, close, replay, and save controls.
- Accepting the interaction creates one source-backed `postcard` artifact and
  displays its Artifact ID, generation label, summary, and Context IDs.
- Saves an optional response through the artifact service as recipient-authored
  content with recipient attribution; it is explicitly ineligible as recorder
  Agent context.
- Removes the old shared-plan screen from the P0 recipient path. Shared plans
  remain optional future/P1 content.

## Changed files

- `src/features/recipient/RecipientExperience.tsx`
- `src/features/recipient/RecipientExperience.test.tsx`
- `src/features/recipient/session.ts`
- `.loop/claims/TASK-013-opencode-20260802-recipient.md`
- `.loop/reports/TASK-013-recipient-experience-v2.md`

No capture, Agent, hardware, domain, shared app shell, or data seed files were
edited by TASK-013.

## Verification

- `npm test -- src/features/recipient --run`: passed, 2 files / 4 tests.
- `npm run typecheck`: passed.
- `npm test -- --run`: passed, 14 files / 75 tests.
- `npm run build`: passed, Vite production build completed.
- `git diff --check -- src/features/recipient`: passed.

This is a recipient-scope handoff only. End-to-end integration and completion
remain owned by TASK-015.
