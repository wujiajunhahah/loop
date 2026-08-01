import { AgentPolicyEvaluator } from './AgentPolicyEvaluator'
import { AgentError } from './errors'
import type {
  AgentContextRepository,
  AssembledMemory,
  RelationshipContext,
} from './types'
import type { PlannedInteractionService } from './PlannedInteractionService'

export class ContextAssembler {
  constructor(
    private readonly repository: AgentContextRepository,
    private readonly policyEvaluator: AgentPolicyEvaluator,
    private readonly plannedInteractions: PlannedInteractionService,
  ) {}

  async assemble(input: {
    relationshipId: string
    sessionId: string
  }): Promise<RelationshipContext> {
    const relationship = await this.repository.getRelationship(input.relationshipId)
    if (!relationship) {
      throw new AgentError(
        'RELATIONSHIP_NOT_FOUND',
        `Relationship ${input.relationshipId} does not exist.`,
      )
    }
    if (relationship.status !== 'entrusted') {
      throw new AgentError(
        'RELATIONSHIP_NOT_AVAILABLE',
        `Relationship ${input.relationshipId} is not entrusted for recipient access.`,
      )
    }

    const session = await this.repository.getRecipientSession(input.sessionId)
    if (!session) {
      throw new AgentError(
        'SESSION_NOT_FOUND',
        `Recipient session ${input.sessionId} does not exist.`,
      )
    }
    if (session.relationshipId !== relationship.id) {
      throw new AgentError(
        'SESSION_RELATIONSHIP_MISMATCH',
        `Recipient session ${input.sessionId} does not belong to relationship ${input.relationshipId}.`,
      )
    }
    if (relationship.recipientId !== session.recipientId) {
      throw new AgentError(
        'RECIPIENT_MISMATCH',
        `Recipient ${session.recipientId} is not authorized for relationship ${input.relationshipId}.`,
      )
    }
    if (!session.initiatedByRecipient || session.status !== 'active') {
      throw new AgentError(
        'RECIPIENT_ENTRY_REQUIRED',
        `Recipient session ${input.sessionId} is not an active recipient-initiated entry.`,
      )
    }

    const policy = await this.repository.getPolicy(input.relationshipId)
    if (!policy) {
      throw new AgentError(
        'POLICY_NOT_FOUND',
        `No agent policy exists for relationship ${input.relationshipId}.`,
      )
    }
    if (policy.relationshipId !== relationship.id) {
      throw new AgentError(
        'POLICY_RELATIONSHIP_MISMATCH',
        `Agent policy does not belong to relationship ${input.relationshipId}.`,
      )
    }

    const memories = await this.repository.getMemories()
    const assembled = memories
      .filter((memory) => memory.visibility !== 'private')
      .map<AssembledMemory>((memory) => ({
        memory,
        original: this.policyEvaluator.originalPlayback(
          memory,
          relationship,
          session.recipientId,
          policy,
        ),
        organized: this.policyEvaluator.organizedPlayback(
          memory,
          relationship,
          session.recipientId,
          policy,
          memories,
        ),
      }))
      .filter(({ original, organized }) => original.allowed || organized.allowed)

    const publicPersona = assembled.filter(
      ({ memory }) => memory.visibility === 'public_persona',
    )
    const relationshipSpecific = assembled.filter(
      ({ memory }) => memory.visibility === 'relationship_specific',
    )
    if (publicPersona.length === 0 && relationshipSpecific.length === 0) {
      throw new AgentError(
        'INSUFFICIENT_CONTEXT',
        `No owner-confirmed content is available for relationship ${input.relationshipId}.`,
      )
    }

    const allowedMemoryIds = new Set(assembled.map(({ memory }) => memory.id))
    const plannedInteractions = this.plannedInteractions
      .list(relationship.id)
      .filter(
        ({ interaction }) =>
          interaction.memoryIds.length > 0 &&
          interaction.memoryIds.every((id) => allowedMemoryIds.has(id)),
      )

    return {
      relationship,
      session,
      policy,
      sections: {
        public_persona: publicPersona,
        relationship_specific: relationshipSpecific,
        private: { exposed: false },
        planned_interactions: plannedInteractions,
        policy: {
          ...this.policyEvaluator.capabilities(policy, true),
          allowOriginalPlayback: assembled.some(({ original }) => original.allowed),
        },
      },
    }
  }
}
