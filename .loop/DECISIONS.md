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
