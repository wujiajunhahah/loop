import type { Interaction } from '../../../domain'
import type { SourceBackedInteractionArtifact } from '../../artifact'
import {
  completeEchoMapNode,
  LOOP_FALLBACK_ACTION,
  transitionJourney,
  validateJourneyProposalRequest,
  type EchoMapNodeState,
  type JourneyAction,
  type JourneyEvent,
  type JourneyIntensity,
  type JourneyPresentation,
  type JourneyProposal,
  type JourneyRecipientResponse,
  type JourneySession,
} from '../domain'
import type {
  EchoMapJourneyData,
  EchoMapJourneySnapshot,
  JourneyExit,
  OfflineJourneyDependencies,
} from './types'

const nodeId = 'echo-node-rainy-day'

export type JourneyOrchestrationErrorCode =
  | 'JOURNEY_UNAVAILABLE'
  | 'JOURNEY_REQUEST_CANCELLED'
  | 'ARTIFACT_INTEGRITY_MISMATCH'
  | 'TRIGGER_NOT_ALLOWED'

export class JourneyOrchestrationError extends Error {
  constructor(
    readonly code: JourneyOrchestrationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'JourneyOrchestrationError'
  }
}

export class OfflineJourneyOrchestrator implements EchoMapJourneyData {
  private readonly proposals = new Map<string, JourneyProposal>()
  private readonly sessions = new Map<string, JourneySession>()
  private readonly presentations = new Map<string, JourneyPresentation>()
  private readonly responses = new Map<string, JourneyRecipientResponse>()
  private readonly artifacts = new Map<string, SourceBackedInteractionArtifact>()
  private readonly sources = new Map<string, ReturnType<OfflineJourneyDependencies['getSourceSnapshot']>>()
  private node!: EchoMapNodeState
  private currentSessionId?: string
  private sequence = 0
  private epoch = 0

  constructor(private readonly dependencies: OfflineJourneyDependencies) {
    this.reset()
  }

  reset(): void {
    this.proposals.clear()
    this.sessions.clear()
    this.presentations.clear()
    this.responses.clear()
    this.artifacts.clear()
    this.sources.clear()
    this.currentSessionId = undefined
    this.sequence = 0
    this.epoch += 1
    const source = this.dependencies.getSourceSnapshot()
    this.node = {
      nodeId,
      relationshipId: source.relationship.id,
      recipientId: source.relationship.recipientId,
      status: 'available',
      updatedAt: this.dependencies.now(),
    }
  }

  getJourneySnapshot(): EchoMapJourneySnapshot {
    const session = this.currentSessionId
      ? this.sessions.get(this.currentSessionId)
      : undefined
    const proposal = session ? this.proposals.get(session.proposalId) : undefined
    return structuredClone({
      node: this.node,
      ...(proposal ? { proposal } : {}),
      ...(session ? { session } : {}),
      ...(session && this.presentations.has(session.id)
        ? { presentation: this.presentations.get(session.id) }
        : {}),
      ...(session?.responseId
        ? { response: this.responses.get(session.responseId) }
        : {}),
      ...(session?.artifactId
        ? { artifact: this.artifacts.get(session.artifactId) }
        : {}),
    })
  }

  startJourney(recipientSession: Parameters<EchoMapJourneyData['startJourney']>[0]) {
    const source = this.dependencies.getSourceSnapshot()
    if (
      source.triggerPolicy.relationshipId !== source.relationship.id ||
      source.triggerPolicy.mode !== 'pull_only' ||
      !source.triggerPolicy.allowedReasons.includes('user_opened')
    ) {
      throw new JourneyOrchestrationError(
        'TRIGGER_NOT_ALLOWED',
        'The first offline journey requires a relationship-scoped pull-only user-opened trigger.',
      )
    }
    validateJourneyProposalRequest({
      request: {
        relationshipId: source.relationship.id,
        recipientId: source.relationship.recipientId,
        recipientSession,
        intensity: 'quiet',
        triggerReason: 'user_opened',
        candidateContextIds: [source.context.id],
      },
      relationship: source.relationship,
      policy: source.generationPolicy,
      contexts: [source.context],
    })
    const current = this.currentSessionId
      ? this.sessions.get(this.currentSessionId)
      : undefined
    const terminal = new Set(['node_lit', 'skipped', 'stopped', 'rejected', 'hidden', 'closed'])
    if (current && !terminal.has(current.state)) {
      throw new JourneyOrchestrationError(
        'JOURNEY_UNAVAILABLE',
        'An active journey must be stopped or closed before starting another.',
      )
    }
    if (this.node.status !== 'available') {
      throw new JourneyOrchestrationError(
        'JOURNEY_UNAVAILABLE',
        'This journey proposal is not available in the current Demo.',
      )
    }

    this.sequence += 1
    const sessionId = `journey-rainy-day-${this.sequence}`
    const proposal = this.createProposal(sessionId, 'quiet')
    const timestamp = this.dependencies.now()
    const session: JourneySession = {
      id: sessionId,
      proposalId: proposal.id,
      recipientSessionId: recipientSession.id,
      relationshipId: source.relationship.id,
      recipientId: source.relationship.recipientId,
      interactionId: `interaction:journey:${sessionId}`,
      intensity: 'quiet',
      state: 'map_ready',
      startedAt: timestamp,
      updatedAt: timestamp,
    }
    this.proposals.set(proposal.id, proposal)
    this.sessions.set(session.id, session)
    this.sources.set(session.id, structuredClone(source))
    this.currentSessionId = session.id
    return structuredClone(session)
  }

