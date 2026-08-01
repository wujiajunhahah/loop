import type { ContextAssembler } from './ContextAssembler'
import { AgentError } from './errors'
import type { PlannedInteractionService } from './PlannedInteractionService'
import type {
  AssembledMemory,
  PresentedContent,
  RecipientAgentView,
  RelationshipAgentInput,
  RelationshipAgentPort,
} from './types'

export class RelationshipAgent implements RelationshipAgentPort {
  constructor(
    private readonly contextAssembler: ContextAssembler,
    private readonly plannedInteractions: PlannedInteractionService,
  ) {}

  async enter(input: RelationshipAgentInput): Promise<RecipientAgentView> {
    const context = await this.contextAssembler.assemble({
      relationshipId: input.relationshipId,
      sessionId: input.sessionId,
    })
    if (
      input.delivery === 'designed_encounter' &&
      !context.sections.policy.allowProactiveTrigger
    ) {
      throw new AgentError(
        'PROACTIVE_TRIGGER_NOT_ALLOWED',
        `Policy does not allow designed encounters for relationship ${input.relationshipId}.`,
      )
    }

    const selected =
      context.sections.relationship_specific[0] ??
      context.sections.public_persona[0]
    const content = this.present(selected)
    const planned = this.plannedInteractions.inviteNext(
      input.relationshipId,
      new Set(
        context.sections.planned_interactions.map(
          ({ interaction }) => interaction.id,
        ),
      ),
    )

    return {
      relationshipId: context.relationship.id,
      recipientId: context.session.recipientId,
      content,
      invitation:
        planned && (planned.state === 'invited' || planned.state === 'accepted')
          ? {
              kind: 'invitation',
              interactionId: planned.interaction.id,
              title: planned.interaction.title,
              invitation: planned.interaction.invitation,
              state: planned.state,
            }
          : undefined,
      policy: context.sections.policy,
    }
  }

  private present(memory: AssembledMemory): PresentedContent {
    if (memory.organized.allowed && memory.memory.organized?.reviewedByOwner) {
      return {
        provenance: 'ai_organized',
        memoryId: memory.memory.id,
        topic: memory.memory.topic,
        text: memory.memory.organized.text,
        sourceMemoryIds: memory.memory.organized.sourceMemoryIds,
        reviewedByOwner: true,
      }
    }
    if (!memory.original.allowed) {
      throw new AgentError(
        'INSUFFICIENT_CONTEXT',
        `Memory ${memory.memory.id} has no permitted presentation form.`,
      )
    }

    return {
      provenance: 'original',
      memoryId: memory.memory.id,
      topic: memory.memory.topic,
      meaning: memory.memory.meaning,
      content: memory.memory.original,
    }
  }
}
