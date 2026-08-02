import { hasValidProvenance, isContextVisibleTo } from '../../../domain'
import type {
  ApprovedJourneyInvitation,
  CompleteEchoMapNodeInput,
  CompleteEchoMapNodeResult,
  EchoMapNodeState,
  InvitationValidationInput,
  JourneyAction,
  JourneyEvent,
  JourneyIntensity,
  JourneyPresentation,
  JourneyProposalRequest,
  JourneyRecipientResponse,
  JourneySession,
  JourneyState,
  JourneyTerminalState,
  ProposalRequestValidationInput,
} from './types'

export type JourneyErrorCode =
  | 'INVALID_JOURNEY_TRANSITION'
  | 'RECIPIENT_ENTRY_REQUIRED'
  | 'SESSION_SCOPE_MISMATCH'
  | 'PROPOSAL_SOURCE_INVALID'
  | 'INVITATION_RELATIONSHIP_MISMATCH'
  | 'INVITATION_RECIPIENT_MISMATCH'
  | 'INVITATION_RECORDER_INVALID'
  | 'INVITATION_REVIEW_INVALID'
  | 'INVITATION_SOURCE_INVALID'
  | 'INVITATION_TEXT_INVALID'
  | 'INVITATION_ATTRIBUTION_INVALID'
  | 'ACTION_AUTHORSHIP_INVALID'
  | 'PRESENTATION_INVALID'
  | 'RESPONSE_INVALID'
  | 'ARTIFACT_REFERENCE_INVALID'
  | 'NODE_COMPLETION_INVALID'
  | 'NODE_COMPLETION_CONFLICT'

export class JourneyError extends Error {
  constructor(
    readonly code: JourneyErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'JourneyError'
  }
}

export const LOOP_FALLBACK_ACTION = Object.freeze({
  fixtureId: 'fallback-rain-window-v1' as const,
  text: 'Pause by a window and notice the rain or the light for one moment.',
})

const intensityRank: Record<JourneyIntensity, number> = {
  quiet: 0,
  glimmer: 1,
  deep: 2,
}

const terminalStates = new Set<JourneyTerminalState>([
  'node_lit',
  'skipped',
  'stopped',
  'rejected',
  'hidden',
  'closed',
])

const hideableStates = new Set<JourneyState>([
  'map_ready',
  'intensity_selected',
  'proposal_inspected',
  'action_accepted',
  'action_completed',
  'memory_opened',
])

const stoppableStates = new Set<JourneyState>([
  'action_accepted',
  'action_completed',
  'memory_opened',
  'response_recorded',
  'postcard_created',
])

export function reduceJourneyIntensity(
  selected: JourneyIntensity,
  automatedSuggestion: JourneyIntensity,
): JourneyIntensity {
  return intensityRank[automatedSuggestion] < intensityRank[selected]
    ? automatedSuggestion
    : selected
}

export function validateJourneyProposalRequest(
  input: ProposalRequestValidationInput,
): void {
  const { request, relationship, policy, contexts } = input
  const { recipientSession } = request
  if (!recipientSession.initiatedByRecipient || recipientSession.status !== 'active') {
    throw new JourneyError(
      'RECIPIENT_ENTRY_REQUIRED',
      'An active recipient-initiated session is required for a journey proposal.',
    )
  }
  if (
    recipientSession.relationshipId !== request.relationshipId ||
    recipientSession.recipientId !== request.recipientId
  ) {
    throw new JourneyError(
      'SESSION_SCOPE_MISMATCH',
      'The recipient session does not match the journey relationship and recipient.',
    )
  }
  if (request.triggerReason !== 'user_opened') {
    throw new JourneyError(
      'RECIPIENT_ENTRY_REQUIRED',
      'The first journey slice permits only a user-opened trigger.',
    )
  }
  if (
    relationship.id !== request.relationshipId ||
    relationship.recipientId !== request.recipientId ||
    relationship.status !== 'entrusted' ||
    policy.relationshipId !== relationship.id
  ) {
    throw new JourneyError(
      'SESSION_SCOPE_MISMATCH',
      'The proposal relationship and policy must match an entrusted recipient scope.',
    )
  }

  const candidateIds = [...new Set(request.candidateContextIds)]
  const contextsById = new Map(contexts.map((context) => [context.id, context]))
  if (
    candidateIds.length === 0 ||
    candidateIds.length !== request.candidateContextIds.length ||
    candidateIds.some((id) => {
      const candidate = contextsById.get(id)
      return (
        !candidate ||
        !policy.allowedContextIds.includes(id) ||
        !isContextVisibleTo(candidate, relationship, request.recipientId)
      )
    })
  ) {
    throw new JourneyError(
      'PROPOSAL_SOURCE_INVALID',
      'Proposal candidates must be unique, visible, and policy-approved sources.',
    )
  }
}

