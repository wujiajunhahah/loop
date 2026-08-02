import { describe, expect, it } from 'vitest'
import type {
  ContextItem,
  GenerationPolicy,
  RecipientSession,
  V2Relationship,
} from '../../../domain'
import {
  completeEchoMapNode,
  LOOP_FALLBACK_ACTION,
  reduceJourneyIntensity,
  transitionJourney,
  validateApprovedJourneyInvitation,
  validateJourneyAction,
  validateJourneyProposalRequest,
} from './journey'
import type {
  ApprovedJourneyInvitation,
  EchoMapNodeState,
  JourneyAction,
  JourneyEvent,
  JourneyIntensity,
  JourneyPresentation,
  JourneyProposal,
  JourneyProposalRequest,
  JourneyRecipientResponse,
  JourneySession,
  JourneyState,
} from './types'

const now = '2026-08-02T10:00:00.000Z'
const later = '2026-08-02T10:01:00.000Z'

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

const policy: GenerationPolicy = {
  relationshipId: 'relationship-a',
  allowedContextIds: ['context-a'],
  allowedModes: ['source_replay', 'source_composition'],
  allowedTopics: ['Rain'],
  forbiddenTopics: [],
  sourceRequired: true,
  aiLabelRequired: true,
  highRiskBlocked: true,
  newFactsAllowed: false,
  majorDecisionsAllowed: false,
}

const recipientSession: RecipientSession = {
  id: 'recipient-session-a',
  relationshipId: 'relationship-a',
  recipientId: 'recipient-a',
  initiatedByRecipient: true,
  status: 'active',
  startedAt: now,
}

