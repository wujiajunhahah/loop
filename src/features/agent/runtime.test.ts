import { describe, expect, it } from 'vitest'
import {
  DeterministicAgentGenerationAdapter,
  DeterministicOwnerReviewAdapter,
  InMemoryAgentRuntimeRepository,
} from '../../adapters/agent'
import type {
  ContextItem,
  GenerationPolicy,
  Interaction,
  OriginalAsset,
  TriggerPolicy,
  V2Relationship,
} from '../../domain'
import { AgentError } from './errors'
import { RecipientScopedAgentRuntime } from './RecipientScopedAgentRuntime'
import type {
  GeneratedDraft,
  RecipientAgentRequest,
} from './runtimeTypes'

const now = '2026-08-02T12:00:00.000Z'

const relationship: V2Relationship = {
  contractVersion: 2,
  id: 'relationship-a',
  subjectId: 'owner-a',
  ownerId: 'owner-a',
  recorderIds: ['owner-a'],
  recipientId: 'recipient-a',
  label: 'A',
  kind: 'parent_child',
  status: 'entrusted',
}

const interaction: Interaction = {
  id: 'interaction-a',
  relationshipId: relationship.id,
  recipientId: relationship.recipientId,
  initiatedByRecipient: true,
  startedAt: now,
}

function context(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: 'context-a',
    subjectId: relationship.subjectId,
    recorderId: relationship.ownerId,
    recipientId: relationship.recipientId,
    relationshipId: relationship.id,
    sourceType: 'user_recorded',
    modality: 'audio',
    captureMode: 'direct',
    originalAssetId: 'asset-a',
    derivedContentIds: [],
    topic: 'recipe',
    meaning: 'Use the handwritten family recipe.',
    importanceWeight: 1,
    sensitivityLevel: 'low',
    visibility: 'relationship_specific',
    intendedScenarios: ['cooking'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function asset(overrides: Partial<OriginalAsset> = {}): OriginalAsset {
  return {
    id: 'asset-a',
    contextId: 'context-a',
    modality: 'audio',
    uri: '/assets/recipe.mp3',
    capturedAt: now,
    ...overrides,
  }
}

function generationPolicy(
  overrides: Partial<GenerationPolicy> = {},
): GenerationPolicy {
  return {
    relationshipId: relationship.id,
    allowedContextIds: ['context-a'],
    allowedModes: [
      'source_replay',
      'source_composition',
      'persona_inference',
    ],
    allowedTopics: ['recipe'],
    forbiddenTopics: ['medical diagnosis'],
    sourceRequired: true,
    aiLabelRequired: true,
    highRiskBlocked: true,
    newFactsAllowed: false,
    majorDecisionsAllowed: false,
    ...overrides,
  }
}

function triggerPolicy(overrides: Partial<TriggerPolicy> = {}): TriggerPolicy {
  return {
    relationshipId: relationship.id,
    mode: 'pull_only',
    allowedReasons: ['user_opened'],
    optedIn: false,
    ...overrides,
  }
}

function request(
  overrides: Partial<RecipientAgentRequest> = {},
): RecipientAgentRequest {
  return {
    interaction,
    mode: 'source_replay',
    sourceContextIds: ['context-a'],
    topic: 'recipe',
    ...overrides,
  }
}

function runtime(input?: {
  contexts?: ContextItem[]
  assets?: OriginalAsset[]
  policy?: GenerationPolicy
  trigger?: TriggerPolicy | undefined
  draft?: Partial<GeneratedDraft>
  review?: {
    approved: boolean
    reviewedByUserId?: string
    reviewedAt?: string
  }
}) {
  return new RecipientScopedAgentRuntime(
    new InMemoryAgentRuntimeRepository(
      [relationship],
      input?.contexts ?? [context()],
      input?.assets ?? [asset()],
      [input?.policy ?? generationPolicy()],
      input && 'trigger' in input
        ? input.trigger
          ? [input.trigger]
          : []
        : [triggerPolicy()],
    ),
    new DeterministicAgentGenerationAdapter(input?.draft),
    new DeterministicOwnerReviewAdapter(
      input?.review ?? {
        approved: true,
        reviewedByUserId: relationship.ownerId,
        reviewedAt: now,
      },
    ),
    () => now,
  )
}

async function expectAgentError(
  promise: Promise<unknown>,
  code: AgentError['code'],
) {
  await expect(promise).rejects.toMatchObject({ code })
}

describe('recipient-scoped Agent V2 output modes', () => {
  it('replays one approved original source without an AI claim', async () => {
    const result = await runtime().run(request())

    expect(result).toMatchObject({
      outputMode: 'source_replay',
      content: '/assets/recipe.mp3',
      aiLabel: 'Original source',
      provenance: {
        sourceContextIds: ['context-a'],
        sourceAssetIds: ['asset-a'],
        generationMode: 'source_replay',
        aiGenerated: false,
      },
      triggerReason: 'user_opened',
    })
    expect(result).not.toHaveProperty('ownerReview')
  })

  it('returns only owner-reviewed source compositions with source trace and AI marker', async () => {
    const result = await runtime().run(
      request({ mode: 'source_composition' }),
    )

    expect(result).toMatchObject({
      outputMode: 'source_composition',
      aiLabel: 'AI-generated',
      confidence: 1,
      provenance: {
        sourceContextIds: ['context-a'],
        sourceAssetIds: ['asset-a'],
        generationMode: 'source_composition',
        aiGenerated: true,
        model: 'deterministic-mock-v1',
      },
      ownerReview: {
        reviewedByUserId: 'owner-a',
        reviewedAt: now,
      },
    })
  })

  it('connects recipient-authored present context without treating it as source provenance', async () => {
    const result = await runtime().run(request({
      mode: 'source_composition',
      interaction: {
        ...interaction,
        presentContext: {
          id: 'present-a',
          recipientId: relationship.recipientId,
          modality: 'text',
          content: 'I made the recipe today.',
          createdAt: now,
          authorRole: 'recipient',
          eligibleAsRecorderContext: false,
        },
      },
    }))

    expect(result.content).toContain('I made the recipe today.')
    expect(result.provenance.sourceContextIds).toEqual(['context-a'])
    expect(result.provenance.sourceContextIds).not.toContain('present-a')
  })

  it('returns explicitly authorized bounded inference with confidence and sensitivity', async () => {
    const result = await runtime({
      contexts: [context({ sensitivityLevel: 'medium' })],
    }).run(request({ mode: 'bounded_persona_inference' }))

    expect(result).toMatchObject({
      outputMode: 'bounded_persona_inference',
      aiLabel: 'AI-generated',
      confidence: 0.75,
      sensitivity: 'medium',
      triggerReason: 'user_opened',
      provenance: {
        sourceContextIds: ['context-a'],
        generationMode: 'persona_inference',
        aiGenerated: true,
      },
    })
  })
})

describe('recipient and source isolation', () => {
  it('rejects an interaction for another recipient or relationship', async () => {
    await expectAgentError(
      runtime().run(
        request({
          interaction: { ...interaction, recipientId: 'recipient-b' },
        }),
      ),
      'INTERACTION_SCOPE_MISMATCH',
    )
  })

  it('rejects entries not actively initiated by the recipient', async () => {
    await expectAgentError(
      runtime().run(
        request({
          interaction: { ...interaction, initiatedByRecipient: false },
        }),
      ),
      'RECIPIENT_ENTRY_REQUIRED',
    )
    await expectAgentError(
      runtime().run(
        request({ interaction: { ...interaction, completedAt: now } }),
      ),
      'RECIPIENT_ENTRY_REQUIRED',
    )
  })

  it('rejects private, cross-relationship, and unapproved sources', async () => {
    await expectAgentError(
      runtime({ contexts: [context({ visibility: 'private' })] }).run(request()),
      'PRIVATE_SOURCE',
    )
    await expectAgentError(
      runtime({
        contexts: [
          context({
            relationshipId: 'relationship-b',
            recipientId: 'recipient-b',
          }),
        ],
      }).run(request()),
      'CROSS_RELATIONSHIP_SOURCE',
    )
    await expectAgentError(
      runtime({
        policy: generationPolicy({ allowedContextIds: [] }),
      }).run(request()),
      'SOURCE_NOT_ALLOWED',
    )
  })

  it('requires a source and a matching original asset for replay', async () => {
    await expectAgentError(
      runtime().run(request({ sourceContextIds: [] })),
      'SOURCE_REQUIRED',
    )
    await expectAgentError(
      runtime({ assets: [] }).run(request()),
      'ORIGINAL_ASSET_NOT_FOUND',
    )
  })
})

describe('bounded generation policy', () => {
  it('uses pull_only/user_opened by default and rejects unsolicited triggers', async () => {
    const defaultTriggerRuntime = runtime({ trigger: undefined })
    await expect(
      defaultTriggerRuntime.run(request({ triggerReason: 'user_opened' })),
    ).resolves.toMatchObject({ triggerReason: 'user_opened' })
    await expectAgentError(
      defaultTriggerRuntime.run(request({ triggerReason: 'scheduled_date' })),
      'TRIGGER_NOT_ALLOWED',
    )
  })

  it('rejects disallowed modes, topics, high-risk output, and free chat', async () => {
    await expectAgentError(
      runtime({
        policy: generationPolicy({ allowedModes: ['source_replay'] }),
      }).run(request({ mode: 'source_composition' })),
      'MODE_NOT_ALLOWED',
    )
    await expectAgentError(
      runtime().run(
        request({ mode: 'source_composition', topic: 'medical diagnosis' }),
      ),
      'FORBIDDEN_TOPIC',
    )
    await expectAgentError(
      runtime().run(request({ mode: 'source_composition', topic: 'politics' })),
      'TOPIC_NOT_ALLOWED',
    )
    await expectAgentError(
      runtime().run(request({ mode: 'source_composition', highRisk: true })),
      'HIGH_RISK_BLOCKED',
    )
    await expectAgentError(
      runtime().run({
        ...request(),
        mode: 'free_chat',
      } as unknown as RecipientAgentRequest),
      'MODE_NOT_ALLOWED',
    )
  })

  it.each([
    ['new factual claims', { containsNewFacts: true }],
    ['major decisions', { makesMajorDecision: true }],
    ['unreviewed intent', { expressesUnreviewedIntent: true }],
  ])('rejects generated %s', async (_label, draft) => {
    await expectAgentError(
      runtime({ draft }).run(request({ mode: 'source_composition' })),
      'UNSAFE_GENERATION',
    )
  })

  it('does not expose generated content without owner review', async () => {
    await expectAgentError(
      runtime({ review: { approved: false } }).run(
        request({ mode: 'source_composition' }),
      ),
      'OWNER_REVIEW_REQUIRED',
    )
    await expectAgentError(
      runtime({
        review: {
          approved: true,
          reviewedByUserId: 'recipient-a',
          reviewedAt: now,
        },
      }).run(request({ mode: 'bounded_persona_inference' })),
      'OWNER_REVIEW_REQUIRED',
    )
  })
})
