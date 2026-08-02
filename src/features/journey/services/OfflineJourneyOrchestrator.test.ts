import { describe, expect, it, vi } from 'vitest'
import type {
  ContextItem,
  GenerationPolicy,
  OriginalAsset,
  RecipientSession,
  TriggerPolicy,
  V2Relationship,
} from '../../../domain'
import type {
  RecipientAgentRequest,
  RecipientAgentResult,
} from '../../agent'
import {
  InteractionArtifactService,
  type SourceBackedInteractionArtifact,
} from '../../artifact'
import { OfflineJourneyOrchestrator } from './OfflineJourneyOrchestrator'
import type {
  JourneyArtifactPort,
  JourneySourceSnapshot,
  OfflineJourneyDependencies,
} from './types'

const now = '2026-08-02T10:00:00.000Z'

const relationship: V2Relationship = {
  contractVersion: 2,
  id: 'relationship-a',
  subjectId: 'recorder-a',
  ownerId: 'recorder-a',
  recorderIds: ['recorder-a'],
  recipientId: 'recipient-a',
  label: 'Mother and daughter',
  kind: 'parent_child',
  status: 'entrusted',
}

const context: ContextItem = {
  id: 'context-a',
  subjectId: 'recorder-a',
  recorderId: 'recorder-a',
  recipientId: 'recipient-a',
  relationshipId: 'relationship-a',
  sourceType: 'user_written',
  modality: 'text',
  captureMode: 'guided',
  originalAssetId: 'asset-a',
  derivedContentIds: [],
  topic: 'Rain',
  meaning: 'One umbrella on the walk home.',
  importanceWeight: 0.8,
  sensitivityLevel: 'low',
  visibility: 'relationship_specific',
  intendedScenarios: ['rainy day'],
  createdAt: now,
  updatedAt: now,
}

const asset: OriginalAsset = {
  id: 'asset-a',
  contextId: context.id,
  modality: 'text',
  uri: 'data:text/plain,rain',
  capturedAt: now,
}

const generationPolicy: GenerationPolicy = {
  relationshipId: relationship.id,
  allowedContextIds: [context.id],
  allowedModes: ['source_replay', 'source_composition'],
  allowedTopics: [context.topic],
  forbiddenTopics: [],
  sourceRequired: true,
  aiLabelRequired: true,
  highRiskBlocked: true,
  newFactsAllowed: false,
  majorDecisionsAllowed: false,
}

const triggerPolicy: TriggerPolicy = {
  relationshipId: relationship.id,
  mode: 'pull_only',
  allowedReasons: ['user_opened'],
  optedIn: false,
}

const source: JourneySourceSnapshot = {
  relationship,
  context,
  asset,
  generationPolicy,
  triggerPolicy,
}

const recipientSession: RecipientSession = {
  id: 'recipient-session-a',
  relationshipId: relationship.id,
  recipientId: relationship.recipientId,
  initiatedByRecipient: true,
  status: 'active',
  startedAt: now,
}

function agentResult(request: RecipientAgentRequest): RecipientAgentResult {
  return {
    relationshipId: relationship.id,
    recipientId: relationship.recipientId,
    interactionId: request.interaction.id,
    outputMode: 'source_replay',
    content: asset.uri,
    provenance: {
      sourceContextIds: [context.id],
      sourceAssetIds: [asset.id],
      generationMode: 'source_replay',
      aiGenerated: false,
      createdAt: now,
    },
    aiLabel: 'Original source',
    sensitivity: 'low',
    triggerReason: 'user_opened',
  }
}

function artifactPort() {
  const service = new InteractionArtifactService()
  let authoritative: SourceBackedInteractionArtifact | undefined
  const port: JourneyArtifactPort = {
    create: async (input) => {
      authoritative = await service.create(input)
      return authoritative
    },
    get: async () => authoritative,
  }
  return {
    port,
    replace: (artifact: SourceBackedInteractionArtifact) => {
      authoritative = artifact
    },
  }
}