function session(
  state: JourneyState = 'map_ready',
  overrides: Partial<JourneySession> = {},
): JourneySession {
  return {
    id: 'journey-a',
    proposalId: 'proposal-a',
    recipientSessionId: recipientSession.id,
    relationshipId: relationship.id,
    recipientId: relationship.recipientId,
    interactionId: 'interaction:journey:journey-a',
    intensity: 'quiet',
    state,
    startedAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function proposalRequest(
  overrides: Partial<JourneyProposalRequest> = {},
): JourneyProposalRequest {
  return {
    relationshipId: relationship.id,
    recipientId: relationship.recipientId,
    recipientSession,
    intensity: 'quiet',
    triggerReason: 'user_opened',
    candidateContextIds: [context.id],
    ...overrides,
  }
}

const invitation: ApprovedJourneyInvitation = {
  id: 'invitation-a',
  relationshipId: relationship.id,
  recipientId: relationship.recipientId,
  recorderId: 'recorder-a',
  exactText: 'Take one quiet look at the rain.',
  sourceContextIds: [context.id],
  authoredAt: now,
  reviewedByUserId: relationship.ownerId,
  reviewedAt: now,
  status: 'approved',
  aiGenerated: false,
}

const recorderAction: JourneyAction = {
  id: 'action-recorder',
  kind: 'recorder_invitation',
  text: invitation.exactText,
  authorship: {
    kind: 'recorder',
    authoredByUserId: invitation.recorderId,
    approvedInvitationId: invitation.id,
  },
  sourceContextIds: [context.id],
  aiGenerated: false,
}

const fallbackAction: JourneyAction = {
  id: 'action-fallback',
  kind: 'neutral_fallback',
  text: LOOP_FALLBACK_ACTION.text,
  authorship: {
    kind: 'loop',
    fixtureId: LOOP_FALLBACK_ACTION.fixtureId,
  },
  sourceContextIds: [context.id],
  aiGenerated: false,
}

const proposal: JourneyProposal = {
  id: 'proposal-a',
  relationshipId: relationship.id,
  recipientId: relationship.recipientId,
  nodeId: 'node-a',
  title: 'Rain Under One Umbrella',
  intensity: 'quiet',
  rationale: 'A source-backed rainy-day memory is available.',
  primaryAction: recorderAction,
  fallbackAction,
  sourceSelection: {
    sourceContextIds: [context.id],
    sourceAssetIds: [context.originalAssetId],
    selectionReason: 'The approved source is tagged for a rainy day.',
    requestedModes: ['source_replay'],
    sensitivity: 'low',
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

const presentation: JourneyPresentation = {
  interactionId: 'interaction:journey:journey-a',
  original: {
    relationshipId: relationship.id,
    recipientId: relationship.recipientId,
    interactionId: 'interaction:journey:journey-a',
    outputMode: 'source_replay',
    content: 'asset://rain',
    provenance: {
      sourceContextIds: [context.id],
      sourceAssetIds: [context.originalAssetId],
      generationMode: 'source_replay',
      aiGenerated: false,
      createdAt: now,
    },
    aiLabel: 'Original source',
    sensitivity: 'low',
    triggerReason: 'user_opened',
  },
}

const compositionPresentation: JourneyPresentation = {
  ...presentation,
  composition: {
    relationshipId: relationship.id,
    recipientId: relationship.recipientId,
    interactionId: presentation.interactionId,
    outputMode: 'source_composition',
    content: 'Mei remembers one umbrella on the walk home.',
    provenance: {
      sourceContextIds: [context.id],
      sourceAssetIds: [context.originalAssetId],
      generationMode: 'source_composition',
      aiGenerated: true,
      model: 'offline-fixture',
      createdAt: now,
    },
    aiLabel: 'AI-generated',
    sensitivity: 'low',
    triggerReason: 'user_opened',
    ownerReview: {
      reviewedByUserId: relationship.ownerId,
      reviewedAt: now,
    },
  },
}

const response: JourneyRecipientResponse = {
  id: 'response-a',
  journeySessionId: 'journey-a',
  relationshipId: relationship.id,
  authorId: relationship.recipientId,
  authorRole: 'recipient',
  kind: 'text',
  content: 'I heard rain today.',
  eligibleAsRecorderContext: false,
  createdAt: later,
}

const artifactId = 'artifact:interaction:journey:journey-a'
const artifactReference = {
  id: artifactId,
  interactionId: 'interaction:journey:journey-a',
  relationshipId: relationship.id,
  recipientId: relationship.recipientId,
  type: 'postcard' as const,
  sourceContextIds: [context.id],
  generatedSummary: presentation.original.content,
  originalQuoteAssetId: context.originalAssetId,
  createdAt: later,
  recipientResponse: response.content,
  saved: true,
  generationLabel: 'Original source' as const,
  provenance: presentation.original.provenance,
  recipientResponseAttribution: {
    authorId: relationship.recipientId,
    authorRole: 'recipient' as const,
    eligibleAsRecorderContext: false as const,
  },
}

function expectJourneyError(run: () => unknown, code: string) {
  expect(run).toThrowError(expect.objectContaining({ code }))
}

describe('journey intensity', () => {
  const intensities: readonly JourneyIntensity[] = ['quiet', 'glimmer', 'deep']

  it.each(
    intensities.flatMap((selected) =>
      intensities.map((suggested) => [selected, suggested] as const),
    ),
  )('never upgrades %s from automation suggestion %s', (selected, suggested) => {
    const result = reduceJourneyIntensity(selected, suggested)
    const expected =
      intensities.indexOf(suggested) < intensities.indexOf(selected)
        ? suggested
        : selected
    expect(result).toBe(expected)
    expect(intensities.indexOf(result)).toBeLessThanOrEqual(
      intensities.indexOf(selected),
    )
  })
})

describe('journey proposal entry', () => {
  it('requires an active recipient-initiated session in the same scope', () => {
    const validInput = {
      request: proposalRequest(),
      relationship,
      policy,
      contexts: [context],
    }
    expect(() => validateJourneyProposalRequest(validInput)).not.toThrow()

    expectJourneyError(
      () =>
        validateJourneyProposalRequest({
          ...validInput,
          request: proposalRequest({
            recipientSession: {
              ...recipientSession,
              initiatedByRecipient: false,
            },
          }),
        }),
      'RECIPIENT_ENTRY_REQUIRED',
    )
    expectJourneyError(
      () =>
        validateJourneyProposalRequest({
          ...validInput,
          request: proposalRequest({
            recipientSession: { ...recipientSession, status: 'closed' },
          }),
        }),
      'RECIPIENT_ENTRY_REQUIRED',
    )
    expectJourneyError(
      () =>
        validateJourneyProposalRequest({
          ...validInput,
          request: proposalRequest({
            recipientSession: {
              ...recipientSession,
              relationshipId: 'relationship-b',
            },
          }),
        }),
      'SESSION_SCOPE_MISMATCH',
    )
    expectJourneyError(
      () =>
        validateJourneyProposalRequest({
          ...validInput,
          request: proposalRequest({
            recipientSession: {
              ...recipientSession,
              recipientId: 'recipient-b',
            },
          }),
        }),
      'SESSION_SCOPE_MISMATCH',
    )
  })

  it('allows only the user-opened trigger', () => {
    expectJourneyError(
      () =>
        validateJourneyProposalRequest({
          request: {
            ...proposalRequest(),
            triggerReason: 'weather_context',
          } as unknown as JourneyProposalRequest,
          relationship,
          policy,
          contexts: [context],
        }),
      'RECIPIENT_ENTRY_REQUIRED',
    )
  })

  it('requires unique visible policy-approved candidate sources', () => {
    const validInput = {
      request: proposalRequest(),
      relationship,
      policy,
      contexts: [context],
    }
    expectJourneyError(
      () =>
        validateJourneyProposalRequest({
          ...validInput,
          request: proposalRequest({ candidateContextIds: [] }),
        }),
      'PROPOSAL_SOURCE_INVALID',
    )
    expectJourneyError(
      () =>
        validateJourneyProposalRequest({
          ...validInput,
          request: proposalRequest({ candidateContextIds: [context.id, context.id] }),
        }),
      'PROPOSAL_SOURCE_INVALID',
    )
    expectJourneyError(
      () =>
        validateJourneyProposalRequest({
          ...validInput,
          contexts: [{ ...context, visibility: 'private' }],
        }),
      'PROPOSAL_SOURCE_INVALID',
    )
  })
})

describe('journey action authorship', () => {
  it('accepts only the immutable Loop fallback shape', () => {
    expect(() => validateJourneyAction(fallbackAction)).not.toThrow()

    expectJourneyError(
      () =>
        validateJourneyAction({
          ...fallbackAction,
          text: 'Pretend Mei asked you to walk outside.',
        }),
      'ACTION_AUTHORSHIP_INVALID',
    )
    expectJourneyError(
      () =>
        validateJourneyAction({
          ...fallbackAction,
          authorship: {
            kind: 'recorder',
            authoredByUserId: 'recorder-a',
            approvedInvitationId: 'invitation-a',
          },
        }),
      'ACTION_AUTHORSHIP_INVALID',
    )
  })

  it('does not allow Loop authorship on recorder invitations', () => {
    expectJourneyError(
      () =>
        validateJourneyAction({
          ...recorderAction,
          authorship: {
            kind: 'loop',
            fixtureId: LOOP_FALLBACK_ACTION.fixtureId,
          },
        }),
      'ACTION_AUTHORSHIP_INVALID',
    )
  })
})

describe('approved journey invitation', () => {
  const validInput = {
    invitation,
    action: recorderAction,
    relationship,
    policy,
    contexts: [context],
  }

  it('accepts exact recorder authorship, owner review, scope, and sources', () => {
    expect(validateApprovedJourneyInvitation(validInput)).toBe(invitation)
  })

  it.each([
    [
      'INVITATION_RELATIONSHIP_MISMATCH',
      { invitation: { ...invitation, relationshipId: 'relationship-b' } },
    ],
    [
      'INVITATION_RECIPIENT_MISMATCH',
      { invitation: { ...invitation, recipientId: 'recipient-b' } },
    ],
    [
      'INVITATION_RECORDER_INVALID',
      { invitation: { ...invitation, recorderId: 'recorder-b' } },
    ],
    [
      'INVITATION_REVIEW_INVALID',
      { invitation: { ...invitation, reviewedByUserId: 'recipient-a' } },
    ],
    [
      'INVITATION_REVIEW_INVALID',
      { invitation: { ...invitation, reviewedAt: '' } },
    ],
    [
      'INVITATION_REVIEW_INVALID',
      { invitation: { ...invitation, authoredAt: 'not-a-time' } },
    ],
    [
      'INVITATION_TEXT_INVALID',
      { invitation: { ...invitation, exactText: '' } },
    ],
    [
      'INVITATION_TEXT_INVALID',
      { action: { ...recorderAction, text: 'Changed text' } },
    ],
    [
      'INVITATION_ATTRIBUTION_INVALID',
      {
        action: {
          ...recorderAction,
          authorship: {
            kind: 'recorder' as const,
            authoredByUserId: 'recorder-b',
            approvedInvitationId: invitation.id,
          },
        },
      },
    ],
    [
      'INVITATION_SOURCE_INVALID',
      { invitation: { ...invitation, sourceContextIds: [] } },
    ],
    [
      'INVITATION_SOURCE_INVALID',
      {
        invitation: { ...invitation, sourceContextIds: ['context-a', 'context-b'] },
        action: { ...recorderAction, sourceContextIds: ['context-a', 'context-a'] },
      },
    ],
    [
      'INVITATION_SOURCE_INVALID',
      { contexts: [{ ...context, visibility: 'private' as const }] },
    ],
    [
      'INVITATION_SOURCE_INVALID',
      { policy: { ...policy, allowedContextIds: [] } },
    ],
  ])('rejects invalid invitation boundary %s', (code, overrides) => {
    expectJourneyError(
      () =>
        validateApprovedJourneyInvitation({
          ...validInput,
          ...overrides,
        }),
      code,
    )
  })

  it('rejects generated invitation attribution at runtime', () => {
    expectJourneyError(
      () =>
        validateApprovedJourneyInvitation({
          ...validInput,
          invitation: {
            ...invitation,
            aiGenerated: true,
          } as unknown as ApprovedJourneyInvitation,
        }),
      'INVITATION_ATTRIBUTION_INVALID',
    )
  })
})

describe('journey state machine', () => {
  const validTransitions: readonly [
    JourneyState,
    JourneyEvent,
    JourneyState,
  ][] = [
    [
      'map_ready',
      { type: 'SELECT_INTENSITY', intensity: 'glimmer', at: later },
      'intensity_selected',
    ],
    ['map_ready', { type: 'CLOSE', at: later }, 'closed'],
    [
      'intensity_selected',
      { type: 'SELECT_INTENSITY', intensity: 'deep', at: later },
      'intensity_selected',
    ],
    [
      'intensity_selected',
      { type: 'INSPECT_PROPOSAL', at: later },
      'proposal_inspected',
    ],
    ['intensity_selected', { type: 'CLOSE', at: later }, 'closed'],
    [
      'proposal_inspected',
      {
        type: 'ACCEPT_ACTION',
        proposal,
        action: fallbackAction,
        generationPolicy: policy,
        at: later,
      },
      'action_accepted',
    ],
    ['proposal_inspected', { type: 'SKIP', at: later }, 'skipped'],
    ['proposal_inspected', { type: 'REJECT', at: later }, 'rejected'],
    [
      'action_accepted',
      { type: 'COMPLETE_ACTION', at: later },
      'action_completed',
    ],
    [
      'action_completed',
      {
        type: 'OPEN_MEMORY',
        presentation,
        relationship,
        generationPolicy: policy,
        contexts: [context],
        at: later,
      },
      'memory_opened',
    ],
    [
      'memory_opened',
      { type: 'SAVE_RESPONSE', response, at: later },
      'response_recorded',
    ],
    [
      'response_recorded',
      { type: 'CREATE_POSTCARD', requestedAt: later, at: later },
      'postcard_creating',
    ],
    [
      'postcard_creating',
      { type: 'POSTCARD_CREATED', artifact: artifactReference, at: later },
      'postcard_created',
    ],
    [
      'postcard_creating',
      { type: 'POSTCARD_FAILED', at: later },
      'response_recorded',
    ],
    [
      'postcard_created',
      { type: 'LIGHT_NODE_FAILED', at: later },
      'postcard_created',
    ],
  ]

  it.each(validTransitions)(
    'moves %s on %s to %s',
    (state, event, expectedState) => {
      const overrides: Partial<JourneySession> = {}
      if (
        ['action_accepted', 'action_completed', 'memory_opened', 'response_recorded', 'postcard_creating', 'postcard_created'].includes(state)
      ) {
        overrides.sourceContextIds = [context.id]
        overrides.sourceAssetIds = [context.originalAssetId]
      }
      if (['memory_opened', 'response_recorded', 'postcard_creating', 'postcard_created'].includes(state)) {
        overrides.requestedModes = ['source_replay']
        overrides.presentationProvenance = presentation.original.provenance
        overrides.presentationGenerationLabel = 'Original source'
        overrides.presentationContent = presentation.original.content
      }
      if (state === 'response_recorded') overrides.responseId = response.id
      if (state === 'postcard_creating' || state === 'postcard_created') {
        overrides.responseId = 'response-a'
        overrides.responseKind = 'text'
        overrides.responseContent = response.content
        overrides.artifactRequestedAt = later
      }
      if (state === 'postcard_created') overrides.artifactId = artifactId

      const result = transitionJourney(session(state, overrides), event)
      expect(result.state).toBe(expectedState)
      expect(result.updatedAt).toBe(later)
    },
  )

  it.each([
    'map_ready',
    'intensity_selected',
    'proposal_inspected',
    'action_accepted',
    'action_completed',
    'memory_opened',
  ] as const)('allows confirmed hide from %s without false completion', (state) => {
    const result = transitionJourney(session(state), {
      type: 'HIDE',
      confirmed: true,
      at: later,
    })
    expect(result).toMatchObject({ state: 'hidden', terminalAt: later })
    expect(result).not.toHaveProperty('artifactId')
    expect(result).not.toHaveProperty('completedAt')
  })

  it.each([
    'action_accepted',
    'action_completed',
    'memory_opened',
    'response_recorded',
  ] as const)('stops %s without an artifact or completion', (state) => {
    const result = transitionJourney(session(state), { type: 'STOP', at: later })
    expect(result).toMatchObject({ state: 'stopped', terminalAt: later })
    expect(result).not.toHaveProperty('artifactId')
    expect(result).not.toHaveProperty('completedAt')
  })

  it('allows stop after postcard creation while retaining only the artifact', () => {
    const result = transitionJourney(
      session('postcard_created', { artifactId }),
      { type: 'STOP', at: later },
    )
    expect(result).toMatchObject({
      state: 'stopped',
      artifactId,
      terminalAt: later,
    })
    expect(result).not.toHaveProperty('completedAt')
  })

  it('retains one postcard request timestamp across failure and retry', () => {
    const creating = transitionJourney(session('response_recorded', {
      responseId: response.id,
    }), {
      type: 'CREATE_POSTCARD',
      requestedAt: later,
      at: later,
    })
    const failed = transitionJourney(creating, {
      type: 'POSTCARD_FAILED',
      at: '2026-08-02T10:02:00.000Z',
    })
    const retried = transitionJourney(failed, {
      type: 'CREATE_POSTCARD',
      requestedAt: later,
      at: '2026-08-02T10:03:00.000Z',
    })

    expect(retried.artifactRequestedAt).toBe(later)
    expectJourneyError(
      () =>
        transitionJourney(failed, {
          type: 'CREATE_POSTCARD',
          requestedAt: '2026-08-02T10:04:00.000Z',
          at: '2026-08-02T10:04:00.000Z',
        }),
      'INVALID_JOURNEY_TRANSITION',
    )
  })

  it.each([
    'node_lit',
    'skipped',
    'stopped',
    'rejected',
    'hidden',
    'closed',
  ] as const)('keeps %s terminal', (state) => {
    expectJourneyError(
      () =>
        transitionJourney(session(state), {
          type: 'SELECT_INTENSITY',
          intensity: 'deep',
          at: later,
        }),
      'INVALID_JOURNEY_TRANSITION',
    )
  })

  it('rejects unconfirmed hide and invalid guarded records', () => {
    expectJourneyError(
      () =>
        transitionJourney(session('proposal_inspected'), {
          type: 'HIDE',
          confirmed: false,
          at: later,
        }),
      'INVALID_JOURNEY_TRANSITION',
    )
    expectJourneyError(
      () =>
        transitionJourney(session('proposal_inspected'), {
          type: 'ACCEPT_ACTION',
          proposal,
          action: { ...fallbackAction, id: '' },
          generationPolicy: policy,
          at: later,
        }),
      'ACTION_AUTHORSHIP_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(session('memory_opened'), {
          type: 'SAVE_RESPONSE',
          response: { ...response, id: '' },
          at: later,
        }),
      'RESPONSE_INVALID',
    )
  })

  it('requires accepted actions to belong to the inspected proposal', () => {
    expectJourneyError(
      () =>
        transitionJourney(session('proposal_inspected'), {
          type: 'ACCEPT_ACTION',
          proposal,
          action: { ...fallbackAction, id: 'unlisted-action' },
          generationPolicy: policy,
          at: later,
        }),
      'ACTION_AUTHORSHIP_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(session('proposal_inspected'), {
          type: 'ACCEPT_ACTION',
          proposal,
          action: recorderAction,
          generationPolicy: policy,
          at: later,
        }),
      'ACTION_AUTHORSHIP_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(session('proposal_inspected', { intensity: 'glimmer' }), {
          type: 'ACCEPT_ACTION',
          proposal: {
            ...proposal,
            intensity: 'glimmer',
            sourceSelection: {
              ...proposal.sourceSelection,
              requestedModes: ['source_replay', 'source_composition'],
            },
          },
          action: fallbackAction,
          generationPolicy: { ...policy, allowedModes: ['source_replay'] },
          at: later,
        }),
      'ACTION_AUTHORSHIP_INVALID',
    )
  })

  it('binds approved recorder invitations to the active journey relationship', () => {
    const accepted = transitionJourney(session('proposal_inspected'), {
      type: 'ACCEPT_ACTION',
      proposal,
      action: recorderAction,
      generationPolicy: policy,
      invitationValidation: {
        invitation,
        action: recorderAction,
        relationship,
        policy,
        contexts: [context],
      },
      at: later,
    })
    expect(accepted.selectedActionId).toBe(recorderAction.id)

    const otherRelationship = {
      ...relationship,
      id: 'relationship-b',
    }
    expectJourneyError(
      () =>
        transitionJourney(session('proposal_inspected'), {
          type: 'ACCEPT_ACTION',
          proposal,
          action: recorderAction,
          generationPolicy: policy,
          invitationValidation: {
            invitation: { ...invitation, relationshipId: otherRelationship.id },
            action: recorderAction,
            relationship: otherRelationship,
            policy: { ...policy, relationshipId: otherRelationship.id },
            contexts: [
              { ...context, relationshipId: otherRelationship.id },
            ],
          },
          at: later,
        }),
      'INVITATION_RELATIONSHIP_MISMATCH',
    )
  })

  it('requires a source-backed runtime presentation before memory opening', () => {
    const current = session('action_completed', {
      sourceContextIds: [context.id],
      sourceAssetIds: [context.originalAssetId],
      requestedModes: ['source_replay'],
    })
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'OPEN_MEMORY',
          presentation: {
            ...presentation,
            interactionId: 'interaction:other',
          },
          relationship,
          generationPolicy: policy,
          contexts: [context],
          at: later,
        }),
      'PRESENTATION_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'OPEN_MEMORY',
          presentation,
          relationship,
          generationPolicy: policy,
          contexts: [{ ...context, visibility: 'private' }],
          at: later,
        }),
      'PRESENTATION_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'OPEN_MEMORY',
          presentation: {
            ...presentation,
            original: {
              ...presentation.original,
              provenance: {
                ...presentation.original.provenance,
                sourceContextIds: ['context-b'],
              },
            },
          },
          relationship,
          generationPolicy: policy,
          contexts: [context],
          at: later,
        }),
      'PRESENTATION_INVALID',
    )
  })

  it('keeps quiet original-only and requires reviewed composition at higher intensity', () => {
    expectJourneyError(
      () =>
        transitionJourney(
          session('action_completed', {
            sourceContextIds: [context.id],
            sourceAssetIds: [context.originalAssetId],
            requestedModes: ['source_replay', 'source_composition'],
          }),
          {
            type: 'OPEN_MEMORY',
            presentation: compositionPresentation,
            relationship,
            generationPolicy: policy,
            contexts: [context],
            at: later,
          },
        ),
      'PRESENTATION_INVALID',
    )

    const opened = transitionJourney(
      session('action_completed', {
        intensity: 'glimmer',
        sourceContextIds: [context.id],
        sourceAssetIds: [context.originalAssetId],
        requestedModes: ['source_replay', 'source_composition'],
      }),
      {
        type: 'OPEN_MEMORY',
        presentation: compositionPresentation,
        relationship,
        generationPolicy: policy,
        contexts: [context],
        at: later,
      },
    )
    expect(opened.presentationGenerationLabel).toBe('AI-generated')

    expectJourneyError(
      () =>
        transitionJourney(
          session('action_completed', {
            intensity: 'glimmer',
            sourceContextIds: [context.id],
            sourceAssetIds: [context.originalAssetId],
            requestedModes: ['source_replay', 'source_composition'],
          }),
          {
            type: 'OPEN_MEMORY',
            presentation: {
              ...compositionPresentation,
              composition: {
                ...compositionPresentation.composition!,
                ownerReview: undefined,
              },
            },
            relationship,
            generationPolicy: policy,
            contexts: [context],
            at: later,
          },
        ),
      'PRESENTATION_INVALID',
    )
  })

  it('requires recipient-owned text or explicit omission before postcard creation', () => {
    const current = session('memory_opened', { sourceContextIds: [context.id] })
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'SAVE_RESPONSE',
          response: { ...response, authorId: 'recorder-a' },
          at: later,
        }),
      'RESPONSE_INVALID',
    )

    const omitted = transitionJourney(current, {
      type: 'SAVE_RESPONSE',
      response: {
        ...response,
        kind: 'omitted',
        content: undefined,
      },
      at: later,
    })
    expect(omitted.responseId).toBe(response.id)
    expectJourneyError(
      () =>
        transitionJourney(session('response_recorded'), {
          type: 'CREATE_POSTCARD',
          requestedAt: later,
          at: later,
        }),
      'INVALID_JOURNEY_TRANSITION',
    )
  })

  it('accepts only the deterministic artifact identity and source scope', () => {
    const current = session('postcard_creating', {
      sourceContextIds: [context.id],
      sourceAssetIds: [context.originalAssetId],
      presentationProvenance: presentation.original.provenance,
      presentationGenerationLabel: 'Original source',
      presentationContent: presentation.original.content,
      responseId: response.id,
      responseKind: 'text',
      responseContent: response.content,
      artifactRequestedAt: later,
    })
    expect(
      transitionJourney(current, {
        type: 'POSTCARD_CREATED',
        artifact: artifactReference,
        at: later,
      }).state,
    ).toBe('postcard_created')
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'POSTCARD_CREATED',
          artifact: { ...artifactReference, id: 'artifact:other' },
          at: later,
        }),
      'ARTIFACT_REFERENCE_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'POSTCARD_CREATED',
          artifact: { ...artifactReference, generatedSummary: 'Altered output' },
          at: later,
        }),
      'ARTIFACT_REFERENCE_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'POSTCARD_CREATED',
          artifact: { ...artifactReference, recipientResponse: 'Altered response' },
          at: later,
        }),
      'ARTIFACT_REFERENCE_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'POSTCARD_CREATED',
          artifact: { ...artifactReference, originalQuoteAssetId: 'asset-other' },
          at: later,
        }),
      'ARTIFACT_REFERENCE_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'POSTCARD_CREATED',
          artifact: { ...artifactReference, sourceContextIds: ['context-b'] },
          at: later,
        }),
      'ARTIFACT_REFERENCE_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'POSTCARD_CREATED',
          artifact: { ...artifactReference, saved: false },
          at: later,
        }),
      'ARTIFACT_REFERENCE_INVALID',
    )
    expectJourneyError(
      () =>
        transitionJourney(current, {
          type: 'POSTCARD_CREATED',
          artifact: {
            ...artifactReference,
            recipientResponseAttribution: undefined,
          },
          at: later,
        }),
      'ARTIFACT_REFERENCE_INVALID',
    )
  })

  it('rejects direct node lighting and non-monotonic event time', () => {
    expectJourneyError(
      () =>
        transitionJourney(session('postcard_created', { artifactId }), {
          type: 'LIGHT_NODE',
          completedAt: later,
          at: later,
        }),
      'INVALID_JOURNEY_TRANSITION',
    )
    expectJourneyError(
      () =>
        transitionJourney(session(), {
          type: 'SELECT_INTENSITY',
          intensity: 'quiet',
          at: '2026-08-01T10:00:00.000Z',
        }),
      'INVALID_JOURNEY_TRANSITION',
    )
  })
})

