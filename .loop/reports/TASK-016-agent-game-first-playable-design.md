# TASK-016 - Agent Game First Playable Design

## 1. Design Judgment

### Recommended form

Build one deterministic Echo Map journey named `Rain Under One Umbrella`. The
recipient enters voluntarily, chooses `quiet`, `glimmer`, or `deep`, inspects why
the journey and its source were selected, then accepts either a recorder-authored
invitation or a neutral fallback action. After marking one simulated action as
done, the recipient opens Mei's approved rainy-day Context, adds a present-life
response, creates one source-backed postcard, and lights exactly one map node.

Echo Map is the primary surface. Traveling Messenger is a neutral system guide
that carries an approved source into the journey and the postcard; it never
speaks as Mei. The Agent is limited to proposal assembly, explanation, source
selection, bounded composition, and fallback selection.

The playable proves one product hypothesis: a recipient-controlled real-life
micro-journey can make a source-backed memory feel active without converting the
recorded person into an NPC or turning grief into progression.

### Rejected alternatives

- **Memory Garden first:** rejected because persistent growth is not needed to
  prove one interaction and introduces progression semantics before the journey
  is validated.
- **Unfinished wish quest:** rejected because it can imply that Mei is issuing a
  current command. The recorder-authored invitation is shown only when its exact
  authorship and source are available; the neutral fallback makes no such claim.
- **Generated route or GPS walk:** rejected because location collection adds no
  value to this offline slice and creates privacy, safety, and recovery work.
- **Chat with Mei:** rejected because free persona simulation conflicts with the
  source-backed bounded Agent contract.
- **Sensor-adaptive intensity:** rejected because direct recipient choice is the
  authoritative signal. Automation may reduce intensity in later work but may
  never increase it.
- **Rewards, streaks, or completion scores:** rejected because they can pressure
  the recipient and falsely frame journey completion as grief recovery.

## 2. Player Promise

Choose how close to come, take one optional everyday action, and turn an approved
memory plus your own present-life response into a traceable postcard and one lit
place on your Echo Map.

## 3. Two-Minute Playable Flow

The primary Demo path is deterministic and uses no network, LLM, GPS, sensor,
account persistence, or hardware.

### Screen 1 - Echo Map entry (0:00-0:15)

- Route: `/recipient/echo-map` after the existing recipient identity confirmation.
- The map contains one unlit node, `Rain Under One Umbrella`, and a neutral
  Traveling Messenger marker.
- The screen states `pull_only`, identifies Mei -> Lin, and says that nothing
  opens or plays automatically.
- Lin selects one intensity using a segmented control:
  - `quiet`: original source only, no AI composition;
  - `glimmer`: original source plus one short source composition;
  - `deep`: original source plus the full approved source composition and a
    longer optional response prompt.
- Default is `quiet`. No system event can raise the selected value.
- Entering the map creates a journey session in `map_ready`. `Close` moves that
  session to `closed` without changing node availability. `Hide this journey`
  requires a confirmation and permanently hides this proposal for the current
  offline Demo lifetime.

Transition: selecting an intensity enables `Inspect journey`; it does not accept
or start the journey.

### Screen 2 - Proposal inspection (0:15-0:35)

- Route: `/recipient/echo-map/rainy-day/proposal`.
- Show the neutral title, estimated action (`about one minute`), selected
  intensity, source topic, source Context ID, trigger `user_opened`, and why the
  Agent selected it.
- Distinguish the two actions visually and semantically:
  - recorder-authored invitation: exact reviewed text, `Authored by Mei`, source
    Context ID, and `not AI-generated`;
  - neutral fallback: `Pause by a window and notice the rain or the light for
    one moment`, `Suggested by Loop`, and `not a message from Mei`.
- The offline fixture uses the neutral fallback unless an approved invitation
  record is present. The Agent must never infer an invitation from `meaning`.
- Controls: `Accept invitation`, `Use neutral action`, `Skip this time`, `Reject
  this proposal`, `Hide this journey`, and `Back to map`.

Transitions:

- Accepting either action starts the journey with that exact action.
- Skip returns to the map with the node unlit and available later.
- Reject ends this proposal, leaves the node unlit, and keeps it rejected until
  `OfflineDemoService.reset()`. Proposal replacement is outside this slice; a
  future reviewed proposal must use a new proposal ID and explicit product flow.
- Hide confirms, hides the node, and returns to the map.
- Back preserves the selected intensity but creates no completion.

### Screen 3 - Simulated action (0:35-0:55)

- Route: `/recipient/echo-map/rainy-day/action`.
- Show the selected action, authorship badge, and a static rainy-window visual.
- Primary control: `I did this`. This is an explicit recipient declaration; the
  system does not claim to detect real-world completion.