export function validateJourneyAction(action: JourneyAction): void {
  if (action.aiGenerated !== false || !action.text.trim()) {
    throw new JourneyError(
      'ACTION_AUTHORSHIP_INVALID',
      'Journey actions require non-generated, non-empty attributed text.',
    )
  }
  if (action.kind === 'neutral_fallback') {
    if (
      action.authorship.kind !== 'loop' ||
      action.authorship.fixtureId !== LOOP_FALLBACK_ACTION.fixtureId ||
      action.text !== LOOP_FALLBACK_ACTION.text
    ) {
      throw new JourneyError(
        'ACTION_AUTHORSHIP_INVALID',
        'The neutral fallback must use the immutable Loop-authored fixture.',
      )
    }
    return
  }
  if (action.authorship.kind !== 'recorder') {
    throw new JourneyError(
      'ACTION_AUTHORSHIP_INVALID',
      'A recorder invitation requires recorder authorship.',
    )
  }
}

export function validateApprovedJourneyInvitation(
  input: InvitationValidationInput,
): ApprovedJourneyInvitation {
  const { invitation, action, relationship, policy, contexts } = input
  validateJourneyAction(action)

  if (
    invitation.relationshipId !== relationship.id ||
    policy.relationshipId !== relationship.id
  ) {
    throw new JourneyError(
      'INVITATION_RELATIONSHIP_MISMATCH',
      'The invitation and policy must belong to the journey relationship.',
    )
  }
  if (invitation.recipientId !== relationship.recipientId) {
    throw new JourneyError(
      'INVITATION_RECIPIENT_MISMATCH',
      'The invitation recipient must match the journey recipient.',
    )
  }
  if (!relationship.recorderIds.includes(invitation.recorderId)) {
    throw new JourneyError(
      'INVITATION_RECORDER_INVALID',
      'The invitation author must be a recorder in the relationship.',
    )
  }
  if (
    invitation.status !== 'approved' ||
    invitation.reviewedByUserId !== relationship.ownerId ||
    !isValidTime(invitation.authoredAt) ||
    !isValidTime(invitation.reviewedAt) ||
    Date.parse(invitation.reviewedAt) < Date.parse(invitation.authoredAt)
  ) {
    throw new JourneyError(
      'INVITATION_REVIEW_INVALID',
      'The relationship owner must approve the invitation.',
    )
  }
  if (invitation.aiGenerated !== false) {
    throw new JourneyError(
      'INVITATION_ATTRIBUTION_INVALID',
      'A recorder-authored invitation cannot be AI-generated.',
    )
  }
  if (!invitation.exactText.trim() || action.text !== invitation.exactText) {
    throw new JourneyError(
      'INVITATION_TEXT_INVALID',
      'The action must preserve the exact approved invitation text.',
    )
  }
  if (
    action.kind !== 'recorder_invitation' ||
    action.authorship.kind !== 'recorder' ||
    action.authorship.authoredByUserId !== invitation.recorderId ||
    action.authorship.approvedInvitationId !== invitation.id
  ) {
    throw new JourneyError(
      'INVITATION_ATTRIBUTION_INVALID',
      'The action authorship must match the approved invitation.',
    )
  }

  const contextsById = new Map(contexts.map((context) => [context.id, context]))
  const uniqueSourceIds = [...new Set(invitation.sourceContextIds)]
  if (
    uniqueSourceIds.length === 0 ||
    uniqueSourceIds.length !== invitation.sourceContextIds.length ||
    new Set(action.sourceContextIds).size !== uniqueSourceIds.length ||
    action.sourceContextIds.some((id) => !uniqueSourceIds.includes(id)) ||
    uniqueSourceIds.some((id) => {
      const context = contextsById.get(id)
      return (
        !context ||
        !policy.allowedContextIds.includes(id) ||
        !isContextVisibleTo(context, relationship, relationship.recipientId)
      )
    })
  ) {
    throw new JourneyError(
      'INVITATION_SOURCE_INVALID',
      'Every invitation source must be unique, visible, policy-approved, and attached to the action.',
    )
  }

  return invitation
}