function dependencies(
  overrides: Partial<OfflineJourneyDependencies> = {},
): OfflineJourneyDependencies {
  const artifacts = artifactPort()
  return {
    getSourceSnapshot: () => structuredClone(source),
    runAgent: async (_source, request) => agentResult(request),
    artifacts: artifacts.port,
    now: () => now,
    ...overrides,
  }
}

function reachAction(orchestrator: OfflineJourneyOrchestrator) {
  const started = orchestrator.startJourney(recipientSession)
  orchestrator.selectJourneyIntensity(started.id, 'quiet')
  orchestrator.inspectJourneyProposal(started.id)
  const actionId = orchestrator.getJourneySnapshot().proposal!.fallbackAction.id
  orchestrator.acceptJourneyAction(started.id, actionId)
  orchestrator.completeJourneyAction(started.id)
  return started.id
}

async function reachResponse(orchestrator: OfflineJourneyOrchestrator) {
  const sessionId = reachAction(orchestrator)
  await orchestrator.loadJourneyMemory(sessionId)
  orchestrator.saveJourneyResponse(sessionId, 'Still here.')
  return sessionId
}

describe('OfflineJourneyOrchestrator recovery', () => {
  it('does not reopen a session stopped while Agent output is pending', async () => {
    let resolve!: (result: RecipientAgentResult) => void
    let request!: RecipientAgentRequest
    const pending = new Promise<RecipientAgentResult>((next) => {
      resolve = next
    })
    const orchestrator = new OfflineJourneyOrchestrator(
      dependencies({
        runAgent: async (_source, nextRequest) => {
          request = nextRequest
          return pending
        },
      }),
    )
    const sessionId = reachAction(orchestrator)
    const loading = orchestrator.loadJourneyMemory(sessionId)
    orchestrator.exitJourney(sessionId, 'stop')
    resolve(agentResult(request))

    await expect(loading).rejects.toMatchObject({
      code: 'INVALID_JOURNEY_TRANSITION',
    })
    expect(orchestrator.getJourneySnapshot().session?.state).toBe('stopped')
  })

  it('does not repopulate state from a request cancelled by reset', async () => {
    let resolve!: (result: RecipientAgentResult) => void
    let request!: RecipientAgentRequest
    const pending = new Promise<RecipientAgentResult>((next) => {
      resolve = next
    })
    const orchestrator = new OfflineJourneyOrchestrator(
      dependencies({
        runAgent: async (_source, nextRequest) => {
          request = nextRequest
          return pending
        },
      }),
    )
    const sessionId = reachAction(orchestrator)
    const loading = orchestrator.loadJourneyMemory(sessionId)
    orchestrator.reset()
    resolve(agentResult(request))

    await expect(loading).rejects.toThrow('cancelled by reset')
    expect(orchestrator.getJourneySnapshot().session).toBeUndefined()
  })

  it('freezes the source snapshot for the full journey', async () => {
    let activeSource = structuredClone(source)
    const seen: string[] = []
    const orchestrator = new OfflineJourneyOrchestrator(
      dependencies({
        getSourceSnapshot: () => structuredClone(activeSource),
        runAgent: async (frozen, request) => {
          seen.push(frozen.context.id)
          return agentResult(request)
        },
      }),
    )
    const sessionId = reachAction(orchestrator)
    activeSource = {
      ...activeSource,
      context: { ...activeSource.context, id: 'context-b' },
    }
    await orchestrator.loadJourneyMemory(sessionId)
    expect(seen).toEqual(['context-a'])
  })

  it('retains the stable request and retries after artifact creation failure', async () => {
    const actual = artifactPort()
    let attempts = 0
    const create = actual.port.create
    const orchestrator = new OfflineJourneyOrchestrator(
      dependencies({
        artifacts: {
          get: actual.port.get,
          create: async (input) => {
            attempts += 1
            if (attempts === 1) throw new Error('artifact unavailable')
            return create(input)
          },
        },
      }),
    )
    const sessionId = await reachResponse(orchestrator)
    await expect(orchestrator.createJourneyPostcard(sessionId)).rejects.toThrow(
      'artifact unavailable',
    )
    const requestedAt = orchestrator.getJourneySnapshot().session?.artifactRequestedAt
    const artifact = await orchestrator.createJourneyPostcard(sessionId)
    expect(artifact.createdAt).toBe(requestedAt)
    expect(attempts).toBe(2)
  })

  it('rejects a mismatched authoritative artifact on retry', async () => {
    const store = artifactPort()
    const orchestrator = new OfflineJourneyOrchestrator(
      dependencies({ artifacts: store.port }),
    )
    const sessionId = await reachResponse(orchestrator)
    const artifact = await orchestrator.createJourneyPostcard(sessionId)
    store.replace(
      Object.freeze({ ...artifact, generatedSummary: 'mismatched output' }),
    )

    await expect(orchestrator.createJourneyPostcard(sessionId)).rejects.toMatchObject({
      code: 'ARTIFACT_INTEGRITY_MISMATCH',
    })
    await expect(orchestrator.lightJourneyNode(sessionId)).rejects.toMatchObject({
      code: 'ARTIFACT_INTEGRITY_MISMATCH',
    })
  })

  it('does not resurrect postcard state when reset wins an artifact request', async () => {
    const service = new InteractionArtifactService()
    let resolve!: (artifact: SourceBackedInteractionArtifact) => void
    let captured: Parameters<JourneyArtifactPort['create']>[0] | undefined
    const pending = new Promise<SourceBackedInteractionArtifact>((next) => {
      resolve = next
    })
    const orchestrator = new OfflineJourneyOrchestrator(
      dependencies({
        artifacts: {
          get: async () => undefined,
          create: async (input) => {
            captured = input
            return pending
          },
        },
      }),
    )
    const sessionId = await reachResponse(orchestrator)
    const creating = orchestrator.createJourneyPostcard(sessionId)
    await vi.waitFor(() => expect(captured).toBeDefined())
    orchestrator.reset()
    resolve(await service.create(captured!))

    await expect(creating).rejects.toMatchObject({
      code: 'JOURNEY_REQUEST_CANCELLED',
    })
    expect(orchestrator.getJourneySnapshot().session).toBeUndefined()
    expect(orchestrator.getJourneySnapshot().artifact).toBeUndefined()
  })

  it('blocks another journey after the one-node fixture is completed', async () => {
    const orchestrator = new OfflineJourneyOrchestrator(dependencies())
    const sessionId = await reachResponse(orchestrator)
    await orchestrator.createJourneyPostcard(sessionId)
    await orchestrator.lightJourneyNode(sessionId)

    expect(() => orchestrator.startJourney(recipientSession)).toThrow(
      'not available',
    )
  })

  it('recovers from Agent failure without advancing the session', async () => {
    const runAgent = vi
      .fn<OfflineJourneyDependencies['runAgent']>()
      .mockRejectedValueOnce(new Error('agent unavailable'))
      .mockImplementation(async (_source, request) => agentResult(request))
    const orchestrator = new OfflineJourneyOrchestrator(
      dependencies({ runAgent }),
    )
    const sessionId = reachAction(orchestrator)
    await expect(orchestrator.loadJourneyMemory(sessionId)).rejects.toThrow(
      'agent unavailable',
    )
    expect(orchestrator.getJourneySnapshot().session?.state).toBe(
      'action_completed',
    )
    await expect(orchestrator.loadJourneyMemory(sessionId)).resolves.toBeDefined()
  })

  it('rejects unsolicited trigger policy before creating a session', () => {
    const orchestrator = new OfflineJourneyOrchestrator(
      dependencies({
        getSourceSnapshot: () => ({
          ...structuredClone(source),
          triggerPolicy: {
            ...triggerPolicy,
            mode: 'scheduled_opt_in',
            allowedReasons: ['scheduled_date'],
            optedIn: false,
          },
        }),
      }),
    )

    expect(() => orchestrator.startJourney(recipientSession)).toThrowError(
      expect.objectContaining({ code: 'TRIGGER_NOT_ALLOWED' }),
    )
    expect(orchestrator.getJourneySnapshot().session).toBeUndefined()
  })
})
