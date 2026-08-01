import type {
  AgentPolicy,
  Memory,
  Person,
  PlannedInteraction,
  Relationship,
  RecipientSession,
} from '../domain'

export const people: Person[] = [
  { id: 'person-mei', displayName: 'Mei' },
  { id: 'person-lin', displayName: 'Lin' },
]

export const relationships: Relationship[] = [
  {
    id: 'relationship-mei-lin',
    ownerId: 'person-mei',
    recipientId: 'person-lin',
    label: 'Mother and daughter',
    status: 'entrusted',
  },
]

export const memories: Memory[] = [
  {
    id: 'memory-tomato-eggs',
    ownerId: 'person-mei',
    relationshipId: 'relationship-mei-lin',
    recipientId: 'person-lin',
    topic: 'The first family recipe',
    meaning: 'A familiar weekday meal that Lin can make in her own kitchen.',
    visibility: 'relationship_specific',
    original: {
      kind: 'original',
      modality: 'audio',
      uri: '/demo/mei-tomato-eggs.mp3',
      capturedAt: '2026-07-20T10:00:00.000Z',
    },
    organized: {
      kind: 'ai_organized',
      text: 'Mei explains why tomato and eggs always came first.',
      sourceMemoryIds: ['memory-tomato-eggs'],
      reviewedByOwner: true,
    },
    createdAt: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'memory-private-note',
    ownerId: 'person-mei',
    topic: 'Private draft',
    meaning: 'Not approved for delivery.',
    visibility: 'private',
    original: {
      kind: 'original',
      modality: 'text',
      uri: 'memory://private-note',
      capturedAt: '2026-07-21T10:00:00.000Z',
    },
    createdAt: '2026-07-21T10:00:00.000Z',
  },
]

export const agentPolicies: AgentPolicy[] = [
  {
    relationshipId: 'relationship-mei-lin',
    allowAiOrganization: true,
    allowParaphrase: false,
    allowNewMemoryGeneration: false,
    allowedMemoryIds: ['memory-tomato-eggs'],
    blockedTopics: [],
    proactiveDelivery: 'after_recipient_entry',
  },
]

export const plannedInteractions: PlannedInteraction[] = [
  {
    id: 'plan-five-recipes',
    relationshipId: 'relationship-mei-lin',
    title: 'Five family recipes',
    invitation: 'Cook the first dish when you feel ready.',
    memoryIds: ['memory-tomato-eggs'],
    status: 'available',
  },
]

export const recipientSessions: RecipientSession[] = [
  {
    id: 'session-demo',
    relationshipId: 'relationship-mei-lin',
    recipientId: 'person-lin',
    initiatedByRecipient: true,
    status: 'active',
    startedAt: '2026-08-01T09:00:00.000Z',
  },
]