- Secondary controls: `Choose the neutral action` when currently using the
  recorder invitation, `Skip action and stop`, and `Stop journey`.
- No countdown, location check, success score, or failure state is shown.

Transition: `I did this` records `action_completed_at` and enables the memory.
Stopping ends the session with no postcard and no lit node.

### Screen 4 - Sourced memory (0:55-1:20)

- Route: `/recipient/echo-map/rainy-day/memory`.
- The original rainy-day content is primary and does not autoplay.
- Show `Original source`, Context ID, Asset ID, generation mode, trigger reason,
  and sensitivity.
- For `glimmer` and `deep`, show the reviewed deterministic composition in a
  separate `AI-generated` area. For `quiet`, do not request or display it.
- Controls: `Open original`, `Continue`, `Stop journey`, and `Permanently hide`.
- Loading failure leaves the journey at `action_completed`, offers `Retry`, and
  never advances or fabricates output.

Transition: successfully opening the validated Agent result records
`memory_opened_at`; `Continue` moves to the recipient response.

### Screen 5 - Present-life response (1:20-1:40)

- Route: `/recipient/echo-map/rainy-day/respond`.
- Lin can write a short note such as `I heard rain against my window today.`
- The label states `Written by Lin today` and `Never added to Mei's Context`.
- Empty input is allowed through `Continue without a note`; the system stores an
  explicit omitted response rather than inventing one.
- Controls: `Save and make postcard`, `Continue without a note`, `Back to
  memory`, and `Stop journey`.

Transition: saving produces a recipient-owned response record first, then starts
postcard creation. A failure preserves the response and offers `Retry postcard`.

### Screen 6 - Postcard review (1:40-1:55)

- Route: `/recipient/echo-map/rainy-day/postcard`.
- Show the original quote or source reference, bounded composition when allowed,
  Lin's response when present, AI label, source IDs, and artifact ID.
- The postcard remains visibly composed from separate original, generated, and
  recipient-authored layers.
- Controls: `Keep postcard and light node`, `Retry` on failure, and `Stop without
  completing` before confirmation.

Transition: node lighting is one atomic service operation after a valid postcard
exists. If lighting fails, the postcard remains valid but the session stays at
`postcard_created`; retry must not create a second artifact.

### Screen 7 - Lit Echo Map node (1:55-2:00)

- Route: `/recipient/echo-map`.
- The rainy-day node is lit and links to the postcard.
- Show no score, percentage, streak, reward, decay, or pressure to continue.
- Terminal controls are `Open postcard` and `Leave`.

## 4. State Machine

### States

```text
map_ready
intensity_selected
proposal_inspected
action_accepted
action_completed
memory_opened
response_recorded
postcard_creating
postcard_created
node_lit
skipped
stopped
rejected
hidden
closed
```

`node_lit`, `skipped`, `stopped`, `rejected`, `hidden`, and `closed` are terminal
for one `JourneySession`. A new session may be created after `skipped` or
`closed`; `rejected` and `hidden` prevent proposal availability until Demo reset.

### Events, guards, and effects

| State | Event | Guard | Next state | Effect |
|---|---|---|---|---|
| `map_ready` | `SELECT_INTENSITY` | value is quiet/glimmer/deep | `intensity_selected` | store recipient selection |
| `map_ready` or `intensity_selected` | `CLOSE` | always | `closed` | leave node available; create no content |
| `intensity_selected` | `INSPECT_PROPOSAL` | proposal is relationship-scoped and not hidden/rejected | `proposal_inspected` | store inspected timestamp |
| `proposal_inspected` | `ACCEPT_ACTION` | action belongs to proposal and has valid authorship | `action_accepted` | freeze selected action |
| `proposal_inspected` | `SKIP` | always | `skipped` | no completion side effect |
| `proposal_inspected` | `REJECT` | always | `rejected` | mark proposal rejected |
| `map_ready` through `memory_opened` | `HIDE` | explicit confirmation and no artifact exists | `hidden` | set relationship-scoped hidden flag |
| `action_accepted` through `postcard_created` | `STOP` | no create/light request is running | `stopped` | preserve audit state only |
| `action_accepted` | `COMPLETE_ACTION` | explicit recipient declaration | `action_completed` | record timestamp, not sensor proof |
| `action_completed` | `OPEN_MEMORY` | Agent validates entry, policy, source, and provenance | `memory_opened` | store validated presentation refs |
| `memory_opened` | `SAVE_RESPONSE` | author is active recipient; content or explicit omission | `response_recorded` | store recipient-owned response |
| `response_recorded` | `CREATE_POSTCARD` | validated presentation and response record exist | `postcard_creating` | begin idempotent artifact request |
| `postcard_creating` | `POSTCARD_CREATED` | valid artifact matches session sources | `postcard_created` | store artifact ID |
| `postcard_creating` | `POSTCARD_FAILED` | error recorded | `response_recorded` | retain response and permit retry |
| `postcard_created` | `LIGHT_NODE` | artifact ID exists and node is unlit | `node_lit` | atomically link node, artifact, session and set journey `completedAt` |
| `postcard_created` | `LIGHT_NODE_FAILED` | error recorded | `postcard_created` | retain artifact and permit retry |

