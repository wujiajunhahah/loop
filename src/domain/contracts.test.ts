import { describe, expect, it } from 'vitest'
import type {
  ContextItem,
  GenerationPolicy,
  Provenance,
  User,
  V2Relationship,
} from './index'
import {
  canGenerateFromSources,
  createDefaultGenerationPolicy,
  createDefaultTriggerPolicy,
  hasValidProvenance,
  isContextVisibleTo,
  isValidRelationshipAssignment,
} from './index'

const relationship: V2Relationship = {
  contractVersion: 2,
  id: 'relationship-1',
  subjectId: 'subject-1',
  ownerId: 'subject-1',
  recorderIds: ['subject-1'],
  recipientId: 'recipient-1',
  buyerId: 'subject-1',
  label: 'Mother and daughter',
  kind: 'parent_child',
  status: 'active',
}

const users: User[] = [
  {
    id: 'subject-1',
    displayName: 'Subject',
    roles: ['subject', 'recorder', 'buyer'],
  },
  { id: 'recipient-1', displayName: 'Recipient', roles: ['recipient'] },
]

function context(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: 'context-1',
    subjectId: 'subject-1',
    recorderId: 'subject-1',
    recipientId: 'recipient-1',
    relationshipId: 'relationship-1',
    sourceType: 'user_recorded',
    modality: 'audio',
    captureMode: 'guided',
    originalAssetId: 'asset-1',
    derivedContentIds: [],
    topic: 'Family recipe',
    meaning: 'A shared weekday meal',
    importanceWeight: 0.8,
    sensitivityLevel: 'low',
    visibility: 'relationship_specific',
    intendedScenarios: ['rainy_day'],
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('V2 actor roles and visibility', () => {
  it('accepts subject-recorder-buyer overlap but requires a distinct recipient', () => {
    expect(isValidRelationshipAssignment(relationship, users)).toBe(true)
    expect(
      isValidRelationshipAssignment(
        { ...relationship, recipientId: relationship.subjectId },
        users,
      ),
    ).toBe(false)
  })

  it('requires every assigned actor to carry the matching role', () => {
    expect(
      isValidRelationshipAssignment(relationship, [
        { ...users[0], roles: ['subject', 'buyer'] },
        users[1],
      ]),
    ).toBe(false)
  })

  it('never exposes private or cross-recipient relationship context', () => {
    expect(isContextVisibleTo(context(), relationship, 'recipient-1')).toBe(true)
    expect(isContextVisibleTo(context(), relationship, 'recipient-2')).toBe(false)
    expect(
      isContextVisibleTo(
        context({ visibility: 'private' }),
        relationship,
        'recipient-1',
      ),
    ).toBe(false)
    expect(
      isContextVisibleTo(
        context({ visibility: 'public_context', subjectId: 'subject-2' }),
        relationship,
        'recipient-1',
      ),
    ).toBe(false)
  })
})

describe('V2 provenance and policy defaults', () => {
  it('defaults to source replay and pull-only recipient entry', () => {
    expect(createDefaultGenerationPolicy('relationship-1')).toMatchObject({
      allowedModes: ['source_replay'],
      sourceRequired: true,
      aiLabelRequired: true,
      highRiskBlocked: true,
      newFactsAllowed: false,
      majorDecisionsAllowed: false,
    })
    expect(createDefaultTriggerPolicy('relationship-1')).toEqual({
      relationshipId: 'relationship-1',
      mode: 'pull_only',
      allowedReasons: ['user_opened'],
      optedIn: false,
    })
  })

  it('requires source Context IDs and distinguishes replay from AI output', () => {
    const generated: Provenance = {
      sourceContextIds: ['context-1'],
      sourceAssetIds: [],
      generationMode: 'source_composition',
      aiGenerated: true,
      createdAt: '2026-08-02T00:00:00.000Z',
    }
    expect(hasValidProvenance(generated)).toBe(true)
    expect(hasValidProvenance({ ...generated, sourceContextIds: [] })).toBe(false)
    expect(hasValidProvenance({ ...generated, aiGenerated: false })).toBe(false)
  })

  it('allows only authorized, source-backed, non-high-risk generation', () => {
    const policy: GenerationPolicy = {
      ...createDefaultGenerationPolicy('relationship-1'),
      allowedContextIds: ['context-1'],
      allowedModes: ['source_replay', 'source_composition'],
      allowedTopics: ['Family recipe'],
      forbiddenTopics: ['Medical advice'],
    }
    const input = {
      policy,
      mode: 'source_composition' as const,
      topic: 'Family recipe',
      sourceContextIds: ['context-1'],
      highRisk: false,
    }
    expect(canGenerateFromSources(input)).toBe(true)
    expect(canGenerateFromSources({ ...input, sourceContextIds: [] })).toBe(false)
    expect(canGenerateFromSources({ ...input, highRisk: true })).toBe(false)
    expect(canGenerateFromSources({ ...input, topic: 'Medical advice' })).toBe(false)
    expect(
      canGenerateFromSources({
        ...input,
        policy: { ...policy, allowedTopics: [] },
      }),
    ).toBe(false)
  })
})
