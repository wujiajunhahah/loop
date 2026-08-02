import type {
  ContextItem,
  EntityId,
  GenerationMode,
  GenerationPolicy,
  Interaction,
  OriginalAsset,
  Provenance,
  RecipientPresentContext,
  Relationship,
  SensitivityLevel,
  TriggerPolicy,
  TriggerReason,
  V2Relationship,
} from '../../domain'

export type AgentOutputMode =
  | 'source_replay'
  | 'source_composition'
  | 'bounded_persona_inference'

export interface RecipientAgentRequest {
  interaction: Interaction
  mode: AgentOutputMode
  sourceContextIds: readonly EntityId[]
  topic: string
  triggerReason?: TriggerReason
  highRisk?: boolean
}

export interface RecipientAgentResult {
  relationshipId: EntityId
  recipientId: EntityId
  interactionId: EntityId
  outputMode: AgentOutputMode
  content: string
  provenance: Provenance
  aiLabel: 'Original source' | 'AI-generated'
  confidence?: number
  sensitivity: SensitivityLevel
  triggerReason: TriggerReason
  ownerReview?: {
    reviewedByUserId: EntityId
    reviewedAt: string
  }
}

export interface AgentRuntimeRepository {
  getRelationship(id: EntityId): Promise<Relationship | undefined>
  getContext(id: EntityId): Promise<ContextItem | undefined>
  getOriginalAsset(id: EntityId): Promise<OriginalAsset | undefined>
  getGenerationPolicy(
    relationshipId: EntityId,
  ): Promise<GenerationPolicy | undefined>
  getTriggerPolicy(relationshipId: EntityId): Promise<TriggerPolicy | undefined>
}

export interface GeneratedDraft {
  content: string
  confidence: number
  containsNewFacts: boolean
  makesMajorDecision: boolean
  expressesUnreviewedIntent: boolean
  model?: string
}

export interface AgentGenerationAdapter {
  generate(input: {
    mode: Exclude<GenerationMode, 'source_replay'>
    topic: string
    sources: readonly ContextItem[]
    presentContext?: RecipientPresentContext
  }): Promise<GeneratedDraft>
}

export interface OwnerReviewDecision {
  approved: boolean
  reviewedByUserId?: EntityId
  reviewedAt?: string
}

export interface AgentOwnerReviewPort {
  review(input: {
    relationship: V2Relationship
    mode: Exclude<AgentOutputMode, 'source_replay'>
    sourceContextIds: readonly EntityId[]
    content: string
  }): Promise<OwnerReviewDecision>
}

export interface RecipientScopedAgentPort {
  run(request: RecipientAgentRequest): Promise<RecipientAgentResult>
}