### Invariants

- Intensity can change only before action acceptance. A future automation input
  may lower it but cannot raise it.
- A recorder-authored action requires an immutable approved invitation record;
  absent that record, only the neutral action is valid.
- `memory_opened` requires an output from `RecipientScopedAgentRuntime`; UI route
  navigation alone cannot satisfy the guard.
- Recipient content is never a `ContextItem`, `DerivedContent`, original asset of
  Mei, or future Agent source.
- Postcard creation requires an existing recipient response record, including an
  explicit `omitted` record when no text is entered.
- A node can be lit only once and only after a valid postcard is linked.
- Journey `completedAt` exists only in `node_lit`. The completed `Interaction`
  timestamp required by artifact creation is a separate source-presentation
  boundary and never means the journey or node completed.
- Skip, stop, reject, hide, loading failure, and artifact failure never set
  journey `completedAt`, create false completion, or light a node. Stopping from
  `postcard_created` may retain that valid artifact; all earlier stop paths have
  no artifact.
- Replaying an event against a terminal session returns the same session or a
  typed invalid-transition error; it cannot reopen the session.

### Failure and recovery

- Proposal unavailable or source no longer authorized: return to map with a
  source-unavailable message; do not substitute another source silently.
- Agent load failure: stay at `action_completed`, retain action state, retry the
  same source request, or stop.
- Browser refresh: in this offline no-persistence slice, show a restart-required
  state and reset to the fixture after explicit confirmation. Never reconstruct
  completion from the URL.
- Response save failure: keep draft in component state, remain at `memory_opened`,
  and retry.
- Postcard failure: return from `postcard_creating` to `response_recorded`; use a
  stable idempotency key derived from the journey session.
- Node-light failure: remain at `postcard_created` and reuse the existing artifact.

## 5. Agent Contract

The journey orchestrator owns proposal and session state. The existing
`RecipientScopedAgentRuntime` remains the authority for opening source-backed
memory. The following TypeScript-shaped contracts define the new boundary.

```ts
type JourneyIntensity = 'quiet' | 'glimmer' | 'deep'
type JourneyActionKind = 'recorder_invitation' | 'neutral_fallback'

interface JourneyProposalRequest {
  relationshipId: EntityId
  recipientId: EntityId
  recipientSession: RecipientSession
  intensity: JourneyIntensity
  triggerReason: 'user_opened'
  candidateContextIds: readonly EntityId[]
}

interface ApprovedJourneyInvitation {
  id: EntityId
  relationshipId: EntityId
  recipientId: EntityId
  recorderId: EntityId
  exactText: string
  sourceContextIds: readonly EntityId[]
  authoredAt: string
  reviewedByUserId: EntityId
  reviewedAt: string
  status: 'approved'
  aiGenerated: false
}

interface JourneyAction {
  id: EntityId
  kind: JourneyActionKind
  text: string
  authorship:
    | {
        kind: 'recorder'
        authoredByUserId: EntityId
        approvedInvitationId: EntityId
      }
    | {
        kind: 'loop'
        fixtureId: 'fallback-rain-window-v1'
      }
  sourceContextIds: readonly EntityId[]
  aiGenerated: false
}

interface JourneySourceSelection {
  sourceContextIds: readonly EntityId[]
  sourceAssetIds: readonly EntityId[]
  selectionReason: string
  requestedModes: readonly ('source_replay' | 'source_composition')[]
  sensitivity: SensitivityLevel
}

interface JourneyProposal {
  id: EntityId
  relationshipId: EntityId
  recipientId: EntityId
  nodeId: EntityId
  title: string
  intensity: JourneyIntensity
  rationale: string
  primaryAction?: JourneyAction
  fallbackAction: JourneyAction
  sourceSelection: JourneySourceSelection
  triggerReason: 'user_opened'
  offline: true
  userControls: readonly [
    'inspect',
    'accept',
    'skip',
    'stop',
    'reject',
    'permanently_hide',
  ]
}

type JourneyFallbackReason =
  | 'no_approved_recorder_invitation'
  | 'invitation_source_unavailable'
  | 'recipient_chose_neutral_action'
  | 'intensity_reduced'

interface JourneyProposalResult {
  proposal: JourneyProposal
  fallbackReason?: JourneyFallbackReason
  proposalProvenance: Provenance
}

interface JourneyPresentation {
  interactionId: EntityId
  original: RecipientAgentResult & { outputMode: 'source_replay' }
  composition?: RecipientAgentResult & { outputMode: 'source_composition' }
}

interface JourneyPostcardView {
  artifact: SourceBackedInteractionArtifact
  originalLayer: {
    label: 'Original source'
    sourceContextIds: readonly EntityId[]
    sourceAssetIds: readonly EntityId[]
  }
  compositionLayer?: {
    label: 'AI-generated'
    sourceContextIds: readonly EntityId[]
    provenance: Provenance
  }
}

interface CompleteEchoMapNodeInput {
  journeySessionId: EntityId
  nodeId: EntityId
  artifactId: EntityId
  completedAt: string
}

interface CompleteEchoMapNodeResult {
  session: JourneySession & { state: 'node_lit'; completedAt: string }
  node: EchoMapNodeState & { status: 'lit'; artifactId: EntityId }
  outcome: 'completed' | 'already_completed'
}
```