  selectJourneyIntensity(sessionId: string, intensity: JourneyIntensity) {
    const session = this.transition(sessionId, {
      type: 'SELECT_INTENSITY',
      intensity,
      at: this.dependencies.now(),
    })
    const proposal = this.createProposal(
      sessionId,
      intensity,
      this.requireSource(sessionId),
    )
    this.proposals.set(proposal.id, proposal)
    return structuredClone(session)
  }

  inspectJourneyProposal(sessionId: string) {
    return structuredClone(
      this.transition(sessionId, {
        type: 'INSPECT_PROPOSAL',
        at: this.dependencies.now(),
      }),
    )
  }

  acceptJourneyAction(sessionId: string, actionId: string) {
    const session = this.requireSession(sessionId)
    const proposal = this.requireProposal(session.proposalId)
    const action = [proposal.primaryAction, proposal.fallbackAction].find(
      (candidate) => candidate?.id === actionId,
    )
    if (!action) throw new Error(`Journey action ${actionId} is unavailable.`)
    const source = this.requireSource(sessionId)
    return structuredClone(
      this.transition(sessionId, {
        type: 'ACCEPT_ACTION',
        proposal,
        action,
        generationPolicy: source.generationPolicy,
        at: this.dependencies.now(),
      }),
    )
  }

  completeJourneyAction(sessionId: string) {
    return structuredClone(
      this.transition(sessionId, {
        type: 'COMPLETE_ACTION',
        at: this.dependencies.now(),
      }),
    )
  }

  async loadJourneyMemory(sessionId: string): Promise<JourneyPresentation> {
    const session = this.requireSession(sessionId)
    const source = this.requireSource(sessionId)
    const requestEpoch = this.epoch
    const interaction = this.createInteraction(session)
    const request = {
      interaction,
      sourceContextIds: [source.context.id],
      topic: source.context.topic,
      triggerReason: 'user_opened' as const,
    }
    const original = await this.dependencies.runAgent(source, {
      ...request,
      mode: 'source_replay',
    })
    const composition = session.requestedModes?.includes('source_composition')
      ? await this.dependencies.runAgent(source, {
          ...request,
          mode: 'source_composition',
        })
      : undefined
    const presentation: JourneyPresentation = {
      interactionId: session.interactionId,
      original: { ...original, outputMode: 'source_replay' },
      ...(composition
        ? { composition: { ...composition, outputMode: 'source_composition' as const } }
        : {}),
    }
    if (requestEpoch !== this.epoch) {
      throw new JourneyOrchestrationError(
        'JOURNEY_REQUEST_CANCELLED',
        'Journey memory request was cancelled by reset.',
      )
    }
    const current = this.requireSession(sessionId)
    const next = transitionJourney(current, {
      type: 'OPEN_MEMORY',
      presentation,
      relationship: source.relationship,
      generationPolicy: source.generationPolicy,
      contexts: [source.context],
      at: this.dependencies.now(),
    })
    this.presentations.set(sessionId, structuredClone(presentation))
    this.sessions.set(sessionId, next)
    return structuredClone(presentation)
  }

