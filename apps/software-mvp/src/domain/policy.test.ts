import { describe, expect, it } from 'vitest'
import type { AgentPolicy, Memory, RecipientSession } from './models'
import { applyRecipientChoice, canAgentUseMemory } from './policy'

const policy: AgentPolicy = {
  relationshipId: 'relationship-a',
  allowAiOrganization: true,
  allowParaphrase: false,
  allowNewMemoryGeneration: false,
  allowedMemoryIds: ['memory-a', 'private-memory'],
  blockedTopics: [],
  proactiveDelivery: 'after_recipient_entry',
}

function memory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'memory-a',
    ownerId: 'owner-a',
    relationshipId: 'relationship-a',
    recipientId: 'recipient-a',
    topic: 'Topic',
    meaning: 'Meaning',
    visibility: 'relationship_specific',
    original: {
      kind: 'original',
      modality: 'text',
      uri: 'memory://a',
      capturedAt: '2026-08-01T00:00:00.000Z',
    },
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('agent memory permissions', () => {
  it('allows an explicitly authorized relationship memory', () => {
    expect(
      canAgentUseMemory(memory(), 'relationship-a', 'recipient-a', policy),
    ).toBe(true)
  })

  it('blocks cross-recipient and private memories', () => {
    expect(
      canAgentUseMemory(memory(), 'relationship-a', 'recipient-b', policy),
    ).toBe(false)
    expect(
      canAgentUseMemory(
        memory({ id: 'private-memory', visibility: 'private' }),
        'relationship-a',
        'recipient-a',
        policy,
      ),
    ).toBe(false)
  })
})

describe('recipient control', () => {
  const session: RecipientSession = {
    id: 'session-a',
    relationshipId: 'relationship-a',
    recipientId: 'recipient-a',
    initiatedByRecipient: true,
    status: 'active',
    startedAt: '2026-08-01T00:00:00.000Z',
  }

  it.each([
    ['accept', 'active'],
    ['postpone', 'postponed'],
    ['skip', 'skipped'],
    ['close', 'closed'],
  ] as const)('supports %s', (choice, status) => {
    expect(applyRecipientChoice(session, choice).status).toBe(status)
  })

  it('keeps permanent close terminal', () => {
    const closed = applyRecipientChoice(session, 'close')
    expect(applyRecipientChoice(closed, 'accept')).toEqual(closed)
  })
})