Contract rules:

- `candidateContextIds` are an allowlist, not a request to search all Context.
- Before returning a proposal, the service requires
  `recipientSession.initiatedByRecipient === true`, status `active`, and matching
  session/request/relationship recipient and relationship IDs. It stores that
  session ID on the journey and creates the runtime `Interaction` from the same
  recipient-authorized boundary. Relationship status, visibility, policy,
  trigger, and source checks then occur before a proposal is returned.
- `quiet` sets `requestedModes` to `['source_replay']`; `glimmer` and `deep` set
  it to `['source_replay', 'source_composition']` only when the generation policy
  allows composition. All three use the same approved source in the first slice.
- Intensity changes presentation length and composition availability, never
  factual content, sensitivity classification, permission, or source boundary.
- The rationale says why Loop selected the Context. It must not infer Lin's
  emotion or claim that Mei currently wants Lin to act.
- The recorder invitation is optional and valid only when `recorderId` belongs
  to the relationship recorders, `recipientId` and `relationshipId` match the
  proposal, every source is visible and policy-approved, `reviewedByUserId` is
  the relationship owner, review time is present, and `exactText` is non-empty.
  `JourneyAction.text` must equal that immutable invitation's `exactText`.
- The fallback action is frozen fixture text, neutral, non-clinical, and marked
  with `authorship.kind: 'loop'` and immutable fixture ID
  `fallback-rain-window-v1`. A recorder invitation must use
  `authorship.kind: 'recorder'` and match its invitation's recorder and ID. The
  two authorship variants cannot be substituted. The fallback is not generated
  from Mei's voice.
- Every result identifies source Context IDs. Generated composition continues to
  carry model, confidence, AI label, owner review, and provenance through the
  existing runtime.
- `proposalProvenance` traces the Agent's rationale and source selection. It does
  not turn the recorder invitation or neutral fallback into generated speech.
- `JourneyPresentation` always contains the original result. Its optional
  composition is a second, independently labeled result; it never replaces or
  mutates the original layer.
- Postcard creation passes `presentation.composition ?? presentation.original`
  as the existing `Interaction.output`. `originalQuoteAssetId` and source asset
  provenance preserve the original layer; `generationLabel` identifies whether
  the summary is composed. `JourneyPostcardView` reconstructs both visible layers
  from the artifact source IDs and stored presentation, so the public artifact
  contract does not need an unsafe flattened multi-output field.
- `permanently_hide` means hide this proposal for this relationship in the
  current in-memory Demo. Production permanence requires later persisted account
  semantics and deletion rules.

The memory-open request maps directly to the existing runtime:

```ts
interface JourneyMemoryRequest extends RecipientAgentRequest {
  interaction: Interaction
  sourceContextIds: readonly EntityId[]
  mode: 'source_replay' | 'source_composition'
  triggerReason: 'user_opened'
}
```

## 6. Data Ownership

| Data | Owner and storage | May become Agent source? | Notes |
|---|---|---|---|
| Recorder Context | existing `ContextItem` and `OriginalAsset` stores | yes, only through policy | immutable original remains separate |
| Recorder-authored invitation | new reviewed invitation record owned by recorder/relationship | only as approved action text | absent in current fixture; never inferred |
| Derived content | existing `DerivedContent` store | only when approved and policy allows | separate from original source |
| Agent proposal/output | new journey proposal store plus existing runtime result | no new Context automatically | carries source IDs and AI label |
| `JourneySession` | new journey store in shared offline service | no | owns intensity, states, timestamps, selected action, errors |
| Recipient response | new recipient-owned response store | no | `eligibleAsRecorderContext: false` |
| Postcard | existing `InteractionArtifactService` store | artifact only | created after response record |
| Echo Map node | new relationship-recipient map-node store | no | links node to session and artifact after completion |

