import {
  hasValidProvenance,
  isContextVisibleTo,
  type ContextItem,
  type EntityId,
  type Provenance,
} from '../../domain'
import { ArtifactError } from './errors'
import type {
  CreateInteractionArtifactInput,
  SourceBackedInteractionArtifact,
} from './types'

export class InteractionArtifactService {
  private readonly artifacts = new Map<EntityId, SourceBackedInteractionArtifact>()

  async create(
    input: CreateInteractionArtifactInput,
  ): Promise<SourceBackedInteractionArtifact> {
    const { interaction, relationship, policy } = input

    if (!interaction.completedAt) {
      throw new ArtifactError(
        'INTERACTION_INCOMPLETE',
        `Interaction ${interaction.id} must be completed before creating an artifact.`,
      )
    }
    if (!interaction.output) {
      throw new ArtifactError(
        'INTERACTION_OUTPUT_REQUIRED',
        `Interaction ${interaction.id} has no source-backed output.`,
      )
    }
    if (
      interaction.relationshipId !== relationship.id ||
      interaction.recipientId !== relationship.recipientId
    ) {
      throw new ArtifactError(
        'RELATIONSHIP_MISMATCH',
        'The interaction does not belong to the supplied relationship and recipient.',
      )
    }
    if (policy.relationshipId !== relationship.id) {
      throw new ArtifactError(
        'POLICY_MISMATCH',
        'The generation policy does not belong to the supplied relationship.',
      )
    }

    const provenance = interaction.output.provenance
    if (!hasValidProvenance(provenance)) {
      throw new ArtifactError(
        'SOURCE_PROVENANCE_INVALID',
        'The completed interaction output has invalid source provenance.',
      )
    }
    if (!policy.allowedModes.includes(provenance.generationMode)) {
      throw new ArtifactError(
        'GENERATION_MODE_NOT_APPROVED',
        `Generation mode ${provenance.generationMode} is not approved.`,
      )
    }

    const contexts = this.validateSources(input, provenance)
    const recipientResponse = this.validateRecipientResponse(input)
    const originalQuoteAssetId = provenance.sourceAssetIds.find((assetId) =>
      contexts.some((context) => context.originalAssetId === assetId),
    )
    const artifactProvenance = Object.freeze({
      ...provenance,
      sourceContextIds: Object.freeze([...provenance.sourceContextIds]),
      sourceAssetIds: Object.freeze([...provenance.sourceAssetIds]),
    })

    const artifact: SourceBackedInteractionArtifact = Object.freeze({
      id: `artifact:${interaction.id}`,
      interactionId: interaction.id,
      relationshipId: relationship.id,
      recipientId: relationship.recipientId,
      type: input.type ?? 'postcard',
      sourceContextIds: artifactProvenance.sourceContextIds,
      generatedSummary: interaction.output.content,
      ...(originalQuoteAssetId ? { originalQuoteAssetId } : {}),
      createdAt: interaction.completedAt,
      ...(recipientResponse ? { recipientResponse: recipientResponse.content } : {}),
      saved: true,
      generationLabel: provenance.aiGenerated ? 'AI-generated' : 'Original source',
      provenance: artifactProvenance,
      ...(recipientResponse
        ? {
            recipientResponseAttribution: Object.freeze({
              authorId: recipientResponse.authorId,
              authorRole: 'recipient' as const,
              eligibleAsRecorderContext: false as const,
            }),
          }
        : {}),
    })

    this.artifacts.set(artifact.id, artifact)
    return artifact
  }

  async get(id: EntityId): Promise<SourceBackedInteractionArtifact | undefined> {
    return this.artifacts.get(id)
  }

  async getProvenance(id: EntityId): Promise<Provenance | undefined> {
    return this.artifacts.get(id)?.provenance
  }

  private validateSources(
    input: CreateInteractionArtifactInput,
    provenance: Provenance,
  ): readonly ContextItem[] {
    if (
      provenance.sourceContextIds.length === 0 ||
      provenance.sourceContextIds.some(
        (contextId) => !input.policy.allowedContextIds.includes(contextId),
      )
    ) {
      throw new ArtifactError(
        'NO_APPROVED_SOURCE',
        'Artifact creation requires every source Context ID to be approved by policy.',
      )
    }

    const contextById = new Map(input.contexts.map((context) => [context.id, context]))
    const contexts = provenance.sourceContextIds.map((contextId) => {
      const context = contextById.get(contextId)
      if (!context) {
        throw new ArtifactError(
          'SOURCE_NOT_FOUND',
          `Approved source Context ${contextId} was not supplied.`,
        )
      }
      if (!isContextVisibleTo(context, input.relationship, input.interaction.recipientId)) {
        throw new ArtifactError(
          'SOURCE_NOT_VISIBLE',
          `Source Context ${contextId} is not visible to this interaction recipient.`,
        )
      }
      return context
    })

    if (provenance.generationMode !== 'source_replay') {
      const unapprovedTopic = contexts.find(
        (context) =>
          input.policy.forbiddenTopics.includes(context.topic) ||
          !input.policy.allowedTopics.includes(context.topic),
      )
      if (unapprovedTopic) {
        throw new ArtifactError(
          'SOURCE_TOPIC_NOT_APPROVED',
          `Source Context ${unapprovedTopic.id} has a topic that is not approved for composition.`,
        )
      }
    }

    const sourceAssetIds = new Set(contexts.map((context) => context.originalAssetId))
    if (provenance.sourceAssetIds.some((assetId) => !sourceAssetIds.has(assetId))) {
      throw new ArtifactError(
        'SOURCE_PROVENANCE_INVALID',
        'Source asset provenance must refer to an approved source Context.',
      )
    }
    if (input.originalAssets) {
      const assetsById = new Map(input.originalAssets.map((asset) => [asset.id, asset]))
      const invalidAsset = provenance.sourceAssetIds.find((assetId) => {
        const asset = assetsById.get(assetId)
        return !asset || !provenance.sourceContextIds.includes(asset.contextId)
      })
      if (invalidAsset) {
        throw new ArtifactError(
          'SOURCE_PROVENANCE_INVALID',
          `Source asset ${invalidAsset} does not belong to an approved source Context.`,
        )
      }
    }

    return contexts
  }

  private validateRecipientResponse(
    input: CreateInteractionArtifactInput,
  ): CreateInteractionArtifactInput['recipientResponse'] {
    const response = input.recipientResponse
    if (!response) return undefined
    if (
      response.authorRole !== 'recipient' ||
      response.authorId !== input.interaction.recipientId ||
      response.content.trim().length === 0
    ) {
      throw new ArtifactError(
        'RECIPIENT_RESPONSE_AUTHOR_INVALID',
        'Recipient response must be non-empty and authored by the interaction recipient.',
      )
    }
    return response
  }
}
