# Integration Decisions

## INT-001 Shared Offline Demo State

The MVP keeps one in-memory state boundary for the recorder, Relationship Agent,
recipient flow, and hardware simulator. This preserves the offline requirement
while allowing a newly captured memory, policy approval, and planned interaction
to reach the recipient flow in the same browser session.

## INT-002 Hardware Bridge Ownership

The application uses the feature hardware simulator bridge as the single bridge
instance. The recipient flow subscribes to that instance, so a verified trigger
from the simulator is the same event that opens the recipient entry. The older
foundation bridge remains available to its unit tests but is not used by the
integrated UI.

## INT-003 Relationship Agent Boundary

The recipient UI loads content through `RelationshipAgent.enter`, backed by the
relationship context repository and policy evaluator. UI convenience data may
describe the demo, but it does not bypass relationship, recipient, owner-review,
or recipient-session checks.

## V2 Decisions

### V2-001 Software-first, hardware-neutral MVP

The P0 software loop is Context capture → relationship-scoped Agent → recipient
choice → InteractionArtifact. A ring, NFC tag, BLE button, desktop object, or
software simulator may provide the physical entry; none is a P0 software
dependency.

### V2-002 Source-backed bounded generation

Generation is allowed only when the recorder explicitly enables it. Every
generated result must carry source Context IDs, an AI-generated label, a
generation mode, sensitivity, and a trigger reason. The Agent may not invent
new facts, major decisions, or unreviewed intent.

### V2-003 Pull-only default

The recipient must actively enter the experience. Scheduled or contextual
suggestions are P1 and require explicit opt-in. Random or strong emotional
pushes are not part of the MVP.

### V2-004 InteractionArtifact is P0

The software Demo must produce one collectible postcard / letter / memory-card
artifact from a completed interaction. Shared plans are optional P1 content and
must not gate the core Demo.

### V2-005 One owner per mutable boundary

`TASK-009` owns the public domain and shared service contracts; `TASK-010` to
`TASK-014` own their feature directories; `TASK-015` is the only integration
owner for `src/app`, `src/data`, and cross-feature reconciliation.

### V2-006 Shared Demo container and documented integration conflict

TASK-015 adds `OfflineDemoService` as the single in-memory boundary for the V2
capture, Agent runtime, and InteractionArtifact flow. The Recipient feature's
previous hard-coded fixture is retained as its standalone test default, while
the App Shell injects the shared V2 container. The Recipient dependency seam
and the simulator's missing relationship ID were changed only to resolve the
cross-feature conflicts explicitly called out in the TASK-010, TASK-013, and
TASK-014 handoff reports.

### V2-007 Agent-directed game form

The reviewed `离世者Context与遗族状态感知_游戏概念发散` document describes the
intended Agent game form, not an unrelated optional concept. The existing P0
Context editor, relationship-scoped Agent, recipient choice, provenance, and
InteractionArtifact are the safety and data foundation beneath that game.

The recommended product structure is Echo Map as the primary interaction,
Traveling Messenger as a neutral Agent representation, and the existing postcard
as the output of each journey. The Agent acts as a journey director and memory
curator; the deceased is not an NPC. Memory Garden may become later persistent
feedback, but must not block the first playable vertical slice.

User-selected intensity, source-backed invitations, and recipient feedback belong
in the first game-design phase. Physiological inference, continuous location
sensing, persistent progression, and multi-recipient shared worlds remain later
phases until supported by privacy, safety, and user evidence. See
`.loop/reports/concept-review-2026-08-02.md`.

### V2-008 First playable journey contracts

TASK-016 is accepted as the implementation contract for the first Echo Map
vertical slice. The slice uses one recipient-initiated, relationship-scoped
journey session, one deterministic rainy-day source, explicit recipient
intensity, one optional approved recorder invitation or immutable Loop-authored
fallback, one recipient response, one postcard, and one lit node.

Recorder invitations use a journey-owned `ApprovedJourneyInvitation`; they are
never inferred from Context meaning or the legacy `PlannedInteraction`. Original,
AI-composed, and recipient-authored layers remain independently attributable.

`InteractionArtifactService` remains unchanged. Journey state owns one stable
Interaction ID, artifact retry/association, and an idempotent atomic node-light
operation. Journey completion occurs only when the postcard is linked and the
node is lit. Skip, close, stop, reject, and hide cannot produce false completion.

`permanently_hide` means relationship-scoped hiding for the current in-memory
Demo lifetime only. The UI must state this limitation directly; production
persistence, undo, retention, and deletion semantics require a later decision.
