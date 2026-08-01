import type { PlannedInteraction } from '../../domain'
import { AgentError } from './errors'
import type {
  ManagedPlannedInteraction,
  PlannedInteractionState,
} from './types'

const initialState: Record<PlannedInteraction['status'], PlannedInteractionState> = {
  available: 'planned',
  accepted: 'accepted',
  postponed: 'planned',
  skipped: 'skipped',
  closed: 'completed',
}

const allowedTransitions: Record<
  PlannedInteractionState,
  readonly PlannedInteractionState[]
> = {
  planned: ['invited', 'skipped'],
  invited: ['accepted', 'skipped'],
  accepted: ['completed', 'skipped'],
  completed: [],
  skipped: [],
}

export class PlannedInteractionService {
  private readonly records = new Map<string, ManagedPlannedInteraction>()

  constructor(interactions: readonly PlannedInteraction[]) {
    interactions.forEach((interaction) => {
      this.records.set(interaction.id, {
        interaction,
        state: initialState[interaction.status],
      })
    })
  }

  list(relationshipId: string): ManagedPlannedInteraction[] {
    return [...this.records.values()].filter(
      ({ interaction }) => interaction.relationshipId === relationshipId,
    )
  }

  inviteNext(
    relationshipId: string,
    allowedInteractionIds: ReadonlySet<string>,
  ): ManagedPlannedInteraction | undefined {
    const existing = this.list(relationshipId).find(
      ({ interaction, state }) =>
        allowedInteractionIds.has(interaction.id) &&
        (state === 'invited' || state === 'accepted'),
    )
    if (existing) return existing

    const planned = this.list(relationshipId).find(
      ({ interaction, state }) =>
        allowedInteractionIds.has(interaction.id) && state === 'planned',
    )
    return planned ? this.transition(relationshipId, planned.interaction.id, 'invited') : undefined
  }

  transition(
    relationshipId: string,
    interactionId: string,
    nextState: PlannedInteractionState,
  ): ManagedPlannedInteraction {
    const current = this.records.get(interactionId)
    if (
      !current ||
      current.interaction.relationshipId !== relationshipId
    ) {
      throw new AgentError(
        'INTERACTION_NOT_FOUND',
        `Planned interaction ${interactionId} does not exist in relationship ${relationshipId}.`,
      )
    }
    if (!allowedTransitions[current.state].includes(nextState)) {
      throw new AgentError(
        'INVALID_INTERACTION_TRANSITION',
        `Cannot move planned interaction ${interactionId} from ${current.state} to ${nextState}.`,
      )
    }

    const updated = { ...current, state: nextState }
    this.records.set(interactionId, updated)
    return updated
  }
}