Recommended minimal new records:

```ts
interface JourneySession {
  id: EntityId
  proposalId: EntityId
  recipientSessionId: EntityId
  relationshipId: EntityId
  recipientId: EntityId
  intensity: JourneyIntensity
  state: JourneyState
  interactionId: EntityId
  selectedActionId?: EntityId
  responseId?: EntityId
  artifactId?: EntityId
  artifactRequestedAt?: string
  startedAt: string
  updatedAt: string
  terminalAt?: string
  completedAt?: string
}

interface JourneyRecipientResponse {
  id: EntityId
  journeySessionId: EntityId
  relationshipId: EntityId
  authorId: EntityId
  authorRole: 'recipient'
  kind: 'text' | 'omitted'
  content?: string
  eligibleAsRecorderContext: false
  createdAt: string
}

interface EchoMapNodeState {
  nodeId: EntityId
  relationshipId: EntityId
  recipientId: EntityId
  status: 'available' | 'lit' | 'hidden' | 'rejected'
  journeySessionId?: EntityId
  artifactId?: EntityId
  updatedAt: string
}
```

For the first slice all new records live in `OfflineDemoService` maps and reset
with `reset()`. React owns only transient drafts and rendering state. No local
storage, account persistence, or production permanence is implied.

`interactionId` is created once with the deterministic form
`interaction:journey:<JourneySession.id>` and is never optional or regenerated.
On the first `CREATE_POSTCARD`, the orchestrator stores one
`artifactRequestedAt` and builds the completed `Interaction` with that stable ID
and timestamp. Retry first reads `artifact:<interactionId>` from
`InteractionArtifactService`; it returns a matching existing artifact or calls
`create` again with the identical interaction, output, response, and timestamp.
A mismatched existing artifact is a typed integrity error, never overwritten.

`completeEchoMapNode(input)` owns the only node-light mutation. It synchronously
validates the session is `postcard_created`, all three IDs have the same
relationship and recipient scope, the artifact is the session artifact, the
node is unlit, and `completedAt` is present before committing cloned session and
node records together. Repeating the same session/node/artifact tuple returns
`already_completed` with no mutation. A node already linked to another session or
artifact returns `NODE_COMPLETION_CONFLICT`; a failed validation changes neither
record. The method performs no asynchronous work between validation and the two
in-memory map writes.

## 7. Reuse Map

### Reuse unchanged

- `src/domain/contracts.ts`: `ContextItem`, `OriginalAsset`, `Provenance`,
  `GenerationPolicy`, `TriggerPolicy`, `Interaction`, `InteractionOutput`, and
  `InteractionArtifact`; also `isContextVisibleTo` and `hasValidProvenance`.
- `src/domain/models.ts`: `V2Relationship` and `RecipientSession` for recipient
  and relationship authorization.
- `src/features/agent/RecipientScopedAgentRuntime.ts`: source replay and bounded
  composition with relationship, source, policy, trigger, safety, and owner-review
  enforcement.
- `src/features/agent/runtimeTypes.ts`: runtime request/result and ports.
- `src/adapters/agent/DeterministicAgentGenerationAdapter.ts` and
  `DeterministicOwnerReviewAdapter.ts`: primary offline Demo adapters.
- `src/features/artifact/InteractionArtifactService.ts`: source-backed postcard
  validation and idempotent artifact identity.
- `src/features/artifact/types.ts`: recipient attribution and
  `eligibleAsRecorderContext: false`.
- `src/shared/ui/ButtonLink.tsx`, `PageHeader.tsx`, and `StatusPanel.tsx`: shell
  primitives where their semantics fit.
- `src/styles/global.css`: existing button, form, error, source-details, loading,
  and responsive layout patterns.

### Extend

- `src/data/offlineDemo.ts`: remain the single shared in-memory service; add
  journey proposals, sessions, responses, map-node maps, injected ID/time, and
  atomic completion methods.
- `src/features/recipient/session.ts`: add a sibling `EchoMapData` port or extend
  the recipient data boundary without leaking service maps into React.
- `src/app/pages/RecipientPage.tsx`: inject the shared Echo Map data boundary.
- `src/app/App.tsx`: retain hash routing and add recipient Echo Map subroutes.
- `src/features/recipient/RecipientExperience.tsx`: reuse explicit entry,
  provenance display, retry, no-autoplay, and restart-required behavior; split the
  new journey screens into focused components rather than adding all states to
  this component.
