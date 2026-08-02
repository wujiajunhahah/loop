import { describe, expect, it } from 'vitest'
import type {
  ContextItem,
  GenerationPolicy,
  Interaction,
  OriginalAsset,
  V2Relationship,
} from '../../domain'
import { ArtifactError, InteractionArtifactService } from '.'

const relationship: V2Relationship = {
  contractVersion: 2,
  id: 'relationship-a',
  subjectId: 'subject-a',
  ownerId: 'subject-a',
  recorderIds: ['recorder-a'],
  recipientId: 'recipient-a',
  label: 'A',
  kind: 'parent_child',
  status: 'active',
}

const context: ContextItem = {
  id: 'context-a',
  subjectId: 'subject-a',
  recorderId: 'recorder-a',
  recipientId: 'recipient-a',
  relationshipId: 'relationship-a',
  sourceType: 'user_recorded',
  modality: 'audio',
  captureMode: 'guided',
  originalAssetId: 'asset-a',
  derivedContentIds: [],
  topic: 'journey',
  meaning: 'Remember the train ride by the sea.',
  importanceWeight: 0.8,
  sensitivityLevel: 'low',
  visibility: 'relationship_specific',
  intendedScenarios: ['postcard'],
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-01T08:00:00.000Z',
}

const asset: OriginalAsset = {
  id: 'asset-a',
  contextId: 'context-a',
  modality: 'audio',
  uri: '/context-a.mp3',
  capturedAt: '2026-08-01T08:00:00.000Z',
}

const policy: GenerationPolicy = {
  relationshipId: 'relationship-a',
  allowedContextIds: ['context-a'],
  allowedModes: ['source_replay', 'source_composition'],
  allowedTopics: ['journey'],
  forbiddenTopics: [],
  sourceRequired: true,
  aiLabelRequired: true,
  highRiskBlocked: true,
  newFactsAllowed: false,
  majorDecisionsAllowed: false,
}

function interaction(overrides: Partial<Interaction> = {}): Interaction {
  return {
    id: 'interaction-a',
    relationshipId: 'relationship-a',
    recipientId: 'recipient-a',
    initiatedByRecipient: true,
    startedAt: '2026-08-02T09:00:00.000Z',
    completedAt: '2026-08-02T09:05:00.000Z',
    output: {
      outputType: 'composition',
      content: 'Remember the train ride by the sea.',
      provenance: {
        sourceContextIds: ['context-a'],
        sourceAssetIds: ['asset-a'],
        generationMode: 'source_composition',
        aiGenerated: true,
        model: 'offline-deterministic-composer',
        createdAt: '2026-08-02T09:04:00.000Z',
      },
      sensitivity: 'low',
      triggerReason: 'user_opened',
      userControls: ['save', 'close'],
    },
    ...overrides,
  }
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    interaction: interaction(),
    relationship,
    policy,
    contexts: [context],
    originalAssets: [asset],
    ...overrides,
  }
}

async function expectArtifactError(promise: Promise<unknown>, code: ArtifactError['code']) {
  await expect(promise).rejects.toMatchObject({ code })
}

