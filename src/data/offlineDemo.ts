import {
  DeterministicAgentGenerationAdapter,
  DeterministicOwnerReviewAdapter,
} from '../adapters/agent'
import type {
  ContextItem,
  DerivedContent,
  GenerationPolicy,
  Interaction,
  OriginalAsset,
  RecipientSession,
  RecipientPresentContext,
  Relationship,
  TriggerPolicy,
  V2Relationship,
} from '../domain'
import { RecipientScopedAgentRuntime, type AgentRuntimeRepository, type RecipientAgentResult } from '../features/agent'
import { InteractionArtifactService, type SourceBackedInteractionArtifact } from '../features/artifact'
import type {
  CaptureRelationship,
  GuidedCapturePort,
  ReviewedContextCapture,
} from '../features/capture/captureTypes'
import type { RecipientExperienceData, RecipientExperienceSnapshot } from '../features/recipient/session'
import {
  OfflineJourneyOrchestrator,
  type EchoMapJourneyData,
} from '../features/journey/services'

const demoRelationship: V2Relationship = {
  contractVersion: 2,
  id: 'relationship-mei-lin',
  subjectId: 'person-mei',
  ownerId: 'person-mei',
  recorderIds: ['person-mei'],
  recipientId: 'person-lin',
  buyerId: 'person-mei',
  label: 'Mother and daughter',
  kind: 'parent_child',
  status: 'entrusted',
}

const demoDirectory: readonly CaptureRelationship[] = [{
  relationship: demoRelationship,
  subject: { id: 'person-mei', displayName: 'Mei', roles: ['subject', 'recorder', 'buyer'] },
  recorders: [{ id: 'person-mei', displayName: 'Mei', roles: ['subject', 'recorder', 'buyer'] }],
  recipient: { id: 'person-lin', displayName: 'Lin', roles: ['recipient'] },
  buyer: { id: 'person-mei', displayName: 'Mei', roles: ['subject', 'recorder', 'buyer'] },
}]

const rainyDayContext: ContextItem = {
  id: 'context-rainy-day',
  subjectId: 'person-mei',
  recorderId: 'person-mei',
  recipientId: 'person-lin',
  relationshipId: demoRelationship.id,
  sourceType: 'user_written',
  modality: 'text',
  captureMode: 'guided',
  originalAssetId: 'asset-rainy-day',
  derivedContentIds: ['derived-rainy-day'],
  topic: 'The rainy walk home',
  meaning: 'Mei 记得 Lin 从小常忘记带伞，并叮嘱她淋湿后先把头发吹干，别着凉。',
  importanceWeight: 0.8,
  sensitivityLevel: 'low',
  visibility: 'relationship_specific',
  intendedScenarios: ['想念时'],
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
}

const rainyDayAsset: OriginalAsset = {
  id: 'asset-rainy-day',
  contextId: rainyDayContext.id,
  modality: 'text',
  uri: `data:text/plain;charset=utf-8,${encodeURIComponent('你从小就总忘带伞。以后遇到下雨，淋湿了回去先把头发吹干，别着凉。')}`,
  capturedAt: rainyDayContext.createdAt,
}

const rainyDayPolicy: GenerationPolicy = {
  relationshipId: demoRelationship.id,
  allowedContextIds: [rainyDayContext.id],
  allowedModes: ['source_replay', 'source_composition'],
  allowedTopics: [rainyDayContext.topic],
  forbiddenTopics: [],
  sourceRequired: true,
  aiLabelRequired: true,
  highRiskBlocked: true,
  newFactsAllowed: false,
  majorDecisionsAllowed: false,
}

const rainyDayTriggerPolicy: TriggerPolicy = {
  relationshipId: demoRelationship.id,
  mode: 'pull_only',
  allowedReasons: ['user_opened'],
  optedIn: false,
}

export class OfflineDemoService implements GuidedCapturePort, AgentRuntimeRepository, RecipientExperienceData, EchoMapJourneyData {
  private readonly contexts = new Map<string, ContextItem>()
  private readonly assets = new Map<string, OriginalAsset>()
  private readonly derived = new Map<string, DerivedContent>()
  private readonly generationPolicies = new Map<string, GenerationPolicy>()
  private readonly triggerPolicies = new Map<string, TriggerPolicy>()
  private artifactService = new InteractionArtifactService()
  private currentContextId = rainyDayContext.id
  private runtime = this.createRuntime()
  private journey!: OfflineJourneyOrchestrator

  constructor(private readonly now: () => string = () => new Date().toISOString()) {
    this.reset()
  }

