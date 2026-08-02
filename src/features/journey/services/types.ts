import type {
  ContextItem,
  GenerationPolicy,
  OriginalAsset,
  RecipientSession,
  TriggerPolicy,
  V2Relationship,
} from '../../../domain'
import type { RecipientAgentRequest, RecipientAgentResult } from '../../agent'
import type {
  CreateInteractionArtifactInput,
  SourceBackedInteractionArtifact,
} from '../../artifact'
import type {
  EchoMapNodeState,
  JourneyIntensity,
  JourneyPresentation,
  JourneyProposal,
  JourneyRecipientResponse,
  JourneySession,
} from '../domain'

export interface JourneySourceSnapshot {
  relationship: V2Relationship
  context: ContextItem
  asset: OriginalAsset
  generationPolicy: GenerationPolicy
  triggerPolicy: TriggerPolicy
}

export interface JourneyArtifactPort {
  create(
    input: CreateInteractionArtifactInput,
  ): Promise<SourceBackedInteractionArtifact>
  get(id: string): Promise<SourceBackedInteractionArtifact | undefined>
}

export interface OfflineJourneyDependencies {
  getSourceSnapshot(): JourneySourceSnapshot
  runAgent(
    source: JourneySourceSnapshot,
    request: RecipientAgentRequest,
  ): Promise<RecipientAgentResult>
  artifacts: JourneyArtifactPort
  now(): string
}

export interface EchoMapJourneySnapshot {
  node: EchoMapNodeState
  proposal?: JourneyProposal
  session?: JourneySession
  presentation?: JourneyPresentation
  response?: JourneyRecipientResponse
  artifact?: SourceBackedInteractionArtifact
}

export type JourneyExit = 'skip' | 'stop' | 'reject' | 'hide' | 'close'

export interface EchoMapJourneyData {
  getJourneySnapshot(): EchoMapJourneySnapshot
  startJourney(recipientSession: RecipientSession): JourneySession
  selectJourneyIntensity(
    sessionId: string,
    intensity: JourneyIntensity,
  ): JourneySession
  inspectJourneyProposal(sessionId: string): JourneySession
  acceptJourneyAction(sessionId: string, actionId: string): JourneySession
  completeJourneyAction(sessionId: string): JourneySession
  loadJourneyMemory(sessionId: string): Promise<JourneyPresentation>
  saveJourneyResponse(sessionId: string, content?: string): JourneyRecipientResponse
  createJourneyPostcard(sessionId: string): Promise<SourceBackedInteractionArtifact>
  lightJourneyNode(sessionId: string): Promise<EchoMapNodeState>
  exitJourney(sessionId: string, exit: JourneyExit): JourneySession
}
