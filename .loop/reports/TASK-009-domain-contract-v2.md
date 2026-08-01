# TASK-009 Domain Contract V2 Report

## Outcome

Implemented the V2 public domain and shared adapter contracts on branch
`feat/domain-contract-v2`. No UI, feature orchestration, hardware adapter,
integration fixture, or product-context file was changed by this task.

## Changed files

- `src/domain/contracts.ts`
- `src/domain/contracts.test.ts`
- `src/domain/models.ts`
- `src/domain/hardware.ts`
- `src/domain/hardware.test.ts`
- `src/domain/index.ts`
- `src/adapters/contracts/services.ts`
- `.loop/claims/TASK-009-opencode-20260802.md`
- `.loop/reports/TASK-009-domain-contract-v2.md`

`src/data/seed.ts` did not require an update.

## Domain invariants

- A V2 relationship is discriminated by `contractVersion: 2` and explicitly
  identifies subject, recorder(s), recipient, and buyer.
- Subject, recorder, and buyer may be the same user; the recipient must be a
  distinct user and every assigned user must carry the corresponding role.
- Private Context is never recipient-visible. Relationship Context requires the
  exact relationship and recipient. Public Context still requires the same
  subject and the relationship's recipient.
- Original assets and derived content are separate entities. Derived and Agent
  output provenance carries source Context IDs, generation mode, and an explicit
  `aiGenerated` value.
- Source replay is the generation default. AI composition or persona inference
  requires an enabled mode, explicit topic allowlist membership, authorized
  source Context IDs, and a non-high-risk request.
- Generation policies require source and AI labels, block high-risk output, and
  make new facts and major decisions impossible in policy data.
- Trigger policies default to `pull_only`, `user_opened`, and no opt-in.
- `EntryEvent` and `EntryEventPort` are hardware-neutral; software, simulator,
  NFC, BLE, and other devices use the same business event boundary.

## Compatibility and breaking changes

- `Relationship` is now a discriminated migration union. New consumers must
  create `V2Relationship` with `contractVersion: 2`; the old fixture shape is
  retained only as the deprecated `LegacyRelationship` projection so the
  existing offline Demo compiles until TASK-015 migration.
- Existing `Person`, `Memory`, `AgentPolicy`, `HardwareEvent`, and legacy service
  ports remain deprecated migration projections. They do not define or weaken
  the strict V2 types. Removing them now would require edits in feature-owned
  files forbidden to TASK-009.
- `createEntryEvent` supersedes `createHardwareEvent` for new business code.
- New feature work should use `ContextCapturePort`, `RelationshipContextPort`,
  `InteractionPort`, `InteractionArtifactPort`, and `EntryEventPort`.

## Interface requests

- The five-state planned-interaction lifecycle in
  `.loop/requests/agent-interface.md` remains unresolved; it is outside this
  minimum domain contract and should be reconciled by the owning Agent task or
  TASK-015 if cross-feature behavior is required.
- The duplicate feature hardware model in
  `.loop/requests/hardware-interface.md` remains unresolved. TASK-014 should
  adapt its verification, binding, deduplication, and fallback behavior to the
  hardware-neutral `EntryEvent` boundary rather than importing device details
  into the domain.

## Verification

- `npm test -- src/domain --run`: passed, 4 files / 18 tests.
- `npm run typecheck`: passed.
- `npm test -- --run`: passed, 12 files / 52 tests.
- `npm run build`: passed, Vite production build completed.
