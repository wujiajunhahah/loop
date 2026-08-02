import type {
  ContextItem,
  EntityId,
  GenerationPolicy,
  Provenance,
  RecipientSession,
  SensitivityLevel,
  V2Relationship,
} from '../../../domain'
import type { RecipientAgentResult } from '../../agent'
import type { SourceBackedInteractionArtifact } from '../../artifact'

export type JourneyIntensity = 'quiet' | 'glimmer' | 'deep'
export type JourneyActionKind = 'recorder_invitation' | 'neutral_fallback'
export type JourneyOutputMode = 'source_replay' | 'source_composition'

export type JourneyState =
  | 'map_ready'
  | 'intensity_selected'
  | 'proposal_inspected'
  | 'action_accepted'
  | 'action_completed'
  | 'memory_opened'
  | 'response_recorded'
  | 'postcard_creating'
  | 'postcard_created'
  | 'node_lit'
  | 'skipped'
  | 'stopped'
  | 'rejected'
  | 'hidden'
  | 'closed'

export type JourneyTerminalState = Extract<
  JourneyState,
  'node_lit' | 'skipped' | 'stopped' | 'rejected' | 'hidden' | 'closed'
>

export interface ApprovedJourneyInvitation {
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

export type JourneyActionAuthorship =
  | {
      kind: 'recorder'
      authoredByUserId: EntityId
      approvedInvitationId: EntityId
    }
  | {
      kind: 'loop'
      fixtureId: 'fallback-rain-window-v1'
    }

export interface JourneyAction {
  id: EntityId
  kind: JourneyActionKind
  text: string
  authorship: JourneyActionAuthorship
  sourceContextIds: readonly EntityId[]
  aiGenerated: false
}

export interface JourneySourceSelection {
  sourceContextIds: readonly EntityId[]
  sourceAssetIds: readonly EntityId[]
  selectionReason: string
  requestedModes: readonly JourneyOutputMode[]
  sensitivity: SensitivityLevel
}

export interface JourneyProposal {
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

export interface JourneyProposalRequest {
  relationshipId: EntityId
  recipientId: EntityId
  recipientSession: RecipientSession
  intensity: JourneyIntensity
  triggerReason: 'user_opened'
  candidateContextIds: readonly EntityId[]
}

export type JourneyFallbackReason =
  | 'no_approved_recorder_invitation'
  | 'invitation_source_unavailable'
  | 'recipient_chose_neutral_action'
  | 'intensity_reduced'

export interface JourneyProposalResult {
  proposal: JourneyProposal
  fallbackReason?: JourneyFallbackReason
  proposalProvenance: Provenance
}

export interface JourneyPresentation {
  interactionId: EntityId
  original: RecipientAgentResult & { outputMode: 'source_replay' }
  composition?: RecipientAgentResult & { outputMode: 'source_composition' }
}

export interface JourneyPostcardView {
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

export interface JourneyRecipientResponse {
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

export interface JourneySession {
  id: EntityId
  proposalId: EntityId
  recipientSessionId: EntityId
  relationshipId: EntityId
  recipientId: EntityId
  interactionId: EntityId
  intensity: JourneyIntensity
  state: JourneyState
  selectedActionId?: EntityId
  sourceContextIds?: readonly EntityId[]
  sourceAssetIds?: readonly EntityId[]
  requestedModes?: readonly JourneyOutputMode[]
  presentationProvenance?: Provenance
  presentationGenerationLabel?: 'Original source' | 'AI-generated'
  presentationContent?: string
  responseId?: EntityId
  responseKind?: JourneyRecipientResponse['kind']
  responseContent?: string
  artifactId?: EntityId
  artifactRequestedAt?: string
  startedAt: string
  updatedAt: string
  terminalAt?: string
  completedAt?: string
}

export interface EchoMapNodeState {
  nodeId: EntityId
  relationshipId: EntityId
  recipientId: EntityId
  status: 'available' | 'lit' | 'hidden' | 'rejected'
  journeySessionId?: EntityId
  artifactId?: EntityId
  updatedAt: string
}

export type JourneyEvent =
  | { type: 'SELECT_INTENSITY'; intensity: JourneyIntensity; at: string }
  | { type: 'INSPECT_PROPOSAL'; at: string }
  | {
      type: 'ACCEPT_ACTION'
      proposal: JourneyProposal
      action: JourneyAction
      generationPolicy: GenerationPolicy
      invitationValidation?: InvitationValidationInput
      at: string
    }
  | { type: 'SKIP'; at: string }
  | { type: 'REJECT'; at: string }
  | { type: 'HIDE'; confirmed: boolean; at: string }
  | { type: 'STOP'; at: string }
  | { type: 'CLOSE'; at: string }
  | { type: 'COMPLETE_ACTION'; at: string }
  | {
      type: 'OPEN_MEMORY'
      presentation: JourneyPresentation
      relationship: V2Relationship
      generationPolicy: GenerationPolicy
      contexts: readonly ContextItem[]
      at: string
    }
  | { type: 'SAVE_RESPONSE'; response: JourneyRecipientResponse; at: string }
  | { type: 'CREATE_POSTCARD'; requestedAt: string; at: string }
  | {
      type: 'POSTCARD_CREATED'
      artifact: SourceBackedInteractionArtifact
      at: string
    }
  | { type: 'POSTCARD_FAILED'; at: string }
  | { type: 'LIGHT_NODE'; completedAt: string; at: string }
  | { type: 'LIGHT_NODE_FAILED'; at: string }

export interface CompleteEchoMapNodeInput {
  journeySessionId: EntityId
  nodeId: EntityId
  artifactId: EntityId
  completedAt: string
}

export interface CompleteEchoMapNodeResult {
  session: JourneySession & { state: 'node_lit'; completedAt: string }
  node: EchoMapNodeState & { status: 'lit'; artifactId: EntityId }
  outcome: 'completed' | 'already_completed'
}

export interface InvitationValidationInput {
  invitation: ApprovedJourneyInvitation
  action: JourneyAction
  relationship: V2Relationship
  policy: GenerationPolicy
  contexts: readonly ContextItem[]
}

export interface ProposalRequestValidationInput {
  request: JourneyProposalRequest
  relationship: V2Relationship
  policy: GenerationPolicy
  contexts: readonly ContextItem[]
}
