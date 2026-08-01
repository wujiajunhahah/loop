import { describe, expect, it } from 'vitest'
import { InMemoryAgentContextRepository, MockRelationshipAgent } from '../../adapters/agent'
import type {
  AgentPolicy,
  Memory,
  PlannedInteraction,
  RecipientSession,
  Relationship,
} from '../../domain'
import { AgentPolicyEvaluator } from './AgentPolicyEvaluator'
import { ContextAssembler } from './ContextAssembler'
import { AgentError } from './errors'
import { PlannedInteractionService } from './PlannedInteractionService'

const relationships: Relationship[] = [
  {
    id: 'relationship-a',
    ownerId: 'owner-a',
    recipientId: 'recipient-a',
    label: 'A',
    status: 'entrusted',
  },
  {
    id: 'relationship-b',
    ownerId: 'owner-b',
    recipientId: 'recipient-b',
    label: 'B',
    status: 'entrusted',
  },
]

function memory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'memory-a',
    ownerId: 'owner-a',
    relationshipId: 'relationship-a',
    recipientId: 'recipient-a',
    topic: 'Recipe',
    meaning: 'Owner-authored meaning',
    visibility: 'relationship_specific',
    original: {
      kind: 'original',
      modality: 'audio',
      uri: '/memory-a.mp3',
      capturedAt: '2026-08-01T00:00:00.000Z',
    },
    organized: {
      kind: 'ai_organized',
      text: 'Owner-reviewed organization',
      sourceMemoryIds: ['memory-a'],
      reviewedByOwner: true,
    },
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function policy(overrides: Partial<AgentPolicy> = {}): AgentPolicy {
  return {
    relationshipId: 'relationship-a',
    allowAiOrganization: true,
    allowParaphrase: false,
    allowNewMemoryGeneration: false,
    allowedMemoryIds: ['memory-a'],
    blockedTopics: [],
    proactiveDelivery: 'after_recipient_entry',
    ...overrides,
  }
}

const plan: PlannedInteraction = {
  id: 'plan-a',
  relationshipId: 'relationship-a',
  title: 'Cook together',
  invitation: 'Cook this when you feel ready.',
  memoryIds: ['memory-a'],
  status: 'available',
}

const activeSession: RecipientSession = {
  id: 'session-a',
  relationshipId: 'relationship-a',
  recipientId: 'recipient-a',
  initiatedByRecipient: true,
  status: 'active',
  startedAt: '2026-08-01T00:00:00.000Z',
}

function repository(input?: {
  relationships?: Relationship[]
  memories?: Memory[]
  policies?: AgentPolicy[]
  plans?: PlannedInteraction[]
  sessions?: RecipientSession[]
}) {
  return new InMemoryAgentContextRepository(
    input?.relationships ?? relationships,
    input?.memories ?? [memory()],
    input?.policies ?? [policy()],
    input?.plans ?? [plan],
    input?.sessions ?? [activeSession],
  )
}

async function expectAgentError(
  promise: Promise<unknown>,
  code: AgentError['code'],
) {
  await expect(promise).rejects.toMatchObject({ code })
}