export function transitionJourney(
  session: JourneySession,
  event: JourneyEvent,
): JourneySession {
  requireValidTime(event.at, session.updatedAt)
  if (terminalStates.has(session.state as JourneyTerminalState)) {
    return invalidTransition(session, event)
  }

  if (event.type === 'HIDE') {
    if (!event.confirmed || !hideableStates.has(session.state) || session.artifactId) {
      return invalidTransition(session, event)
    }
    return terminal(session, 'hidden', event.at)
  }
  if (event.type === 'STOP') {
    if (!stoppableStates.has(session.state)) return invalidTransition(session, event)
    return terminal(session, 'stopped', event.at)
  }

  switch (session.state) {
    case 'map_ready':
      if (event.type === 'SELECT_INTENSITY') {
        return update(session, event.at, {
          intensity: event.intensity,
          state: 'intensity_selected',
        })
      }
      if (event.type === 'CLOSE') return terminal(session, 'closed', event.at)
      break
    case 'intensity_selected':
      if (event.type === 'SELECT_INTENSITY') {
        return update(session, event.at, { intensity: event.intensity })
      }
      if (event.type === 'INSPECT_PROPOSAL') {
        return update(session, event.at, { state: 'proposal_inspected' })
      }
      if (event.type === 'CLOSE') return terminal(session, 'closed', event.at)
      break
    case 'proposal_inspected':
      if (event.type === 'ACCEPT_ACTION') {
        validateAcceptedAction(session, event)
        return update(session, event.at, {
          state: 'action_accepted',
          selectedActionId: event.action.id,
          sourceContextIds: [...event.proposal.sourceSelection.sourceContextIds],
          sourceAssetIds: [...event.proposal.sourceSelection.sourceAssetIds],
          requestedModes: [...event.proposal.sourceSelection.requestedModes],
        })
      }
      if (event.type === 'SKIP') return terminal(session, 'skipped', event.at)
      if (event.type === 'REJECT') return terminal(session, 'rejected', event.at)
      break
    case 'action_accepted':
      if (event.type === 'COMPLETE_ACTION') {
        return update(session, event.at, { state: 'action_completed' })
      }
      break
    case 'action_completed':
      if (event.type === 'OPEN_MEMORY') {
        validatePresentation(
          session,
          event.presentation,
          event.relationship,
          event.generationPolicy,
          event.contexts,
        )
        const postcardOutput = event.presentation.composition ?? event.presentation.original
        return update(session, event.at, {
          state: 'memory_opened',
          presentationProvenance: postcardOutput.provenance,
          presentationGenerationLabel: postcardOutput.aiLabel,
          presentationContent: postcardOutput.content,
        })
      }
      break
    case 'memory_opened':
      if (event.type === 'SAVE_RESPONSE') {
        validateRecipientResponse(session, event.response, event.at)
        return update(session, event.at, {
          state: 'response_recorded',
          responseId: event.response.id,
          responseKind: event.response.kind,
          responseContent: event.response.content,
        })
      }
      break
    case 'response_recorded':
      if (event.type === 'CREATE_POSTCARD' && session.responseId) {
        if (
          session.artifactRequestedAt &&
          session.artifactRequestedAt !== event.requestedAt
        ) {
          return invalidTransition(session, event)
        }
        if (session.artifactRequestedAt) {
          if (!isValidTime(event.requestedAt)) return invalidTransition(session, event)
        } else {
          requireValidTime(event.requestedAt, session.updatedAt)
        }
        return update(session, event.at, {
          state: 'postcard_creating',
          artifactRequestedAt: session.artifactRequestedAt ?? event.requestedAt,
        })
      }
      break
    case 'postcard_creating':
      if (event.type === 'POSTCARD_CREATED') {
        validateArtifactReference(session, event.artifact)
        return update(session, event.at, {
          state: 'postcard_created',
          artifactId: event.artifact.id,
        })
      }
      if (event.type === 'POSTCARD_FAILED') {
        return update(session, event.at, { state: 'response_recorded' })
      }
      break
    case 'postcard_created':
      if (event.type === 'LIGHT_NODE') return invalidTransition(session, event)
      if (event.type === 'LIGHT_NODE_FAILED') {
        return update(session, event.at)
      }
      break
  }

  return invalidTransition(session, event)
}