describe('InteractionArtifactService', () => {
  it('creates and stores a deterministic source-backed postcard', async () => {
    const service = new InteractionArtifactService()
    const input = createInput({
      recipientResponse: {
        content: 'I remember that day too.',
        authorId: 'recipient-a',
        authorRole: 'recipient',
      },
    })

    const first = await service.create(input)
    const second = await new InteractionArtifactService().create(input)

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      id: 'artifact:interaction-a',
      type: 'postcard',
      sourceContextIds: ['context-a'],
      originalQuoteAssetId: 'asset-a',
      generatedSummary: 'Remember the train ride by the sea.',
      createdAt: '2026-08-02T09:05:00.000Z',
      generationLabel: 'AI-generated',
      saved: true,
    })
    expect(await service.get(first.id)).toBe(first)
    expect(await service.getProvenance(first.id)).toEqual(first.provenance)
    expect(first.provenance).toMatchObject({
      sourceContextIds: ['context-a'],
      sourceAssetIds: ['asset-a'],
      generationMode: 'source_composition',
      aiGenerated: true,
    })
  })

  it('fails clearly when the output has no policy-approved source', async () => {
    const service = new InteractionArtifactService()

    await expectArtifactError(
      service.create(createInput({ policy: { ...policy, allowedContextIds: [] } })),
      'NO_APPROVED_SOURCE',
    )
    await expectArtifactError(
      service.create(createInput({ contexts: [] })),
      'SOURCE_NOT_FOUND',
    )
  })

  it('rejects private, cross-recipient, and unapproved-topic sources', async () => {
    const service = new InteractionArtifactService()

    await expectArtifactError(
      service.create(createInput({ contexts: [{ ...context, visibility: 'private' }] })),
      'SOURCE_NOT_VISIBLE',
    )
    await expectArtifactError(
      service.create(createInput({ contexts: [{ ...context, recipientId: 'recipient-b' }] })),
      'SOURCE_NOT_VISIBLE',
    )
    await expectArtifactError(
      service.create(createInput({ policy: { ...policy, allowedTopics: [] } })),
      'SOURCE_TOPIC_NOT_APPROVED',
    )
  })

  it('requires a completed interaction with valid provenance', async () => {
    const service = new InteractionArtifactService()

    await expectArtifactError(
      service.create(createInput({ interaction: interaction({ completedAt: undefined }) })),
      'INTERACTION_INCOMPLETE',
    )
    await expectArtifactError(
      service.create(createInput({ interaction: interaction({ output: undefined }) })),
      'INTERACTION_OUTPUT_REQUIRED',
    )
    const invalid = interaction()
    invalid.output!.provenance.sourceAssetIds = ['asset-from-another-context']
    await expectArtifactError(
      service.create(createInput({ interaction: invalid })),
      'SOURCE_PROVENANCE_INVALID',
    )
  })

  it('attributes responses only to the recipient and excludes recorder context authorship', async () => {
    const service = new InteractionArtifactService()
    const artifact = await service.create(
      createInput({
        recipientResponse: {
          content: 'I remember that day too.',
          authorId: 'recipient-a',
          authorRole: 'recipient',
        },
      }),
    )

    expect(artifact.recipientResponse).toBe('I remember that day too.')
    expect(artifact.recipientResponseAttribution).toEqual({
      authorId: 'recipient-a',
      authorRole: 'recipient',
      eligibleAsRecorderContext: false,
    })
    expect(artifact.recipientResponseAttribution?.authorId).not.toBe('recorder-a')

    await expectArtifactError(
      service.create(
        createInput({
          recipientResponse: {
            content: 'Recorder-authored text',
            authorId: 'recorder-a',
            authorRole: 'recipient',
          },
        }),
      ),
      'RECIPIENT_RESPONSE_AUTHOR_INVALID',
    )
  })

  it('keeps present context attributed to the recipient and outside recorder Context', async () => {
    const service = new InteractionArtifactService()
    const presentContext = {
      id: 'present-a',
      recipientId: 'recipient-a',
      modality: 'text' as const,
      content: 'I rode the train today.',
      createdAt: '2026-08-02T09:00:00.000Z',
      authorRole: 'recipient' as const,
      eligibleAsRecorderContext: false as const,
    }
    const artifact = await service.create(createInput({
      interaction: interaction({ presentContext }),
    }))

    expect(artifact.presentContext).toEqual(presentContext)
    expect(artifact.sourceContextIds).toEqual(['context-a'])
    expect(artifact.sourceContextIds).not.toContain('present-a')

    await expectArtifactError(
      service.create(createInput({
        interaction: interaction({
          presentContext: { ...presentContext, recipientId: 'recipient-b' },
        }),
      })),
      'RECIPIENT_CONTEXT_AUTHOR_INVALID',
    )
  })

  it('supports all artifact types and labels original replay without inventing text', async () => {
    const originalInteraction = interaction({
      output: {
        ...interaction().output!,
        outputType: 'original',
        content: context.meaning,
        provenance: {
          ...interaction().output!.provenance,
          generationMode: 'source_replay',
          aiGenerated: false,
          model: undefined,
        },
      },
    })

    for (const type of ['postcard', 'letter', 'memory_card'] as const) {
      const artifact = await new InteractionArtifactService().create(
        createInput({ interaction: originalInteraction, type }),
      )
      expect(artifact.type).toBe(type)
      expect(artifact.generatedSummary).toBe(context.meaning)
      expect(artifact.generationLabel).toBe('Original source')
    }
  })
})