describe('relationship context assembly', () => {
  it('separates context sections and exposes only authorized owner content', async () => {
    const memories = [
      memory(),
      memory({
        id: 'public-a',
        relationshipId: undefined,
        recipientId: undefined,
        visibility: 'public_persona',
        organized: undefined,
      }),
      memory({ id: 'private-a', visibility: 'private' }),
      memory({
        id: 'cross-relationship',
        ownerId: 'owner-b',
        relationshipId: 'relationship-b',
        recipientId: 'recipient-b',
      }),
    ]
    const assembler = new ContextAssembler(
      repository({
        memories,
        policies: [
          policy({
            allowedMemoryIds: [
              'memory-a',
              'public-a',
              'private-a',
              'cross-relationship',
            ],
          }),
        ],
      }),
      new AgentPolicyEvaluator(),
      new PlannedInteractionService([plan]),
    )

    const context = await assembler.assemble({
      relationshipId: 'relationship-a',
      sessionId: 'session-a',
    })

    expect(context.sections.relationship_specific.map(({ memory }) => memory.id)).toEqual([
      'memory-a',
    ])
    expect(context.sections.public_persona.map(({ memory }) => memory.id)).toEqual([
      'public-a',
    ])
    expect(context.sections.private).toEqual({ exposed: false })
    expect(context.sections.policy).toEqual({
      allowOriginalPlayback: true,
      allowAiOrganization: true,
      allowGeneratedText: false,
      allowProactiveTrigger: true,
    })
  })

  it('requires owner review before presenting AI-organized text', async () => {
    const unreviewed = memory({
      organized: {
        kind: 'ai_organized',
        text: 'Unreviewed text',
        sourceMemoryIds: ['memory-a'],
        reviewedByOwner: false,
      },
    })
    const agent = await MockRelationshipAgent.create(
      repository({ memories: [unreviewed] }),
      'relationship-a',
    )

    const view = await agent.enter({
      relationshipId: 'relationship-a',
      sessionId: 'session-a',
    })

    expect(view.content.provenance).toBe('original')
    expect(view.content).not.toHaveProperty('text', 'Unreviewed text')
  })

  it('rejects AI organization whose source crosses relationship boundaries', async () => {
    const organized = memory({
      organized: {
        kind: 'ai_organized',
        text: 'Text derived from the wrong relationship',
        sourceMemoryIds: ['cross-source'],
        reviewedByOwner: true,
      },
    })
    const crossSource = memory({
      id: 'cross-source',
      ownerId: 'owner-b',
      relationshipId: 'relationship-b',
      recipientId: 'recipient-b',
    })
    const agent = await MockRelationshipAgent.create(
      repository({
        memories: [organized, crossSource],
        policies: [
          policy({ allowedMemoryIds: ['memory-a', 'cross-source'] }),
        ],
      }),
      'relationship-a',
    )

    const view = await agent.enter({
      relationshipId: 'relationship-a',
      sessionId: 'session-a',
    })

    expect(view.content.provenance).toBe('original')
  })

  it('does not expose plans backed by unauthorized memories', async () => {
    const unauthorizedPlan = {
      ...plan,
      id: 'private-plan',
      memoryIds: ['private-memory'],
    }
    const agent = await MockRelationshipAgent.create(
      repository({ plans: [unauthorizedPlan] }),
      'relationship-a',
    )

    const view = await agent.enter({
      relationshipId: 'relationship-a',
      sessionId: 'session-a',
    })

    expect(view.invitation).toBeUndefined()
  })

  it('returns explicit relationship, recipient, policy, and context errors', async () => {
    const agent = await MockRelationshipAgent.create(repository(), 'relationship-a')

    await expectAgentError(
      agent.enter({
        relationshipId: 'missing',
        sessionId: 'session-a',
      }),
      'RELATIONSHIP_NOT_FOUND',
    )
    const wrongRecipientAgent = await MockRelationshipAgent.create(
      repository({
        sessions: [{ ...activeSession, recipientId: 'recipient-b' }],
      }),
      'relationship-a',
    )
    await expectAgentError(
      wrongRecipientAgent.enter({
        relationshipId: 'relationship-a',
        sessionId: 'session-a',
      }),
      'RECIPIENT_MISMATCH',
    )

    const noPolicyAgent = await MockRelationshipAgent.create(
      repository({ policies: [] }),
      'relationship-a',
    )
    await expectAgentError(
      noPolicyAgent.enter({
        relationshipId: 'relationship-a',
        sessionId: 'session-a',
      }),
      'POLICY_NOT_FOUND',
    )

    const noContextAgent = await MockRelationshipAgent.create(
      repository({ policies: [policy({ allowedMemoryIds: [] })] }),
      'relationship-a',
    )
    await expectAgentError(
      noContextAgent.enter({
        relationshipId: 'relationship-a',
        sessionId: 'session-a',
      }),
      'INSUFFICIENT_CONTEXT',
    )
  })

  it('rejects missing or inactive sessions and relationships not entrusted', async () => {
    const agent = await MockRelationshipAgent.create(repository(), 'relationship-a')
    await expectAgentError(
      agent.enter({ relationshipId: 'relationship-a', sessionId: 'missing' }),
      'SESSION_NOT_FOUND',
    )

    const closedSessionAgent = await MockRelationshipAgent.create(
      repository({ sessions: [{ ...activeSession, status: 'closed' }] }),
      'relationship-a',
    )
    await expectAgentError(
      closedSessionAgent.enter({
        relationshipId: 'relationship-a',
        sessionId: 'session-a',
      }),
      'RECIPIENT_ENTRY_REQUIRED',
    )

    const unavailableAgent = await MockRelationshipAgent.create(
      repository({
        relationships: [{ ...relationships[0], status: 'active' }],
      }),
      'relationship-a',
    )
    await expectAgentError(
      unavailableAgent.enter({
        relationshipId: 'relationship-a',
        sessionId: 'session-a',
      }),
      'RELATIONSHIP_NOT_AVAILABLE',
    )
  })
})

