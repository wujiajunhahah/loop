# Interface Request: Relationship Agent Context

## Status

Requested by the relationship-agent workstream. No core domain or shared
contract files were changed.

## Problems

1. `PlannedInteraction.status` currently exposes `available`, `accepted`,
   `postponed`, `skipped`, and `closed`. The required relationship journey needs
   distinct `planned`, `invited`, `accepted`, `completed`, and `skipped` states.
2. `AgentPolicy` does not independently state whether original content may be
   played. The agent currently treats membership in `allowedMemoryIds` as owner
   confirmation and original-playback permission.
3. `RelationshipStore` has no policy or planned-interaction retrieval methods.
   The feature therefore defines an `AgentContextRepository` port under its own
   boundary.
4. Recipient identity must come from a trusted session lookup rather than a
   caller-provided recipient ID. The feature port currently owns this lookup,
   but the shared recipient/session boundary should define the production trust
   contract.

## Proposed Integration

- Align the domain planned-interaction lifecycle with the five required states,
  including allowed transitions.
- Add an explicit original-playback permission at policy or per-memory level.
- Extend a future relationship-context read port with relationship, policy,
  authorized memory, planned-interaction, and trusted recipient-session queries.

Until these interfaces are approved, `PlannedInteractionService` owns the
five-state projection and `AgentPolicyEvaluator` applies the conservative
allowlist interpretation.
