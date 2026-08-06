import type {
  AgentPolicy,
  Memory,
  PlannedInteraction,
  RecipientSession,
  Relationship,
} from '../../domain'
import type { AgentContextRepository } from '../../features/agent'

export class InMemoryAgentContextRepository implements AgentContextRepository {
  constructor(
    private readonly relationships: readonly Relationship[],
    private readonly memories: readonly Memory[],
    private readonly policies: readonly AgentPolicy[],
    private readonly plannedInteractions: readonly PlannedInteraction[],
    private readonly recipientSessions: readonly RecipientSession[],
  ) {}

  async getRelationship(id: string): Promise<Relationship | undefined> {
    return this.relationships.find((relationship) => relationship.id === id)
  }

  async getMemories(): Promise<readonly Memory[]> {
    return this.memories
  }

  async getPolicy(relationshipId: string): Promise<AgentPolicy | undefined> {
    return this.policies.find(
      (policy) => policy.relationshipId === relationshipId,
    )
  }

  async getRecipientSession(id: string): Promise<RecipientSession | undefined> {
    return this.recipientSessions.find((session) => session.id === id)
  }

  async getPlannedInteractions(
    relationshipId: string,
  ): Promise<readonly PlannedInteraction[]> {
    return this.plannedInteractions.filter(
      (interaction) => interaction.relationshipId === relationshipId,
    )
  }
}
