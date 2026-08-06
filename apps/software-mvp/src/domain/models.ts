export type EntityId = string

export interface Person {
  id: EntityId
  displayName: string
}

export interface Relationship {
  id: EntityId
  ownerId: EntityId
  recipientId: EntityId
  label: string
  status: 'draft' | 'active' | 'entrusted' | 'closed'
}

export type MemoryVisibility =
  | 'public_persona'
  | 'relationship_specific'
  | 'private'

export type MemoryModality = 'text' | 'audio' | 'image' | 'video'

export interface OriginalContent {
  kind: 'original'
  modality: MemoryModality
  uri: string
  capturedAt: string
  text?: string
  checksum?: string
}

export interface OrganizedContent {
  kind: 'ai_organized'
  text: string
  sourceMemoryIds: EntityId[]
  reviewedByOwner: boolean
}

export interface DeviceInteractionProfileProvenance {
  profileId?: string
  sourceReference?: string
  validation?: 'fixture_only' | 'physical_device'
  model?: string
  firmware?: string
}

export interface MemoryTriggerProvenance {
  kind: 'device_interaction'
  eventId: string
  interaction: 'mark_moment' | 'touch'
  deviceId: string
  deviceName: string
  source: 'physical' | 'simulated'
  occurredAt: string
  verification: 'binding_verified' | 'entrustment_verified'
  ownerId: EntityId
  recipientId?: EntityId
  sessionId: string
  sessionSequence?: number
  profile?: DeviceInteractionProfileProvenance
}

export interface Memory {
  id: EntityId
  ownerId: EntityId
  relationshipId?: EntityId
  recipientId?: EntityId
  topic: string
  meaning: string
  visibility: MemoryVisibility
  original: OriginalContent
  trigger?: MemoryTriggerProvenance
  organized?: OrganizedContent
  createdAt: string
}

export type RecipientChoice = 'accept' | 'postpone' | 'skip' | 'close'

export interface PlannedInteraction {
  id: EntityId
  relationshipId: EntityId
  title: string
  invitation: string
  memoryIds: EntityId[]
  status: 'available' | 'accepted' | 'postponed' | 'skipped' | 'closed'
}

export interface AgentPolicy {
  relationshipId: EntityId
  allowAiOrganization: boolean
  allowParaphrase: boolean
  allowNewMemoryGeneration: false
  allowedMemoryIds: EntityId[]
  blockedTopics: string[]
  proactiveDelivery: 'never' | 'after_recipient_entry'
}

export type HardwareEventType =
  | 'mark_moment'
  | 'touch'
  | 'wear'
  | 'confirm'
  | 'dismiss'

export interface HardwareEvent {
  id: EntityId
  bridgeId: string
  type: HardwareEventType
  occurredAt: string
  actorId?: EntityId
  context?: Readonly<Record<string, string | number | boolean>>
}

export interface RecipientSession {
  id: EntityId
  relationshipId: EntityId
  recipientId: EntityId
  initiatedByRecipient: boolean
  status: 'active' | 'postponed' | 'skipped' | 'closed'
  startedAt: string
  trigger?: MemoryTriggerProvenance
  lastChoice?: RecipientChoice
}

export interface AgentPresentation {
  relationshipId: EntityId
  memoryIds: EntityId[]
  headline: string
  provenance: 'original' | 'ai_organized'
}