describe('Echo Map node completion', () => {
  const availableNode: EchoMapNodeState = {
    nodeId: 'node-a',
    relationshipId: relationship.id,
    recipientId: relationship.recipientId,
    status: 'available',
    updatedAt: now,
  }

  const completionInput = {
    journeySessionId: 'journey-a',
    nodeId: 'node-a',
    artifactId,
    completedAt: later,
  }

  it('links one postcard and sets journey completion only with node lighting', () => {
    const postcardSession = session('postcard_created', {
      artifactId,
    })
    const result = completeEchoMapNode(
      postcardSession,
      availableNode,
      completionInput,
    )

    expect(result).toMatchObject({
      outcome: 'completed',
      session: {
        state: 'node_lit',
        artifactId,
        completedAt: later,
      },
      node: {
        status: 'lit',
        journeySessionId: 'journey-a',
        artifactId,
      },
    })
    expect(postcardSession.state).toBe('postcard_created')
    expect(availableNode.status).toBe('available')
  })

  it('returns the existing records for an idempotent same-tuple replay', () => {
    const completed = completeEchoMapNode(
      session('postcard_created', { artifactId }),
      availableNode,
      completionInput,
    )
    const replayed = completeEchoMapNode(
      completed.session,
      completed.node,
      completionInput,
    )

    expect(replayed.outcome).toBe('already_completed')
    expect(replayed.session).toBe(completed.session)
    expect(replayed.node).toBe(completed.node)

    expectJourneyError(
      () =>
        completeEchoMapNode(
          completed.session,
          { ...completed.node, relationshipId: 'relationship-b' },
          completionInput,
        ),
      'NODE_COMPLETION_CONFLICT',
    )
  })

  it('rejects a different completion tuple without mutating completed records', () => {
    const completed = completeEchoMapNode(
      session('postcard_created', { artifactId }),
      availableNode,
      completionInput,
    )
    const beforeSession = structuredClone(completed.session)
    const beforeNode = structuredClone(completed.node)

    expectJourneyError(
      () =>
        completeEchoMapNode(completed.session, completed.node, {
          ...completionInput,
          artifactId: 'artifact-b',
        }),
      'NODE_COMPLETION_CONFLICT',
    )
    expect(completed.session).toEqual(beforeSession)
    expect(completed.node).toEqual(beforeNode)
  })

  it.each([
    [session('memory_opened'), availableNode, completionInput],
    [
      session('postcard_created', { artifactId: 'artifact-b' }),
      availableNode,
      completionInput,
    ],
    [
      session('postcard_created', { artifactId }),
      { ...availableNode, recipientId: 'recipient-b' },
      completionInput,
    ],
    [
      session('postcard_created', { artifactId }),
      { ...availableNode, status: 'hidden' as const },
      completionInput,
    ],
  ])('rejects invalid or cross-scope completion without mutation', (journey, node, input) => {
    const beforeJourney = structuredClone(journey)
    const beforeNode = structuredClone(node)
    expectJourneyError(
      () => completeEchoMapNode(journey, node, input),
      'NODE_COMPLETION_INVALID',
    )
    expect(journey).toEqual(beforeJourney)
    expect(node).toEqual(beforeNode)
  })

  it('rejects stale links on an available node without mutation', () => {
    const staleNode = {
      ...availableNode,
      journeySessionId: 'journey-old',
      artifactId: 'artifact:old',
    }
    const before = structuredClone(staleNode)
    expectJourneyError(
      () =>
        completeEchoMapNode(
          session('postcard_created', { artifactId }),
          staleNode,
          completionInput,
        ),
      'NODE_COMPLETION_CONFLICT',
    )
    expect(staleNode).toEqual(before)
  })
})
