import {
  createDefaultTriggerPolicy,
  isContextVisibleTo,
  type ContextItem,
  type GenerationMode,
  type GenerationPolicy,
  type SensitivityLevel,
  type TriggerPolicy,
  type TriggerReason,
  type V2Relationship,
} from '../../domain'
import { AgentError } from './errors'
import type {
  AgentGenerationAdapter,
  AgentOutputMode,
  AgentOwnerReviewPort,
  AgentRuntimeRepository,
  RecipientAgentRequest,
  RecipientAgentResult,
  RecipientScopedAgentPort,
} from './runtimeTypes'

const sensitivityRank: Record<SensitivityLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  restricted: 3,
}

export class RecipientScopedAgentRuntime implements RecipientScopedAgentPort {
  constructor(
    private readonly repository: AgentRuntimeRepository,
    private readonly generator: AgentGenerationAdapter,
    private readonly ownerReview: AgentOwnerReviewPort,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async run(request: RecipientAgentRequest): Promise<RecipientAgentResult> {
    const relationship = await this.requireRelationship(
      request.interaction.relationshipId,
    )
    this.requireActiveRecipientEntry(request, relationship)

    const generationPolicy = await this.requireGenerationPolicy(relationship.id)
    const triggerPolicy =
      (await this.repository.getTriggerPolicy(relationship.id)) ??
      createDefaultTriggerPolicy(relationship.id)
    const triggerReason = request.triggerReason ?? 'user_opened'
    this.requireAllowedTrigger(triggerPolicy, relationship.id, triggerReason)

    const mode = this.toGenerationMode(request.mode)
    if (!generationPolicy.allowedModes.includes(mode)) {
      throw new AgentError(
        'MODE_NOT_ALLOWED',
        `Mode ${request.mode} is not authorized for relationship ${relationship.id}.`,
      )
    }
    if (request.highRisk) {
      throw new AgentError(
        'HIGH_RISK_BLOCKED',
        'High-risk Agent output is blocked.',
      )
    }

    const sources = await this.requireSources(
      request.sourceContextIds,
      relationship,
      generationPolicy,
    )
    this.requireAllowedTopics(request.topic, sources, generationPolicy, mode)

    if (request.mode === 'source_replay') {
      return this.replay(request, relationship, sources, triggerReason)
    }
    if (mode === 'source_replay') {
      throw new AgentError('MODE_NOT_ALLOWED', 'Invalid generated output mode.')
    }

    const draft = await this.generator.generate({
      mode,
      topic: request.topic,
      sources,
    })
    if (
      !draft.content.trim() ||
      !Number.isFinite(draft.confidence) ||
      draft.confidence < 0 ||
      draft.confidence > 1
    ) {
      throw new AgentError(
        'INVALID_GENERATION_RESULT',
        'The generation adapter returned an invalid bounded result.',
      )
    }
    if (
      draft.containsNewFacts ||
      draft.makesMajorDecision ||
      draft.expressesUnreviewedIntent
    ) {
      throw new AgentError(
        'UNSAFE_GENERATION',
        'Generated output introduced a fact, major decision, or unreviewed intent.',
      )
    }

    const review = await this.ownerReview.review({
      relationship,
      mode: request.mode,
      sourceContextIds: sources.map(({ id }) => id),
      content: draft.content,
    })
    if (
      !review.approved ||
      review.reviewedByUserId !== relationship.ownerId ||
      !review.reviewedAt
    ) {
      throw new AgentError(
        'OWNER_REVIEW_REQUIRED',
        'Owner review is required before derived Agent output can be exposed.',
      )
    }

    return {
      relationshipId: relationship.id,
      recipientId: relationship.recipientId,
      interactionId: request.interaction.id,
      outputMode: request.mode,
      content: draft.content,
      provenance: {
        sourceContextIds: sources.map(({ id }) => id),
        sourceAssetIds: sources.map(({ originalAssetId }) => originalAssetId),
        generationMode: mode,
        aiGenerated: true,
        model: draft.model,
        createdAt: this.now(),
      },
      aiLabel: 'AI-generated',
      confidence: draft.confidence,
      sensitivity: this.highestSensitivity(sources),
      triggerReason,
      ownerReview: {
        reviewedByUserId: review.reviewedByUserId,
        reviewedAt: review.reviewedAt,
      },
    }
  }

  private async requireRelationship(id: string): Promise<V2Relationship> {
    const relationship = await this.repository.getRelationship(id)
    if (!relationship) {
      throw new AgentError(
        'RELATIONSHIP_NOT_FOUND',
        `Relationship ${id} does not exist or is not a V2 relationship.`,
      )
    }
    if (relationship.contractVersion !== 2) {
      throw new AgentError(
        'RELATIONSHIP_VERSION_UNSUPPORTED',
        `Relationship ${id} is not supported by the V2 Agent runtime.`,
      )
    }
    if (relationship.status !== 'entrusted') {
      throw new AgentError(
        'RELATIONSHIP_NOT_AVAILABLE',
        `Relationship ${id} is not entrusted for recipient access.`,
      )
    }
    return relationship
  }

  private requireActiveRecipientEntry(
    request: RecipientAgentRequest,
    relationship: V2Relationship,
  ): void {
    const { interaction } = request
    if (
      interaction.relationshipId !== relationship.id ||
      interaction.recipientId !== relationship.recipientId
    ) {
      throw new AgentError(
        'INTERACTION_SCOPE_MISMATCH',
        'The interaction does not belong to this relationship and recipient.',
      )
    }
    if (!interaction.initiatedByRecipient || interaction.completedAt !== undefined) {
      throw new AgentError(
        'RECIPIENT_ENTRY_REQUIRED',
        'An active recipient-initiated entry is required.',
      )
    }
  }

  private async requireGenerationPolicy(
    relationshipId: string,
  ): Promise<GenerationPolicy> {
    const policy = await this.repository.getGenerationPolicy(relationshipId)
    if (!policy) {
      throw new AgentError(
        'GENERATION_POLICY_NOT_FOUND',
        `No generation policy exists for relationship ${relationshipId}.`,
      )
    }
    if (policy.relationshipId !== relationshipId) {
      throw new AgentError(
        'POLICY_SCOPE_MISMATCH',
        'The generation policy belongs to a different relationship.',
      )
    }
    return policy
  }

  private requireAllowedTrigger(
    policy: TriggerPolicy,
    relationshipId: string,
    reason: TriggerReason,
  ): void {
    if (policy.relationshipId !== relationshipId) {
      throw new AgentError(
        'POLICY_SCOPE_MISMATCH',
        'The trigger policy belongs to a different relationship.',
      )
    }
    const pullAllowed = policy.mode === 'pull_only' && reason === 'user_opened'
    const optedInTrigger =
      policy.mode !== 'pull_only' &&
      policy.optedIn &&
      policy.allowedReasons.includes(reason)
    if (!pullAllowed && !optedInTrigger) {
      throw new AgentError(
        'TRIGGER_NOT_ALLOWED',
        `Trigger ${reason} is not authorized by the relationship policy.`,
      )
    }
  }

  private async requireSources(
    sourceIds: readonly string[],
    relationship: V2Relationship,
    policy: GenerationPolicy,
  ): Promise<ContextItem[]> {
    const uniqueIds = [...new Set(sourceIds)]
    if (uniqueIds.length === 0) {
      throw new AgentError('SOURCE_REQUIRED', 'Agent output requires a source.')
    }

    const sources = await Promise.all(
      uniqueIds.map((id) => this.repository.getContext(id)),
    )
    if (sources.some((source) => !source)) {
      throw new AgentError('SOURCE_NOT_FOUND', 'A requested source does not exist.')
    }

    return (sources as ContextItem[]).map((source) => {
      if (source.visibility === 'private') {
        throw new AgentError(
          'PRIVATE_SOURCE',
          `Context ${source.id} is private.`,
        )
      }
      if (!isContextVisibleTo(source, relationship, relationship.recipientId)) {
        throw new AgentError(
          'CROSS_RELATIONSHIP_SOURCE',
          `Context ${source.id} is outside the active recipient relationship.`,
        )
      }
      if (!policy.allowedContextIds.includes(source.id)) {
        throw new AgentError(
          'SOURCE_NOT_ALLOWED',
          `Context ${source.id} is not approved by the generation policy.`,
        )
      }
      return source
    })
  }

  private requireAllowedTopics(
    topic: string,
    sources: readonly ContextItem[],
    policy: GenerationPolicy,
    mode: GenerationMode,
  ): void {
    const normalized = this.normalize(topic)
    const forbidden = policy.forbiddenTopics.map((item) => this.normalize(item))
    const sourceTopics = sources.map(({ topic: sourceTopic }) =>
      this.normalize(sourceTopic),
    )
    if (
      forbidden.includes(normalized) ||
      sourceTopics.some((sourceTopic) => forbidden.includes(sourceTopic))
    ) {
      throw new AgentError('FORBIDDEN_TOPIC', `Topic ${topic} is forbidden.`)
    }
    if (
      mode !== 'source_replay' &&
      !policy.allowedTopics.map((item) => this.normalize(item)).includes(normalized)
    ) {
      throw new AgentError(
        'TOPIC_NOT_ALLOWED',
        `Topic ${topic} is not authorized for generation.`,
      )
    }
  }

  private async replay(
    request: RecipientAgentRequest,
    relationship: V2Relationship,
    sources: readonly ContextItem[],
    triggerReason: TriggerReason,
  ): Promise<RecipientAgentResult> {
    if (sources.length !== 1) {
      throw new AgentError(
        'SOURCE_NOT_ALLOWED',
        'Source replay requires exactly one approved context.',
      )
    }
    const source = sources[0]
    const asset = await this.repository.getOriginalAsset(source.originalAssetId)
    if (!asset || asset.contextId !== source.id) {
      throw new AgentError(
        'ORIGINAL_ASSET_NOT_FOUND',
        `Original asset for context ${source.id} is unavailable.`,
      )
    }

    return {
      relationshipId: relationship.id,
      recipientId: relationship.recipientId,
      interactionId: request.interaction.id,
      outputMode: 'source_replay',
      content: asset.uri,
      provenance: {
        sourceContextIds: [source.id],
        sourceAssetIds: [asset.id],
        generationMode: 'source_replay',
        aiGenerated: false,
        createdAt: this.now(),
      },
      aiLabel: 'Original source',
      sensitivity: source.sensitivityLevel,
      triggerReason,
    }
  }

  private toGenerationMode(mode: AgentOutputMode): GenerationMode {
    if (mode === 'source_replay' || mode === 'source_composition') return mode
    if (mode === 'bounded_persona_inference') return 'persona_inference'
    throw new AgentError('MODE_NOT_ALLOWED', `Unknown Agent mode: ${String(mode)}.`)
  }

  private highestSensitivity(sources: readonly ContextItem[]): SensitivityLevel {
    return sources.reduce<SensitivityLevel>(
      (highest, source) =>
        sensitivityRank[source.sensitivityLevel] > sensitivityRank[highest]
          ? source.sensitivityLevel
          : highest,
      'low',
    )
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase()
  }
}