  reset() {
    this.contexts.clear()
    this.assets.clear()
    this.derived.clear()
    this.generationPolicies.clear()
    this.triggerPolicies.clear()
    this.contexts.set(rainyDayContext.id, structuredClone(rainyDayContext))
    this.assets.set(rainyDayAsset.id, structuredClone(rainyDayAsset))
    this.generationPolicies.set(demoRelationship.id, structuredClone(rainyDayPolicy))
    this.triggerPolicies.set(demoRelationship.id, structuredClone(rainyDayTriggerPolicy))
    this.currentContextId = rainyDayContext.id
    this.artifactService = new InteractionArtifactService()
    this.runtime = this.createRuntime()
    this.journey = new OfflineJourneyOrchestrator({
      getSourceSnapshot: () => {
        return {
          relationship: structuredClone(demoRelationship),
          context: structuredClone(rainyDayContext),
          asset: structuredClone(rainyDayAsset),
          generationPolicy: structuredClone(rainyDayPolicy),
          triggerPolicy: structuredClone(rainyDayTriggerPolicy),
        }
      },
      runAgent: (source, request) =>
        new RecipientScopedAgentRuntime(
          {
            getRelationship: async (id) =>
              id === source.relationship.id ? source.relationship : undefined,
            getContext: async (id) =>
              id === source.context.id ? source.context : undefined,
            getOriginalAsset: async (id) =>
              id === source.asset.id ? source.asset : undefined,
            getGenerationPolicy: async (relationshipId) =>
              relationshipId === source.relationship.id
                ? source.generationPolicy
                : undefined,
            getTriggerPolicy: async (relationshipId) =>
              relationshipId === source.relationship.id
                ? source.triggerPolicy
                : undefined,
          },
          new DeterministicAgentGenerationAdapter(),
          new DeterministicOwnerReviewAdapter({
            approved: true,
            reviewedByUserId: source.relationship.ownerId,
            reviewedAt: '2026-08-02T12:00:00.000Z',
          }),
          this.now,
        ).run(request),
      artifacts: this.artifactService,
      now: this.now,
    })
  }

  async listRelationships() {
    return structuredClone(demoDirectory)
  }

  async saveReviewedCapture(input: ReviewedContextCapture) {
    const relationship = demoDirectory.find(({ relationship: item }) => item.id === input.context.relationshipId)
    if (
      !relationship ||
      input.context.subjectId !== relationship.relationship.subjectId ||
      input.context.recipientId !== relationship.relationship.recipientId ||
      !relationship.relationship.recorderIds.includes(input.context.recorderId)
    ) {
      throw new Error('Context relationship and recipient scope do not match.')
    }
    if (
      input.originalAsset.contextId !== input.context.id ||
      input.originalAsset.id !== input.context.originalAssetId
    ) {
      throw new Error('Original asset does not match its Context.')
    }
    if (
      input.generationPolicy.relationshipId !== relationship.relationship.id ||
      input.triggerPolicy.relationshipId !== relationship.relationship.id ||
      !input.generationPolicy.allowedContextIds.includes(input.context.id)
    ) {
      throw new Error('Capture policies do not match their Context relationship.')
    }
    const reviewedIds = input.derivedContent.map((item) => {
      if (
        item.contextId !== input.context.id ||
        item.reviewedByUserId !== relationship.relationship.ownerId ||
        !item.reviewedAt ||
        !item.provenance.sourceContextIds.includes(input.context.id) ||
        !item.provenance.sourceAssetIds.includes(input.originalAsset.id)
      ) {
        throw new Error('AI suggestions require explicit owner review and provenance.')
      }
      return item.id
    })
    if (
      reviewedIds.length !== input.context.derivedContentIds.length ||
      reviewedIds.some((id) => !input.context.derivedContentIds.includes(id))
    ) {
      throw new Error('Only reviewed AI suggestions may be attached to a Context.')
    }

    const context = structuredClone(input.context)
    this.contexts.set(context.id, context)
    this.assets.set(input.originalAsset.id, structuredClone(input.originalAsset))
    input.derivedContent.forEach((item) => this.derived.set(item.id, structuredClone(item)))
    this.generationPolicies.set(input.generationPolicy.relationshipId, structuredClone(input.generationPolicy))
    this.triggerPolicies.set(input.triggerPolicy.relationshipId, structuredClone(input.triggerPolicy))
    this.currentContextId = context.id
    return structuredClone(context)
  }

  getSnapshot(): RecipientExperienceSnapshot {
    const context = this.contexts.get(this.currentContextId)
    const asset = context ? this.assets.get(context.originalAssetId) : undefined
    const policy = this.generationPolicies.get(demoRelationship.id)
    if (!context || !asset || !policy) throw new Error('Offline Demo Context is unavailable.')
    return {
      recipient: {
        id: demoRelationship.recipientId,
        name: 'Lin',
        subjectName: 'Mei',
        relationshipId: demoRelationship.id,
        relationshipLabel: demoRelationship.label,
      },
      relationship: structuredClone(demoRelationship),
      context: structuredClone(context),
      asset: structuredClone(asset),
      generationPolicy: structuredClone(policy),
    }
  }

  createSession(): RecipientSession {
    return {
      id: 'session-demo',
      relationshipId: demoRelationship.id,
      recipientId: demoRelationship.recipientId,
      initiatedByRecipient: true,
      status: 'active',
      startedAt: this.now(),
    }
  }