export function completeEchoMapNode(
  session: JourneySession,
  node: EchoMapNodeState,
  input: CompleteEchoMapNodeInput,
): CompleteEchoMapNodeResult {
  const sameCompletedTuple =
    session.state === 'node_lit' &&
    node.status === 'lit' &&
    session.id === input.journeySessionId &&
    node.nodeId === input.nodeId &&
    session.artifactId === input.artifactId &&
    node.artifactId === input.artifactId &&
    node.journeySessionId === input.journeySessionId &&
    session.relationshipId === node.relationshipId &&
    session.recipientId === node.recipientId &&
    Boolean(session.completedAt)
  if (sameCompletedTuple) {
    return {
      session: session as JourneySession & {
        state: 'node_lit'
        completedAt: string
      },
      node: node as EchoMapNodeState & { status: 'lit'; artifactId: string },
      outcome: 'already_completed',
    }
  }

  if (node.status === 'lit') {
    throw new JourneyError(
      'NODE_COMPLETION_CONFLICT',
      'The Echo Map node is already linked to another completion tuple.',
    )
  }
  if (node.journeySessionId || node.artifactId) {
    throw new JourneyError(
      'NODE_COMPLETION_CONFLICT',
      'An available Echo Map node cannot already carry completion links.',
    )
  }
  if (
    session.state !== 'postcard_created' ||
    !isValidTime(input.completedAt) ||
    session.id !== input.journeySessionId ||
    node.nodeId !== input.nodeId ||
    session.artifactId !== input.artifactId ||
    input.artifactId !== `artifact:${session.interactionId}` ||
    session.relationshipId !== node.relationshipId ||
    session.recipientId !== node.recipientId ||
    node.status !== 'available'
  ) {
    throw new JourneyError(
      'NODE_COMPLETION_INVALID',
      'Node completion requires a matching postcard-created session, available node, and artifact.',
    )
  }

  requireValidTime(input.completedAt, session.updatedAt)

  const nextSession: JourneySession & { state: 'node_lit'; completedAt: string } = {
    ...session,
    state: 'node_lit',
    updatedAt: input.completedAt,
    terminalAt: input.completedAt,
    completedAt: input.completedAt,
  }
  const nextNode: EchoMapNodeState & { status: 'lit'; artifactId: string } = {
    ...node,
    status: 'lit',
    journeySessionId: session.id,
    artifactId: input.artifactId,
    updatedAt: input.completedAt,
  }
  return { session: nextSession, node: nextNode, outcome: 'completed' }
}

function update(
  session: JourneySession,
  updatedAt: string,
  changes: Partial<JourneySession> = {},
): JourneySession {
  return { ...session, ...changes, updatedAt }
}

function terminal(
  session: JourneySession,
  state: Exclude<JourneyTerminalState, 'node_lit'>,
  at: string,
): JourneySession {
  return { ...session, state, updatedAt: at, terminalAt: at }
}

function invalidTransition(
  session: JourneySession,
  event: JourneyEvent,
): never {
  throw new JourneyError(
    'INVALID_JOURNEY_TRANSITION',
    `Cannot apply ${event.type} to journey ${session.id} in ${session.state}.`,
  )
}

