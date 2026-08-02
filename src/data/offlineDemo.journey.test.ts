import { beforeEach, describe, expect, it } from 'vitest'
import type { JourneyIntensity } from '../features/journey/domain'
import { OfflineDemoService } from './offlineDemo'

const now = '2026-08-02T10:00:00.000Z'

function createService() {
  return new OfflineDemoService(() => now)
}

function reachInspected(
  service: OfflineDemoService,
  intensity: JourneyIntensity = 'quiet',
) {
  const recipientSession = service.createSession()
  const started = service.startJourney(recipientSession)
  service.selectJourneyIntensity(started.id, intensity)
  service.inspectJourneyProposal(started.id)
  return {
    sessionId: started.id,
    actionId: service.getJourneySnapshot().proposal!.fallbackAction.id,
  }
}

async function reachMemory(
  service: OfflineDemoService,
  intensity: JourneyIntensity = 'quiet',
) {
  const journey = reachInspected(service, intensity)
  service.acceptJourneyAction(journey.sessionId, journey.actionId)
  service.completeJourneyAction(journey.sessionId)
  const presentation = await service.loadJourneyMemory(journey.sessionId)
  return { ...journey, presentation }
}

describe('OfflineDemoService Echo Map journey', () => {
  let service: OfflineDemoService

  beforeEach(() => {
    service = createService()
  })

  it('completes the quiet source-only path with one postcard and lit node', async () => {
    const { sessionId, presentation } = await reachMemory(service)
    expect(presentation.original.aiLabel).toBe('Original source')
    expect(presentation.composition).toBeUndefined()

    const response = service.saveJourneyResponse(sessionId, 'I heard rain today.')
    expect(response).toMatchObject({
      authorId: 'person-lin',
      authorRole: 'recipient',
      kind: 'text',
      eligibleAsRecorderContext: false,
    })

    const postcard = await service.createJourneyPostcard(sessionId)
    expect(postcard).toMatchObject({
      id: `artifact:interaction:journey:${sessionId}`,
      generationLabel: 'Original source',
      sourceContextIds: ['context-rainy-day'],
      recipientResponse: 'I heard rain today.',
      recipientResponseAttribution: {
        authorId: 'person-lin',
        eligibleAsRecorderContext: false,
      },
    })

    const node = await service.lightJourneyNode(sessionId)
    expect(node).toMatchObject({
      status: 'lit',
      journeySessionId: sessionId,
      artifactId: postcard.id,
    })
    expect(service.getJourneySnapshot().session).toMatchObject({
      state: 'node_lit',
      completedAt: now,
    })
  })

  it.each(['glimmer', 'deep'] as const)(
    'loads reviewed source composition for %s without changing source scope',
    async (intensity) => {
      const { sessionId, presentation } = await reachMemory(service, intensity)
      expect(presentation.composition).toMatchObject({
        relationshipId: 'relationship-mei-lin',
        recipientId: 'person-lin',
        aiLabel: 'AI-generated',
        triggerReason: 'user_opened',
        provenance: {
          sourceContextIds: ['context-rainy-day'],
          sourceAssetIds: ['asset-rainy-day'],
          generationMode: 'source_composition',
          aiGenerated: true,
        },
        ownerReview: { reviewedByUserId: 'person-mei' },
      })

      service.saveJourneyResponse(sessionId)
      const postcard = await service.createJourneyPostcard(sessionId)
      expect(postcard.generationLabel).toBe('AI-generated')
      expect(postcard.recipientResponse).toBeUndefined()
      expect(postcard.recipientResponseAttribution).toBeUndefined()
    },
  )

  it('reuses the same postcard and node completion tuple on retry', async () => {
    const { sessionId } = await reachMemory(service, 'glimmer')
    service.saveJourneyResponse(sessionId, 'Still here.')
    const firstArtifact = await service.createJourneyPostcard(sessionId)
    const secondArtifact = await service.createJourneyPostcard(sessionId)
    expect(secondArtifact).toEqual(firstArtifact)

    const firstNode = await service.lightJourneyNode(sessionId)
    const secondNode = await service.lightJourneyNode(sessionId)
    expect(secondNode).toEqual(firstNode)
    expect(secondNode.status).toBe('lit')
  })

  it.each([
    ['close', 'closed'],
    ['hide', 'hidden'],
  ] as const)('stores %s before proposal inspection without false completion', (exit, state) => {
    const started = service.startJourney(service.createSession())
    const ended = service.exitJourney(started.id, exit)
    expect(ended.state).toBe(state)
    expect(ended.artifactId).toBeUndefined()
    expect(ended.completedAt).toBeUndefined()
    expect(service.getJourneySnapshot().node.status).toBe(
      exit === 'hide' ? 'hidden' : 'available',
    )
  })

  it.each([
    ['skip', 'skipped'],
    ['reject', 'rejected'],
  ] as const)('stores %s after inspection without false completion', (exit, state) => {
    const { sessionId } = reachInspected(service)
    const ended = service.exitJourney(sessionId, exit)
    expect(ended.state).toBe(state)
    expect(ended.artifactId).toBeUndefined()
    expect(ended.completedAt).toBeUndefined()
    expect(service.getJourneySnapshot().node.status).toBe(
      exit === 'reject' ? 'rejected' : 'available',
    )
  })

  it('stops before or after postcard without lighting the node', async () => {
    const before = reachInspected(service)
    service.acceptJourneyAction(before.sessionId, before.actionId)
    const stoppedBefore = service.exitJourney(before.sessionId, 'stop')
    expect(stoppedBefore.state).toBe('stopped')
    expect(stoppedBefore.artifactId).toBeUndefined()
    expect(stoppedBefore.completedAt).toBeUndefined()

    service.reset()
    const after = await reachMemory(service)
    service.saveJourneyResponse(after.sessionId)
    const postcard = await service.createJourneyPostcard(after.sessionId)
    const stoppedAfter = service.exitJourney(after.sessionId, 'stop')
    expect(stoppedAfter).toMatchObject({
      state: 'stopped',
      artifactId: postcard.id,
    })
    expect(stoppedAfter.completedAt).toBeUndefined()
    expect(service.getJourneySnapshot().node.status).toBe('available')
  })

  it('rejects mismatched recipient entry and restores fixture state on reset', () => {
    expect(() =>
      service.startJourney({
        ...service.createSession(),
        recipientId: 'person-other',
      }),
    ).toThrowError(expect.objectContaining({ code: 'SESSION_SCOPE_MISMATCH' }))

    const { sessionId } = reachInspected(service)
    service.exitJourney(sessionId, 'reject')
    expect(service.getJourneySnapshot().node.status).toBe('rejected')
    service.reset()
    const reset = service.getJourneySnapshot()
    expect(reset.node.status).toBe('available')
    expect(reset.session).toBeUndefined()
    expect(reset.artifact).toBeUndefined()
  })

  it('keeps the rainy-day journey fixture after recorder capture changes', async () => {
    const snapshot = service.getSnapshot()
    const nextContext = {
      ...snapshot.context,
      id: 'context-new-capture',
      originalAssetId: 'asset-new-capture',
      topic: 'A different captured memory',
      derivedContentIds: [],
    }
    await service.saveReviewedCapture({
      context: nextContext,
      originalAsset: {
        ...snapshot.asset,
        id: nextContext.originalAssetId,
        contextId: nextContext.id,
      },
      derivedContent: [],
      generationPolicy: {
        ...snapshot.generationPolicy,
        allowedContextIds: [nextContext.id],
        allowedTopics: [nextContext.topic],
      },
      triggerPolicy: {
        relationshipId: snapshot.relationship.id,
        mode: 'pull_only',
        allowedReasons: ['user_opened'],
        optedIn: false,
      },
    })

    const started = service.startJourney(service.createSession())
    service.selectJourneyIntensity(started.id, 'quiet')
    expect(service.getJourneySnapshot().proposal?.sourceSelection).toMatchObject({
      sourceContextIds: ['context-rainy-day'],
      sourceAssetIds: ['asset-rainy-day'],
    })
  })
})