  saveJourneyResponse(sessionId: string, content?: string) {
    const session = this.requireSession(sessionId)
    const trimmed = content?.trim()
    const timestamp = this.dependencies.now()
    const response: JourneyRecipientResponse = {
      id: `response:${session.id}`,
      journeySessionId: session.id,
      relationshipId: session.relationshipId,
      authorId: session.recipientId,
      authorRole: 'recipient',
      kind: trimmed ? 'text' : 'omitted',
      ...(trimmed ? { content: trimmed } : {}),
      eligibleAsRecorderContext: false,
      createdAt: timestamp,
    }
    const next = transitionJourney(session, {
      type: 'SAVE_RESPONSE',
      response,
      at: timestamp,
    })
    this.responses.set(response.id, response)
    this.sessions.set(session.id, next)
    return structuredClone(response)
  }

  async createJourneyPostcard(sessionId: string) {
    let session = this.requireSession(sessionId)
    if (session.state === 'postcard_created' && session.artifactId) {
      const cached = this.artifacts.get(session.artifactId)
      const authoritative = await this.dependencies.artifacts.get(session.artifactId)
      if (!cached || !authoritative || !sameArtifact(cached, authoritative)) {
        throw new JourneyOrchestrationError(
          'ARTIFACT_INTEGRITY_MISMATCH',
          'Journey postcard retry found a mismatched stored tuple.',
        )
      }
      return structuredClone(authoritative)
    }

    const requestEpoch = this.epoch
    const requestedAt = session.artifactRequestedAt ?? this.dependencies.now()
    session = transitionJourney(session, {
      type: 'CREATE_POSTCARD',
      requestedAt,
      at: this.dependencies.now(),
    })
    this.sessions.set(session.id, session)

    try {
      const expectedId = `artifact:${session.interactionId}`
      const existing = await this.dependencies.artifacts.get(expectedId)
      const artifact = existing ?? (await this.createArtifact(session))
      if (requestEpoch !== this.epoch) {
        throw new JourneyOrchestrationError(
          'JOURNEY_REQUEST_CANCELLED',
          'Journey postcard request was cancelled by reset.',
        )
      }
      const current = this.requireSession(sessionId)
      const completed = transitionJourney(current, {
        type: 'POSTCARD_CREATED',
        artifact,
        at: this.dependencies.now(),
      })
      this.artifacts.set(artifact.id, structuredClone(artifact))
      this.sessions.set(session.id, completed)
      return structuredClone(artifact)
    } catch (error) {
      if (requestEpoch !== this.epoch) {
        throw new JourneyOrchestrationError(
          'JOURNEY_REQUEST_CANCELLED',
          'Journey postcard request was cancelled by reset.',
        )
      }
      const current = this.requireSession(sessionId)
      const failed = transitionJourney(current, {
        type: 'POSTCARD_FAILED',
        at: this.dependencies.now(),
      })
      this.sessions.set(session.id, failed)
      throw error
    }
  }

  async lightJourneyNode(sessionId: string) {
    const requestEpoch = this.epoch
    const session = this.requireSession(sessionId)
    if (!session.artifactId || !this.artifacts.has(session.artifactId)) {
      throw new Error('A valid journey postcard is required before node completion.')
    }
    const cached = this.artifacts.get(session.artifactId)
    const authoritative = await this.dependencies.artifacts.get(session.artifactId)
    if (!cached || !authoritative || !sameArtifact(cached, authoritative)) {
      throw new JourneyOrchestrationError(
        'ARTIFACT_INTEGRITY_MISMATCH',
        'Node completion found a mismatched authoritative artifact.',
      )
    }
    if (requestEpoch !== this.epoch) {
      throw new JourneyOrchestrationError(
        'JOURNEY_REQUEST_CANCELLED',
        'Node completion was cancelled by reset.',
      )
    }
    const current = this.requireSession(sessionId)
    const result = completeEchoMapNode(current, this.node, {
      journeySessionId: current.id,
      nodeId: this.node.nodeId,
      artifactId: current.artifactId!,
      completedAt: this.dependencies.now(),
    })
    this.sessions.set(current.id, result.session)
    this.node = result.node
    return structuredClone(this.node)
  }