function validateAcceptedAction(
  session: JourneySession,
  event: Extract<JourneyEvent, { type: 'ACCEPT_ACTION' }>,
): void {
  const { proposal, action } = event
  const proposalAction = [proposal.primaryAction, proposal.fallbackAction].find(
    (candidate) => candidate?.id === action.id,
  )
  const requestedModes = proposal.sourceSelection.requestedModes
  const validModes =
    requestedModes.length > 0 &&
    new Set(requestedModes).size === requestedModes.length &&
    requestedModes.includes('source_replay') &&
    (session.intensity !== 'quiet' ||
      (requestedModes.length === 1 && requestedModes[0] === 'source_replay'))
  const policy = event.generationPolicy
  const validPolicy =
    policy.relationshipId === session.relationshipId &&
    proposal.sourceSelection.sourceContextIds.every((id) =>
      policy.allowedContextIds.includes(id),
    ) &&
    requestedModes.every((mode) => policy.allowedModes.includes(mode))
  if (
    proposal.id !== session.proposalId ||
    proposal.relationshipId !== session.relationshipId ||
    proposal.recipientId !== session.recipientId ||
    proposal.intensity !== session.intensity ||
    !proposalAction ||
    !validModes ||
    !validPolicy ||
    !sameAction(proposalAction, action) ||
    !sameIds(proposal.sourceSelection.sourceContextIds, action.sourceContextIds)
  ) {
    throw new JourneyError(
      'ACTION_AUTHORSHIP_INVALID',
      'The accepted action must belong to the inspected proposal and source scope.',
    )
  }
  validateJourneyAction(action)
  if (action.kind === 'recorder_invitation') {
    if (
      !event.invitationValidation ||
      !sameAction(event.invitationValidation.action, action)
    ) {
      throw new JourneyError(
        'ACTION_AUTHORSHIP_INVALID',
        'Recorder actions require their approved invitation validation input.',
      )
    }
    validateApprovedJourneyInvitation(event.invitationValidation)
    if (
      event.invitationValidation.relationship.id !== session.relationshipId ||
      event.invitationValidation.invitation.recipientId !== session.recipientId
    ) {
      throw new JourneyError(
        'INVITATION_RELATIONSHIP_MISMATCH',
        'The approved invitation must belong to the active journey scope.',
      )
    }
  } else if (event.invitationValidation) {
    throw new JourneyError(
      'ACTION_AUTHORSHIP_INVALID',
      'The Loop fallback cannot carry recorder invitation validation.',
    )
  }
}

function validatePresentation(
  session: JourneySession,
  presentation: JourneyPresentation,
  relationship: Extract<JourneyEvent, { type: 'OPEN_MEMORY' }>['relationship'],
  generationPolicy: Extract<JourneyEvent, { type: 'OPEN_MEMORY' }>['generationPolicy'],
  contexts: Extract<JourneyEvent, { type: 'OPEN_MEMORY' }>['contexts'],
): void {
  const original = presentation.original
  const composition = presentation.composition
  const contextsById = new Map(contexts.map((item) => [item.id, item]))
  const validScope = (
    result: JourneyPresentation['original'] | NonNullable<JourneyPresentation['composition']>,
  ) =>
    result.relationshipId === session.relationshipId &&
    result.recipientId === session.recipientId &&
    result.interactionId === session.interactionId &&
    result.triggerReason === 'user_opened' &&
    isValidTime(result.provenance.createdAt) &&
    sameIds(result.provenance.sourceAssetIds, session.sourceAssetIds ?? []) &&
    result.provenance.sourceAssetIds.every((assetId) =>
      result.provenance.sourceContextIds.some(
        (contextId) => contextsById.get(contextId)?.originalAssetId === assetId,
      ),
    )
  const validOriginal =
    relationship.id === session.relationshipId &&
    relationship.recipientId === session.recipientId &&
    relationship.status === 'entrusted' &&
    generationPolicy.relationshipId === relationship.id &&
    (session.sourceContextIds ?? []).every((id) =>
      generationPolicy.allowedContextIds.includes(id),
    ) &&
    (session.sourceContextIds ?? []).every((id) => {
      const item = contextsById.get(id)
      return Boolean(item && isContextVisibleTo(item, relationship, session.recipientId))
    }) &&
    presentation.interactionId === session.interactionId &&
    validScope(original) &&
    original.outputMode === 'source_replay' &&
    original.aiLabel === 'Original source' &&
    original.provenance.generationMode === 'source_replay' &&
    original.provenance.aiGenerated === false &&
    hasValidProvenance(original.provenance) &&
    sameIds(original.provenance.sourceContextIds, session.sourceContextIds ?? [])
  const validComposition =
    !composition ||
    (session.intensity !== 'quiet' &&
      session.requestedModes?.includes('source_composition') === true &&
      generationPolicy.allowedModes.includes('source_composition') &&
      validScope(composition) &&
      composition.outputMode === 'source_composition' &&
      composition.aiLabel === 'AI-generated' &&
      composition.provenance.generationMode === 'source_composition' &&
      composition.provenance.aiGenerated === true &&
      hasValidProvenance(composition.provenance) &&
      sameIds(composition.provenance.sourceContextIds, session.sourceContextIds ?? []) &&
      composition.ownerReview?.reviewedByUserId === relationship.ownerId &&
      isValidTime(composition.ownerReview.reviewedAt) &&
      Date.parse(composition.ownerReview.reviewedAt) >=
        Date.parse(composition.provenance.createdAt))
  if (!validOriginal || !validComposition) {
    throw new JourneyError(
      'PRESENTATION_INVALID',
      'Memory opening requires source-backed original and optional composition results.',
    )
  }
}