- `src/domain/contracts.ts`: only if coordinator approves placing journey types
  in the public domain; otherwise keep them under a new journey feature.
- `InteractionArtifact`: associate it with a journey through the map-node/session
  store first; a public `journeySessionId` field is optional and should not block
  the first implementation.

### Keep isolated

- Legacy `Memory`, `OrganizedContent`, `AgentPolicy`, and `PlannedInteraction` in
  `src/domain/models.ts` are compatibility projections, not Echo Map state.
- `RelationshipAgent.ts`, `ContextAssembler.ts`, `AgentPolicyEvaluator.ts`, and
  `PlannedInteractionService.ts` use the legacy contract. Its transition-table
  test style is reusable, but its model lacks the journey states and controls.
- `src/data/seed.ts`, `services.ts`, and most of `mockServices.ts` are legacy
  fixture wiring. Only the current playback service remains relevant.
- Hardware bridges remain outside this slice. The software action declaration is
  the primary path, not a hardware failure fallback.
- `FeedbackPreference.interactionLength` must not be repurposed as journey
  intensity; they represent different user choices.

### Known implementation mismatch to resolve

The current recipient flow creates a postcard before collecting Lin's response,
then recreates the same artifact when a response is saved. The journey flow must
store the response or explicit omission first and call artifact creation once.
The existing artifact service can remain unchanged.

## 8. UI Specification

### Information architecture

```text
Recipient identity entry
└── Echo Map
    ├── Journey proposal
    ├── Simulated action
    ├── Sourced memory
    ├── Present-life response
    ├── Postcard review
    └── Lit node / postcard detail
```

The existing product navigation remains available but does not interrupt the
journey. No landing page, marketing copy, chat surface, dashboard metrics, or
decorative nested cards are added.

### Component boundaries

- `EchoMapScreen`: one map surface, node state, intensity segmented control, and
  Traveling Messenger marker.
- `JourneyProposalScreen`: source rationale, authorship, action alternatives,
  and all rejection controls.
- `JourneyActionScreen`: static visual, selected action, explicit completion.
- `JourneyMemoryScreen`: original/AI separation, provenance, playback, retry.
- `JourneyResponseScreen`: recipient-authored input and omission control.
- `JourneyPostcardScreen`: artifact layers, provenance, final confirmation.
- `JourneyExitDialog`: confirmation only for permanent hide; skip and stop do
  not use manipulative warnings.
- `JourneyStatusNotice`: loading, typed error, retry, and restart-required states.

All screens receive a view model and emit typed events. They do not mutate the
offline store directly.

### Desktop behavior

- Use a quiet two-column work surface: map or visual on the left, current journey
  controls and evidence on the right.
- Keep source details in a collapsible but keyboard-accessible section; Context
  ID, AI label, and action authorship remain visible without expanding it.
- The map node has a stable hit area and does not move when lit, loading, or
  focused.
- Primary action appears once per screen. Skip, stop, reject, and hide remain
  visually distinct and reachable without a menu.

### Mobile behavior

- Use one vertical flow. The map occupies a stable square region above controls.
- The intensity control wraps labels without shrinking text based on viewport.
- Sticky bottom actions may contain only the primary and stop controls; reject
  and hide remain in the proposal body to avoid accidental activation.
- Provenance values wrap and never overflow. Long IDs use `overflow-wrap`.
- Back navigation follows state guards. Browser back never marks action,
  artifact, or node completion.

### Interaction and accessibility

- Use a segmented radio group for intensity and native buttons for commands.
- Every icon button has an accessible name and tooltip; text commands retain
  text where ambiguity or safety requires it.
- Focus moves to each screen heading after a state transition and to the error
  notice after a failed async operation.
- Loading controls expose `aria-busy`; errors use `role="alert"`; successful
  saves use `role="status"`.
- Original content never autoplays. Reduced-motion preference removes marker and
  node-light transitions without changing state feedback.
- Color is not the only lit/hidden/authorship indicator; use labels and icons.

## 9. Acceptance Criteria

### Unit checks

- Given a new session, when `quiet` is selected, then the proposal permits source
  replay and does not request source composition.
- Given any selected intensity, when automation proposes a higher value, then the
  value is unchanged; when it proposes a lower value, then the value may reduce.
- Given no reviewed recorder invitation, when a proposal is assembled, then only
  the neutral fallback can be accepted and it is marked Loop-authored.
- Given an approved invitation with mismatched author, relationship, or source,
  when proposal validation runs, then it is rejected and never shown as Mei's.
- Given a candidate source outside Lin's relationship or generation policy, when
  proposal assembly runs, then it returns a typed source error.
- Given a generated or composed proposal result, then provenance contains at
  least one source Context ID and the AI label matches generation mode.
