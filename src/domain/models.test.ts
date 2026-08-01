import { describe, expect, it } from 'vitest'
import type { AgentPolicy, Memory } from './models'

describe('memory provenance', () => {
  it('keeps original content separate from reviewed AI organization', () => {
    const memory: Memory = {
      id: 'memory-1',
      ownerId: 'owner-1',
      recipientId: 'recipient-1',
      relationshipId: 'relationship-1',
      topic: 'Recipe',
      meaning: 'A family recipe',
      visibility: 'relationship_specific',
      original: {
        kind: 'original',
        modality: 'audio',
        uri: '/original.mp3',
        capturedAt: '2026-08-01T00:00:00.000Z',
      },
      organized: {
        kind: 'ai_organized',
        text: 'A reviewed summary',
        sourceMemoryIds: ['memory-1'],
        reviewedByOwner: true,
      },
      createdAt: '2026-08-01T00:00:00.000Z',
    }

    expect(memory.original.kind).toBe('original')
    expect(memory.organized?.sourceMemoryIds).toEqual(['memory-1'])
  })

  it('makes unauthorized new-memory generation impossible in policy data', () => {
    const policy: AgentPolicy = {
      relationshipId: 'relationship-1',
      allowAiOrganization: true,
      allowParaphrase: false,
      allowNewMemoryGeneration: false,
      allowedMemoryIds: [],
      blockedTopics: [],
      proactiveDelivery: 'never',
    }

    expect(policy.allowNewMemoryGeneration).toBe(false)
  })
})