function validateRecipientResponse(
  session: JourneySession,
  response: JourneyRecipientResponse,
  eventAt: string,
): void {
  const validContent =
    (response.kind === 'omitted' && response.content === undefined) ||
    (response.kind === 'text' && Boolean(response.content?.trim()))
  if (
    !response.id.trim() ||
    response.journeySessionId !== session.id ||
    response.relationshipId !== session.relationshipId ||
    response.authorId !== session.recipientId ||
    response.authorRole !== 'recipient' ||
    response.eligibleAsRecorderContext !== false ||
    !isValidTime(response.createdAt) ||
    Date.parse(response.createdAt) < Date.parse(session.startedAt) ||
    Date.parse(response.createdAt) > Date.parse(eventAt) ||
    !validContent
  ) {
    throw new JourneyError(
      'RESPONSE_INVALID',
      'The response must be authored by this journey recipient or explicitly omitted.',
    )
  }
}

function validateArtifactReference(
  session: JourneySession,
  artifact: Extract<JourneyEvent, { type: 'POSTCARD_CREATED' }>['artifact'],
): void {
  const validResponse =
    (session.responseKind === 'omitted' &&
      artifact.recipientResponse === undefined &&
      artifact.recipientResponseAttribution === undefined) ||
    (session.responseKind === 'text' &&
      Boolean(artifact.recipientResponse?.trim()) &&
      artifact.recipientResponseAttribution?.authorId === session.recipientId &&
      artifact.recipientResponseAttribution.authorRole === 'recipient' &&
      artifact.recipientResponseAttribution.eligibleAsRecorderContext === false)
  if (
    artifact.id !== `artifact:${session.interactionId}` ||
    artifact.interactionId !== session.interactionId ||
    artifact.relationshipId !== session.relationshipId ||
    artifact.recipientId !== session.recipientId ||
    artifact.type !== 'postcard' ||
    artifact.saved !== true ||
    artifact.createdAt !== session.artifactRequestedAt ||
    artifact.generatedSummary !== session.presentationContent ||
    artifact.originalQuoteAssetId === undefined ||
    !session.sourceAssetIds?.includes(artifact.originalQuoteAssetId) ||
    !hasValidProvenance(artifact.provenance) ||
    artifact.generationLabel !== session.presentationGenerationLabel ||
    !sameProvenance(artifact.provenance, session.presentationProvenance) ||
    !sameIds(artifact.sourceContextIds, session.sourceContextIds ?? []) ||
    (session.responseKind === 'text' &&
      artifact.recipientResponse !== session.responseContent) ||
    !validResponse
  ) {
    throw new JourneyError(
      'ARTIFACT_REFERENCE_INVALID',
      'The artifact must match the stable journey interaction and source scope.',
    )
  }
}

function sameAction(left: JourneyAction, right: JourneyAction): boolean {
  return (
    left.kind === right.kind &&
    left.text === right.text &&
    left.aiGenerated === right.aiGenerated &&
    sameIds(left.sourceContextIds, right.sourceContextIds) &&
    JSON.stringify(left.authorship) === JSON.stringify(right.authorship)
  )
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length > 0 &&
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every((id) => right.includes(id))
  )
}

function sameProvenance(
  left: JourneyPresentation['original']['provenance'],
  right: JourneyPresentation['original']['provenance'] | undefined,
): boolean {
  return (
    Boolean(right) &&
    left.generationMode === right?.generationMode &&
    left.aiGenerated === right.aiGenerated &&
    left.createdAt === right.createdAt &&
    left.model === right.model &&
    sameIds(left.sourceContextIds, right.sourceContextIds) &&
    sameIds(left.sourceAssetIds, right.sourceAssetIds)
  )
}

function isValidTime(value: string): boolean {
  return Boolean(value.trim()) && Number.isFinite(Date.parse(value))
}

function requireValidTime(value: string, notBefore: string): void {
  if (
    !isValidTime(value) ||
    !isValidTime(notBefore) ||
    Date.parse(value) < Date.parse(notBefore)
  ) {
    throw new JourneyError(
      'INVALID_JOURNEY_TRANSITION',
      'Journey event timestamps must be valid and monotonic.',
    )
  }
}