- Given any terminal session, when another transition event is applied, then no
  state, postcard, or node side effect occurs.
- Given `closed`, then no artifact exists, the node remains available, and a new
  recipient-initiated session may be created later.
- Given `skipped`, `rejected`, or `hidden`, then `completedAt` and `artifactId`
  are absent and the node is not lit.
- Given `stopped` before postcard creation, then no artifact exists; given
  `stopped` from `postcard_created`, then the same valid artifact may remain but
  journey `completedAt` is absent and the node is not lit.
- Given a recipient response, then its role is `recipient` and
  `eligibleAsRecorderContext` is `false`.
- Given an existing postcard and a node-light retry, then the same artifact ID is
  linked and no duplicate postcard is created.
- Given a proposal request with a non-active, non-recipient-initiated, or
  relationship-mismatched `RecipientSession`, then no proposal or journey session
  is created.
- Given a neutral fallback, its authorship is Loop plus
  `fallback-rain-window-v1`; given a recorder invitation, its authorship IDs must
  match the approved invitation record.
- Given the same node completion tuple twice, the second result is
  `already_completed`; given a different artifact or session for a lit node, the
  result is `NODE_COMPLETION_CONFLICT` and no record changes.

### Integration checks

- Given Lin actively enters and chooses `quiet`, when she completes the neutral
  action, opens the source, omits a response, confirms the postcard, and lights
  the node, then exactly one artifact and one lit node exist with the rainy-day
  Context ID.
- Given Lin chooses `glimmer`, then original and AI-generated composition render
  separately with source IDs, and the postcard preserves those labels.
- Given Lin chooses `deep`, then the same source and permission boundary apply;
  no additional fact or source is invented.
- Given Lin skips at proposal inspection, then she returns to an unlit available
  node and no artifact exists.
- Given Lin stops after action completion or memory opening, then the session is
  terminal, the node remains unlit, and no completion artifact exists.
- Given Lin rejects a proposal, then it is not proposed again during the same
  offline Demo lifetime.
- Given Lin confirms permanent hide, then the node is hidden for that
  relationship until `OfflineDemoService.reset()`.
- Given Agent presentation fails, then retry uses the same Context IDs and stop
  remains available.
- Given postcard creation fails after response storage, then retry preserves the
  recipient response and creates one artifact.
- Given the page refreshes mid-journey, then the UI requires explicit restart and
  never infers active authorization or completion from the route.
- Given another relationship or recipient ID is injected, then no proposal,
  source, response, artifact, or map-node state crosses into Lin's journey.

### Manual smoke checks

- Complete the full two-minute `glimmer` path offline with network disabled.
- Confirm original content does not autoplay and the neutral action is not
  presented as Mei's words.
- Exercise skip, stop, reject, permanent hide, Agent retry, postcard retry, and
  refresh recovery on desktop and mobile widths.
- Verify keyboard-only intensity selection, proposal controls, response entry,
  focus movement, and error recovery.
- Verify no screen shows a grief metric, reward, streak, generated wish, sensor
  inference, real route, autonomous deceased character, or hardware requirement.

## 10. Implementation Decomposition

Do not start these tasks until the coordinator reviews and accepts this report.
Each task should receive its own file ownership and report.

1. **Journey domain and state machine**
   Ownership: new `src/features/journey/domain/**` and tests only, plus a narrowly
   approved domain export if required. Define proposal, invitation, intensity,
   session, response, node state, events, invariants, and typed errors. No UI or
   persistence changes. Dependency: accepted TASK-016.

2. **Offline journey orchestration**
   Ownership: new `src/features/journey/services/**`, relevant adapters/tests,
   and an explicitly approved extension to `src/data/offlineDemo.ts`. Assemble the
   fixed rainy-day proposal, validate invitation authorship, invoke the existing
   Agent runtime and artifact service, persist in-memory records, and make
   postcard/node completion idempotent. Dependency: task 1.

3. **Echo Map recipient UI**
   Ownership: new `src/features/journey/ui/**` and local styles/tests; approved
   recipient/app routing seams only. Implement all screens and exits against a
   fake journey port first, then connect the offline orchestrator. Dependency:
   tasks 1 and 2.

4. **Integrated Demo and recovery evidence**
   Ownership: `src/app/**`, integration tests, shared style reconciliation,
   README Demo steps, and report. Prove the complete path, relationship isolation,
   skip/stop/hide, async retries, refresh recovery, mobile/desktop smoke, full
   tests, typecheck, and build. Dependency: tasks 1 through 3.

Hardware, GPS, persistence, Memory Garden, shared worlds, sensors, and LLM-backed
generation are not follow-up tasks from this slice. They require separate user
evidence and product decisions.

