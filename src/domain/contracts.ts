import type { EntityId, V2Relationship } from './models'

export type ActorRole = 'subject' | 'recorder' | 'recipient' | 'buyer'

export interface User {
  id: EntityId
  displayName: string
  roles: readonly ActorRole[]
}

export type ContextVisibility =
  | 'public_context'
  | 'relationship_specific'
  | 'private'
export type ContextModality = 'text' | 'audio' | 'image' | 'video'
export type CaptureMode = 'guided' | 'direct' | 'imported' | 'passive'
export type SensitivityLevel = 'low' | 'medium' | 'high' | 'restricted'

export interface OriginalAsset {
  id: EntityId
  contextId: EntityId
  modality: ContextModality
  uri: string
  capturedAt: string
  checksum?: string
}

export type GenerationMode =
  | 'source_replay'
  | 'source_composition'
  | 'persona_inference'

export interface Provenance {
  sourceContextIds: readonly EntityId[]
  sourceAssetIds: readonly EntityId[]
  generationMode: GenerationMode
  aiGenerated: boolean
  model?: string
  createdAt: string
}

export type DerivedContentKind =
  | 'transcript'
  | 'summary'
  | 'relationship_composition'
  | 'persona_response'

export interface DerivedContent {
  id: EntityId
  contextId: EntityId
  kind: DerivedContentKind
  content: string
  provenance: Provenance
  reviewedByUserId?: EntityId
  reviewedAt?: string
}

export interface ContextItem {
  id: EntityId
  subjectId: EntityId
  recorderId: EntityId
  recipientId?: EntityId
  relationshipId?: EntityId
  sourceType: 'user_recorded' | 'user_written' | 'user_uploaded' | 'authorized_data'
  modality: ContextModality
  captureMode: CaptureMode
  originalAssetId: EntityId
  derivedContentIds: readonly EntityId[]
  topic: string
  meaning: string
  emotionLabel?: string
  emotionIntensity?: number
  importanceWeight: number
  sensitivityLevel: SensitivityLevel
  visibility: ContextVisibility
  intendedScenarios: readonly string[]
  createdAt: string
  updatedAt: string
}

export interface GenerationPolicy {
  relationshipId: EntityId
  allowedContextIds: readonly EntityId[]
  allowedModes: readonly GenerationMode[]
  allowedTopics: readonly string[]
  forbiddenTopics: readonly string[]
  sourceRequired: true
  aiLabelRequired: true
  highRiskBlocked: true
  newFactsAllowed: false
  majorDecisionsAllowed: false
}

export type TriggerMode =
  | 'pull_only'
  | 'scheduled_opt_in'
  | 'contextual_suggestion'
  | 'proactive_allowed'

export type TriggerReason =
  | 'user_opened'
  | 'scheduled_date'
  | 'milestone'
  | 'weather_context'
  | 'location_context'
  | 'plan_progress'

export interface TriggerPolicy {
  relationshipId: EntityId
  mode: TriggerMode
  allowedReasons: readonly TriggerReason[]
  optedIn: boolean
}

export type InteractionOutputType = 'original' | 'composition' | 'bounded_response'

export interface InteractionOutput {
  outputType: InteractionOutputType
  content: string
  provenance: Provenance
  confidence?: number
  sensitivity: SensitivityLevel
  triggerReason: TriggerReason
  userControls: readonly ('replay' | 'save' | 'skip' | 'close')[]
}

export interface Interaction {
  id: EntityId
  relationshipId: EntityId
  recipientId: EntityId
  initiatedByRecipient: boolean
  startedAt: string
  completedAt?: string
  output?: InteractionOutput
}

export interface InteractionArtifact {
  id: EntityId
  interactionId: EntityId
  relationshipId: EntityId
  recipientId: EntityId
  type: 'postcard' | 'letter' | 'memory_card'
  sourceContextIds: readonly EntityId[]
  generatedSummary?: string
  originalQuoteAssetId?: EntityId
  createdAt: string
  recipientResponse?: string
  saved: boolean
}

export interface FeedbackPreference {
  recipientId: EntityId
  relationshipId: EntityId
  preferredModalities: readonly ContextModality[]
  interactionLength: 'short' | 'medium' | 'long'
  triggerMode: TriggerMode
  reducedTopics: readonly string[]
  continueSharedPlans: boolean
  updatedAt: string
}

export type EntryEventSource = 'software' | 'simulator' | 'nfc' | 'ble' | 'device'
export type EntryEventType = 'mark' | 'open' | 'confirm' | 'dismiss'

export interface EntryEvent {
  id: EntityId
  source: EntryEventSource
  type: EntryEventType
  occurredAt: string
  recipientId?: EntityId
  relationshipId?: EntityId
  payload: Readonly<Record<string, unknown>>
}

export function createDefaultGenerationPolicy(
  relationshipId: EntityId,
): GenerationPolicy {
  return {
    relationshipId,
    allowedContextIds: [],
    allowedModes: ['source_replay'],
    allowedTopics: [],
    forbiddenTopics: [],
    sourceRequired: true,
    aiLabelRequired: true,
    highRiskBlocked: true,
    newFactsAllowed: false,
    majorDecisionsAllowed: false,
  }
}

export function createDefaultTriggerPolicy(relationshipId: EntityId): TriggerPolicy {
  return {
    relationshipId,
    mode: 'pull_only',
    allowedReasons: ['user_opened'],
    optedIn: false,
  }
}

export function isValidRelationshipAssignment(
  relationship: V2Relationship,
  users: readonly User[],
): boolean {
  const byId = new Map(users.map((user) => [user.id, user]))
  const hasRole = (id: EntityId, role: ActorRole) =>
    byId.get(id)?.roles.includes(role) === true

  return (
    relationship.ownerId === relationship.subjectId &&
    relationship.subjectId !== relationship.recipientId &&
    hasRole(relationship.subjectId, 'subject') &&
    hasRole(relationship.recipientId, 'recipient') &&
    relationship.recorderIds.length > 0 &&
    relationship.recorderIds.every((id) => hasRole(id, 'recorder')) &&
    (relationship.buyerId === undefined || hasRole(relationship.buyerId, 'buyer'))
  )
}

export function isContextVisibleTo(
  context: ContextItem,
  relationship: V2Relationship,
  recipientId: EntityId,
): boolean {
  if (context.visibility === 'private') return false
  if (
    context.subjectId !== relationship.subjectId ||
    relationship.recipientId !== recipientId
  ) {
    return false
  }
  if (context.visibility === 'public_context') return true
  return (
    context.relationshipId === relationship.id && context.recipientId === recipientId
  )
}

export function hasValidProvenance(provenance: Provenance): boolean {
  if (provenance.sourceContextIds.length === 0) return false
  if (provenance.generationMode === 'source_replay') {
    return !provenance.aiGenerated && provenance.sourceAssetIds.length > 0
  }
  return provenance.aiGenerated
}

export function canGenerateFromSources(input: {
  policy: GenerationPolicy
  mode: GenerationMode
  topic: string
  sourceContextIds: readonly EntityId[]
  highRisk: boolean
}): boolean {
  const { policy } = input
  if (input.mode === 'source_replay') return false
  if (!policy.allowedModes.includes(input.mode)) return false
  if (input.highRisk && policy.highRiskBlocked) return false
  if (policy.forbiddenTopics.includes(input.topic)) return false
  if (!policy.allowedTopics.includes(input.topic)) return false
  return (
    input.sourceContextIds.length > 0 &&
    input.sourceContextIds.every((id) => policy.allowedContextIds.includes(id))
  )
}
