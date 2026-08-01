# Relationship Agent Report

## Scope

Implemented the relationship-scoped context and orchestration layer under
`src/features/agent` and offline adapters under `src/adapters/agent`.

## Delivered

- Relationship context loading with explicit `public_persona`,
  `relationship_specific`, `private`, `planned_interactions`, and `policy`
  sections.
- Owner, relationship, recipient, topic, allowlist, provenance, and owner-review
  enforcement before any content reaches a recipient view.
- Separate original and `ai_organized` playback decisions and output labels.
- Explicit errors for missing relationships, recipient mismatch, missing or
  mismatched policy, missing or inactive recipient sessions, insufficient
  context, unauthorized triggering, missing plans, and invalid plan transitions.
- Recipient-entry enforcement and policy-gated designed encounters. The agent
  never initiates contact outside an active recipient entry.
- Five-state planned-interaction service: `planned`, `invited`, `accepted`,
  `completed`, and `skipped`. Returned plans are typed as invitations and retain
  the recorder-authored invitation verbatim.
- `MockRelationshipAgent`, which is deterministic and requires no model API.

## Safety Decisions

- Private memories are discarded before assembly; the returned private section
  only reports `{ exposed: false }`.
- Public and relationship-specific memories must belong to the relationship
  owner. Relationship-specific memories must also match both relationship and
  recipient.
- AI-organized text is returned only when organization is enabled, every source
  is allowed, and the owner reviewed it.
- New-memory generation remains false. No synthetic intent or unreviewed text is
  produced.

## Interface Request

See `.loop/requests/agent-interface.md` for the planned-state mismatch, missing
explicit original-playback permission, and context repository contract request.

## Verification

- `npm run typecheck`: passed.
- `npx vitest run src/features/agent/agent.test.ts --pool=threads`: 11 tests
  passed.
- `npm test -- --pool=threads`: 11 files and 45 tests passed.
- `npm run build`: passed.
