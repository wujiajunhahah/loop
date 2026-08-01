import { applyRecipientChoice } from '../../domain'
import type {
  ContextItem,
  GenerationPolicy,
  Interaction,
  OriginalAsset,
  RecipientChoice,
  RecipientSession,
  TriggerPolicy,
  V2Relationship,
} from '../../domain'
import { InMemoryAgentRuntimeRepository, DeterministicAgentGenerationAdapter, DeterministicOwnerReviewAdapter } from '../../adapters/agent'
import { RecipientScopedAgentRuntime, type RecipientAgentResult } from '../agent'
import { InteractionArtifactService, type SourceBackedInteractionArtifact } from '../artifact'

export interface RecipientExperienceSnapshot {
  recipient: {
    id: string
    name: string
    subjectName: string
    relationshipId: string
    relationshipLabel: string
  }
  relationship: V2Relationship
  context: ContextItem
  asset: OriginalAsset
  generationPolicy: GenerationPolicy
}

export interface RecipientExperienceData {
  getSnapshot(): RecipientExperienceSnapshot
  createSession(): RecipientSession
  createInteraction(session: RecipientSession): Interaction
  loadPresentation(interaction: Interaction): Promise<{
    original: RecipientAgentResult
    derived?: RecipientAgentResult
  }>
  createArtifact(
    interaction: Interaction,
    output: RecipientAgentResult,
    response?: string,
  ): Promise<SourceBackedInteractionArtifact>
}

export const demoRecipient = {
  id: 'person-lin',
  name: 'Lin',
  subjectName: 'Mei',
  relationshipId: 'relationship-mei-lin',
  relationshipLabel: '母亲和女儿',
}

export const demoRelationship: V2Relationship = {
  contractVersion: 2,
  id: demoRecipient.relationshipId,
  subjectId: 'person-mei',
  ownerId: 'person-mei',
  recorderIds: ['person-mei'],
  recipientId: demoRecipient.id,
  label: demoRecipient.relationshipLabel,
  kind: 'parent_child',
  status: 'entrusted',
}

export const demoContext: ContextItem = {
  id: 'context-tomato-eggs',
  subjectId: 'person-mei',
  recorderId: 'person-mei',
  recipientId: demoRecipient.id,
  relationshipId: demoRecipient.relationshipId,
  sourceType: 'user_recorded',
  modality: 'audio',
  captureMode: 'guided',
  originalAssetId: 'asset-tomato-eggs',
  derivedContentIds: [],
  topic: 'The first family recipe',
  meaning: 'Mei explains why tomato and eggs always came first.',
  importanceWeight: 0.8,
  sensitivityLevel: 'low',
  visibility: 'relationship_specific',
  intendedScenarios: ['recipient_request'],
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z',
}

export const demoAsset: OriginalAsset = {
  id: 'asset-tomato-eggs',
  contextId: demoContext.id,
  modality: 'audio',
  uri: '/demo/mei-tomato-eggs.mp3',
  capturedAt: demoContext.createdAt,
}

export const demoGenerationPolicy: GenerationPolicy = {
  relationshipId: demoRelationship.id,
  allowedContextIds: [demoContext.id],
  allowedModes: ['source_replay', 'source_composition'],
  allowedTopics: [demoContext.topic],
  forbiddenTopics: [],
  sourceRequired: true,
  aiLabelRequired: true,
  highRiskBlocked: true,
  newFactsAllowed: false,
  majorDecisionsAllowed: false,
}

export const demoTriggerPolicy: TriggerPolicy = {
  relationshipId: demoRelationship.id,
  mode: 'pull_only',
  allowedReasons: ['user_opened'],
  optedIn: false,
}

export function createRecipientSession(): RecipientSession {
  return {
    id: 'session-demo',
    relationshipId: demoRecipient.relationshipId,
    recipientId: demoRecipient.id,
    initiatedByRecipient: true,
    status: 'active',
    startedAt: new Date().toISOString(),
  }
}

export function chooseRecipientAction(
  session: RecipientSession,
  choice: RecipientChoice,
) {
  return applyRecipientChoice(session, choice)
}

export function createRecipientInteraction(session: RecipientSession): Interaction {
  return {
    id: `interaction:${session.id}`,
    relationshipId: demoRelationship.id,
    recipientId: demoRecipient.id,
    initiatedByRecipient: session.initiatedByRecipient,
    startedAt: session.startedAt,
  }
}

const runtime = new RecipientScopedAgentRuntime(
  new InMemoryAgentRuntimeRepository(
    [demoRelationship],
    [demoContext],
    [demoAsset],
    [demoGenerationPolicy],
    [demoTriggerPolicy],
  ),
  new DeterministicAgentGenerationAdapter(),
  new DeterministicOwnerReviewAdapter({
    approved: true,
    reviewedByUserId: demoRelationship.ownerId,
    reviewedAt: '2026-08-02T12:00:00.000Z',
  }),
)

export const interactionArtifactService = new InteractionArtifactService()

export const standaloneRecipientData: RecipientExperienceData = {
  getSnapshot: () => ({
    recipient: demoRecipient,
    relationship: demoRelationship,
    context: demoContext,
    asset: demoAsset,
    generationPolicy: demoGenerationPolicy,
  }),
  createSession: createRecipientSession,
  createInteraction: createRecipientInteraction,
  loadPresentation: async (interaction) => loadRecipientPresentation(interaction),
  createArtifact: createRecipientArtifact,
}

export async function loadRecipientPresentation(
  interaction: Interaction,
): Promise<{ original: RecipientAgentResult; derived: RecipientAgentResult }> {
  const request = {
    interaction,
    sourceContextIds: [demoContext.id],
    topic: demoContext.topic,
    triggerReason: 'user_opened' as const,
  }
  const [original, derived] = await Promise.all([
    runtime.run({ ...request, mode: 'source_replay' }),
    runtime.run({ ...request, mode: 'source_composition' }),
  ])
  return { original, derived }
}

export async function createRecipientArtifact(
  interaction: Interaction,
  output: RecipientAgentResult,
  response?: string,
): Promise<SourceBackedInteractionArtifact> {
  const completedInteraction: Interaction = {
    ...interaction,
    completedAt: new Date().toISOString(),
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
  return interactionArtifactService.create({
    interaction: completedInteraction,
    relationship: demoRelationship,
    policy: demoGenerationPolicy,
    contexts: [demoContext],
    originalAssets: [demoAsset],
    type: 'postcard',
    ...(response?.trim()
      ? { recipientResponse: { content: response.trim(), authorId: demoRecipient.id, authorRole: 'recipient' as const } }
      : {}),
  })
}