## 11. Risks and Decision Requests

### Risks with fixed mitigations

- **Invitation misattribution:** never infer Mei-authored intent from a Context
  summary. Require a reviewed invitation record or use the neutral fallback.
- **Completion pressure:** show no score, streak, failure, decay, or punitive copy;
  keep stop available after acceptance.
- **Scope expansion:** one node, one source, one action, one response, one
  postcard, and one deterministic offline fixture only.
- **Recipient content contamination:** store responses in a separate recipient
  repository with `eligibleAsRecorderContext: false`.
- **False real-world proof:** `I did this` is a recipient declaration, not sensor
  verification.
- **False permanence:** describe permanent hide as permanent within the current
  offline Demo lifetime until production persistence semantics exist.

### Decision Requests for coordinator review

**DR-016-01 - Recorder invitation record**

Recommended decision: approve a journey-owned `ApprovedJourneyInvitation` record
rather than adding invitation semantics to `ContextItem.meaning` or the legacy
`PlannedInteraction`. The first fixture may omit this record and demonstrate the
neutral fallback; a recorder-authored invitation cannot be shown until the
record's author, exact text, relationship, recipient, source IDs, owner review,
timestamps, approved status, and non-AI attribution match the schema above.

**DR-016-02 - Journey-to-artifact association**

Recommended decision: keep `InteractionArtifactService` unchanged and associate
`JourneySession`, `EchoMapNodeState`, and artifact ID in the journey store for the
first slice. The journey owns one required deterministic `interactionId` and one
stable `artifactRequestedAt`; retry resolves `artifact:<interactionId>` before
calling `create` with the identical completed Interaction. Promote
`journeySessionId` into the public artifact contract only if another consumer
needs direct artifact-to-journey queries.

**DR-016-03 - Permanent hide wording**

Recommended decision: accept `permanently_hide` as a product control but label
the offline implementation accurately: it lasts for the current in-memory Demo
until explicit reset. Production implementation is blocked on account-level
persistence, retention, undo, and deletion semantics.

None of these requests blocks the recommended first implementation task if its
scope follows the recommended decisions. Coordinator rejection of a recommendation
requires revising this design before UI or integration work starts.

## 12. Coordinator Review Outcome

Accepted on 2026-08-02 after two skeptical review rounds and revision.

- DR-016-01 approved: the first implementation uses the journey-owned
  `ApprovedJourneyInvitation` schema and validation rules in this report.
- DR-016-02 approved: `InteractionArtifactService` remains unchanged; the journey
  owns the stable Interaction identity, artifact lookup, and association.
- DR-016-03 approved: the control is implemented only as current-Demo-lifetime
  hiding and the UI must state that limitation directly.
- The final review found no remaining blocker or internal contradiction in the
  player flow, state machine, Agent contract, data ownership, retry boundaries,
  UI specification, acceptance criteria, or implementation decomposition.
- Gate 5 passes. Business-code implementation remains outside TASK-016 and must
  start with the separately owned journey domain/state-machine task.

## Handoff

### Files read

- `00_PROJECT_CONTEXT.md`
- `04_SOFTWARE_UPDATE_2026-08-01.md`
- `.loop/STATUS.md`
- `.loop/DECISIONS.md`
- `.loop/RISKS.md`
- `.loop/INTEGRATION_QUEUE.md`
- `.loop/tasks/TASK-016-agent-game-first-playable-design.md`
- `.loop/reports/concept-review-2026-08-02.md`
- `.loop/checklists/quality-redlines.md`
- Existing domain, Agent, artifact, recipient, app, data, shared UI, style, and
  relevant test files under `src/`

### Files written

- `.loop/claims/TASK-016--opencode-20260802-165704-task016.md` (resumed claim,
  completion evidence, and coordinator acceptance)
- `.loop/reports/TASK-016-agent-game-first-playable-design.md`

### Unresolved decisions

- None for the first offline vertical slice. Production persistence semantics for
  permanent hide remain intentionally out of scope rather than unresolved in
  this implementation.

### Recommended first implementation task

Create the journey domain and pure state machine only, with table-driven tests for
all transitions, terminal states, intensity monotonicity, invitation authorship,
relationship isolation, and false-completion prevention.

### Verification performed

- Required product and coordination sources were read in order.
- Existing implementation and test patterns were inspected for reuse and gaps.
- The report was checked against all 11 TASK-016 required deliverables and every
  acceptance criterion.
- `npm run verify` passed: 15 test files / 85 tests, typecheck, and production
  build passed.
- `git diff --check` passed; only existing line-ending warnings were emitted.

No business code, test code, package file, product context, decision, risk,
status, queue, or existing report was changed by TASK-016 report completion.
