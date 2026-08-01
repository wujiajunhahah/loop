import type {
  ContextItem,
  EntityId,
  GenerationPolicy,
  Interaction,
  InteractionArtifact,
  OriginalAsset,
  Provenance,
  V2Relationship,
} from '../../domain'

export interface RecipientAuthoredResponse {
  content: string
  authorId: EntityId
  authorRole: 'recipient'
}

export interface RecipientResponseAttribution {
  authorId: EntityId
  authorRole: 'recipient'
  eligibleAsRecorderContext: false
}

export interface SourceBackedInteractionArtifact extends InteractionArtifact {
  generatedSummary: string
  generationLabel: 'AI-generated' | 'Original source'
  provenance: Provenance
  recipientResponseAttribution?: RecipientResponseAttribution
}

export interface CreateInteractionArtifactInput {
  interaction: Interaction
  relationship: V2Relationship
  policy: GenerationPolicy
  contexts: readonly ContextItem[]
  originalAssets?: readonly OriginalAsset[]
  type?: InteractionArtifact['type']
  recipientResponse?: RecipientAuthoredResponse
}