  createInteraction(
    session: RecipientSession,
    presentInput?: Pick<RecipientPresentContext, 'modality' | 'content'>,
  ): Interaction {
    return {
      id: `interaction:${session.id}`,
      relationshipId: session.relationshipId,
      recipientId: session.recipientId,
      initiatedByRecipient: session.initiatedByRecipient,
      startedAt: session.startedAt,
      ...(presentInput
        ? {
            presentContext: {
              id: `present-context:${session.id}`,
              recipientId: session.recipientId,
              modality: presentInput.modality,
              content: presentInput.content.trim(),
              createdAt: this.now(),
              authorRole: 'recipient' as const,
              eligibleAsRecorderContext: false as const,
            },
          }
        : {}),
    }
  }

  async loadPresentation(interaction: Interaction) {
    const { context, generationPolicy } = this.getSnapshot()
    const request = {
      interaction,
      sourceContextIds: [context.id],
      topic: context.topic,
      triggerReason: 'user_opened' as const,
    }
    const original = await this.runtime.run({ ...request, mode: 'source_replay' })
    const derived = generationPolicy.allowedModes.includes('source_composition')
      ? await this.runtime.run({ ...request, mode: 'source_composition' })
      : undefined
    return { original, derived }
  }

  async createArtifact(
    interaction: Interaction,
    output: RecipientAgentResult,
    response?: string,
  ): Promise<SourceBackedInteractionArtifact> {
    const { relationship, context, asset, generationPolicy, recipient } = this.getSnapshot()
    const completedInteraction: Interaction = {
      ...interaction,
      completedAt: this.now(),
      output: {
        outputType: output.outputMode === 'source_replay' ? 'original' : 'composition',
        content: output.content,
        provenance: output.provenance,
        confidence: output.confidence,
        sensitivity: output.sensitivity,
        triggerReason: output.triggerReason,
        userControls: ['replay', 'save', 'skip', 'close'],
      },
    }
    return this.artifactService.create({
      interaction: completedInteraction,
      relationship,
      policy: generationPolicy,
      contexts: [context],
      originalAssets: [asset],
      type: 'postcard',
      ...(response?.trim()
        ? { recipientResponse: { content: response.trim(), authorId: recipient.id, authorRole: 'recipient' as const } }
        : {}),
    })
  }

  async getRelationship(id: string): Promise<Relationship | undefined> {
    return id === demoRelationship.id ? demoRelationship : undefined
  }

  async getContext(id: string) {
    return this.contexts.get(id)
  }

  async getOriginalAsset(id: string) {
    return this.assets.get(id)
  }

  async getGenerationPolicy(relationshipId: string) {
    return this.generationPolicies.get(relationshipId)
  }

  async getTriggerPolicy(relationshipId: string) {
    return this.triggerPolicies.get(relationshipId)
  }

  getJourneySnapshot() {
    return this.journey.getJourneySnapshot()
  }

  startJourney(...args: Parameters<EchoMapJourneyData['startJourney']>) {
    return this.journey.startJourney(...args)
  }

  selectJourneyIntensity(...args: Parameters<EchoMapJourneyData['selectJourneyIntensity']>) {
    return this.journey.selectJourneyIntensity(...args)
  }

  inspectJourneyProposal(...args: Parameters<EchoMapJourneyData['inspectJourneyProposal']>) {
    return this.journey.inspectJourneyProposal(...args)
  }

  acceptJourneyAction(...args: Parameters<EchoMapJourneyData['acceptJourneyAction']>) {
    return this.journey.acceptJourneyAction(...args)
  }

  completeJourneyAction(...args: Parameters<EchoMapJourneyData['completeJourneyAction']>) {
    return this.journey.completeJourneyAction(...args)
  }

  loadJourneyMemory(...args: Parameters<EchoMapJourneyData['loadJourneyMemory']>) {
    return this.journey.loadJourneyMemory(...args)
  }

  saveJourneyResponse(...args: Parameters<EchoMapJourneyData['saveJourneyResponse']>) {
    return this.journey.saveJourneyResponse(...args)
  }

  createJourneyPostcard(...args: Parameters<EchoMapJourneyData['createJourneyPostcard']>) {
    return this.journey.createJourneyPostcard(...args)
  }

  lightJourneyNode(...args: Parameters<EchoMapJourneyData['lightJourneyNode']>) {
    return this.journey.lightJourneyNode(...args)
  }

  exitJourney(...args: Parameters<EchoMapJourneyData['exitJourney']>) {
    return this.journey.exitJourney(...args)
  }

  private createRuntime() {
    return new RecipientScopedAgentRuntime(
      this,
      new DeterministicAgentGenerationAdapter(),
      new DeterministicOwnerReviewAdapter({
        approved: true,
        reviewedByUserId: demoRelationship.ownerId,
        reviewedAt: '2026-08-02T12:00:00.000Z',
      }),
      this.now,
    )
  }
}

export const offlineDemoService = new OfflineDemoService()