describe('relationship agent policy boundaries', () => {
  it('does not run before recipient entry or proactively when policy forbids it', async () => {
    const inactiveAgent = await MockRelationshipAgent.create(
      repository({
        policies: [policy({ proactiveDelivery: 'never' })],
        sessions: [{ ...activeSession, initiatedByRecipient: false }],
      }),
      'relationship-a',
    )

    await expectAgentError(
      inactiveAgent.enter({
        relationshipId: 'relationship-a',
        sessionId: 'session-a',
      }),
      'RECIPIENT_ENTRY_REQUIRED',
    )
    const agent = await MockRelationshipAgent.create(
      repository({ policies: [policy({ proactiveDelivery: 'never' })] }),
      'relationship-a',
    )
    await expectAgentError(
      agent.enter({
        relationshipId: 'relationship-a',
        sessionId: 'session-a',
        delivery: 'designed_encounter',
      }),
      'PROACTIVE_TRIGGER_NOT_ALLOWED',
    )
  })

  it('labels reviewed AI organization and keeps invitations non-generated', async () => {
    const agent = await MockRelationshipAgent.create(repository(), 'relationship-a')
    const view = await agent.enter({
      relationshipId: 'relationship-a',
      sessionId: 'session-a',
      delivery: 'designed_encounter',
    })

    expect(view.content).toMatchObject({
      provenance: 'ai_organized',
      text: 'Owner-reviewed organization',
      reviewedByOwner: true,
    })
    expect(view.invitation).toEqual({
      kind: 'invitation',
      interactionId: 'plan-a',
      title: 'Cook together',
      invitation: plan.invitation,
      state: 'invited',
    })
    expect(view.policy.allowGeneratedText).toBe(false)
  })
})

describe('planned interaction lifecycle', () => {
  it('supports planned, invited, accepted, completed, and skipped states', () => {
    const service = new PlannedInteractionService([
      plan,
      { ...plan, id: 'plan-skip' },
    ])

    expect(service.list('relationship-a')[0].state).toBe('planned')
    expect(service.transition('relationship-a', 'plan-a', 'invited').state).toBe(
      'invited',
    )
    expect(service.transition('relationship-a', 'plan-a', 'accepted').state).toBe(
      'accepted',
    )
    expect(service.transition('relationship-a', 'plan-a', 'completed').state).toBe(
      'completed',
    )
    expect(service.transition('relationship-a', 'plan-skip', 'skipped').state).toBe(
      'skipped',
    )
  })

  it('rejects cross-relationship access and invalid terminal transitions', () => {
    const service = new PlannedInteractionService([plan])

    expect(() =>
      service.transition('relationship-b', 'plan-a', 'invited'),
    ).toThrowError(expect.objectContaining({ code: 'INTERACTION_NOT_FOUND' }))
    service.transition('relationship-a', 'plan-a', 'skipped')
    expect(() =>
      service.transition('relationship-a', 'plan-a', 'invited'),
    ).toThrowError(
      expect.objectContaining({ code: 'INVALID_INTERACTION_TRANSITION' }),
    )
  })

  it('keeps postponed domain plans available for a later invitation', () => {
    const service = new PlannedInteractionService([
      { ...plan, status: 'postponed' },
    ])

    expect(service.list('relationship-a')[0].state).toBe('planned')
  })
})