  exitJourney(sessionId: string, exit: JourneyExit) {
    const eventByExit: Record<JourneyExit, JourneyEvent> = {
      skip: { type: 'SKIP', at: this.dependencies.now() },
      stop: { type: 'STOP', at: this.dependencies.now() },
      reject: { type: 'REJECT', at: this.dependencies.now() },
      hide: { type: 'HIDE', confirmed: true, at: this.dependencies.now() },
      close: { type: 'CLOSE', at: this.dependencies.now() },
    }
    const session = this.transition(sessionId, eventByExit[exit])
    if (exit === 'hide') {
      this.node = { ...this.node, status: 'hidden', updatedAt: session.updatedAt }
    }
    if (exit === 'reject') {
      this.node = { ...this.node, status: 'rejected', updatedAt: session.updatedAt }
    }
    return structuredClone(session)
  }

  private createProposal(
    sessionId: string,
    intensity: JourneyIntensity,
    source = this.dependencies.getSourceSnapshot(),
  ): JourneyProposal {
    const requestedModes =
      intensity !== 'quiet' &&
      source.generationPolicy.allowedModes.includes('source_composition')
        ? (['source_replay', 'source_composition'] as const)
        : (['source_replay'] as const)
    const fallbackAction: JourneyAction = {
      id: `action:neutral:${sessionId}`,
      kind: 'neutral_fallback',
      text: LOOP_FALLBACK_ACTION.text,
      authorship: {
        kind: 'loop',
        fixtureId: LOOP_FALLBACK_ACTION.fixtureId,
      },
      sourceContextIds: [source.context.id],
      aiGenerated: false,
    }
    return {
      id: `proposal:rainy-day:${sessionId}`,
      relationshipId: source.relationship.id,
      recipientId: source.relationship.recipientId,
      nodeId,
      title: 'Rain Under One Umbrella',
      intensity,
      rationale: 'Loop selected one approved rainy-day memory for this voluntary journey.',
      fallbackAction,
      sourceSelection: {
        sourceContextIds: [source.context.id],
        sourceAssetIds: [source.asset.id],
        selectionReason: 'The approved source is tagged for a rainy-day encounter.',
        requestedModes,
        sensitivity: source.context.sensitivityLevel,
      },
      triggerReason: 'user_opened',
      offline: true,
      userControls: [
        'inspect',
        'accept',
        'skip',
        'stop',
        'reject',
        'permanently_hide',
      ],
    }
  }

  private async createArtifact(session: JourneySession) {
    const source = this.requireSource(session.id)
    const presentation = this.presentations.get(session.id)
    const response = session.responseId
      ? this.responses.get(session.responseId)
      : undefined
    if (!presentation || !response || !session.artifactRequestedAt) {
      throw new Error('Journey presentation, response, and request time are required.')
    }
    const output = presentation.composition ?? presentation.original
    const interaction: Interaction = {
      ...this.createInteraction(session),
      completedAt: session.artifactRequestedAt,
      output: {
        outputType: output.outputMode === 'source_replay' ? 'original' : 'composition',
        content: output.content,
        provenance: output.provenance,
        confidence: output.confidence,
        sensitivity: output.sensitivity,
        triggerReason: output.triggerReason,
        userControls: ['replay', 'save', 'skip', 'close'],
      },
    }
    return this.dependencies.artifacts.create({
      interaction,
      relationship: source.relationship,
      policy: source.generationPolicy,
      contexts: [source.context],
      originalAssets: [source.asset],
      type: 'postcard',
      ...(response.kind === 'text' && response.content
        ? {
            recipientResponse: {
              content: response.content,
              authorId: response.authorId,
              authorRole: 'recipient' as const,
            },
          }
        : {}),
    })
  }

  private createInteraction(session: JourneySession): Interaction {
    return {
      id: session.interactionId,
      relationshipId: session.relationshipId,
      recipientId: session.recipientId,
      initiatedByRecipient: true,
      startedAt: session.startedAt,
    }
  }

  private transition(sessionId: string, event: JourneyEvent) {
    const next = transitionJourney(this.requireSession(sessionId), event)
    this.sessions.set(sessionId, next)
    return next
  }

  private requireSession(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Journey session ${sessionId} is unavailable.`)
    return session
  }

  private requireProposal(proposalId: string) {
    const proposal = this.proposals.get(proposalId)
    if (!proposal) throw new Error(`Journey proposal ${proposalId} is unavailable.`)
    return proposal
  }

  private requireSource(sessionId: string) {
    const source = this.sources.get(sessionId)
    if (!source) throw new Error(`Journey source for ${sessionId} is unavailable.`)
    return structuredClone(source)
  }
}

function sameArtifact(
  left: SourceBackedInteractionArtifact,
  right: SourceBackedInteractionArtifact,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
