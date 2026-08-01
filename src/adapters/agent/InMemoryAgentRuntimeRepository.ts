import type {
  ContextItem,
  GenerationPolicy,
  OriginalAsset,
  Relationship,
  TriggerPolicy,
} from '../../domain'
import type { AgentRuntimeRepository } from '../../features/agent'

export class InMemoryAgentRuntimeRepository implements AgentRuntimeRepository {
  constructor(
    private readonly relationships: readonly Relationship[],
    private readonly contexts: readonly ContextItem[],
    private readonly originalAssets: readonly OriginalAsset[],
    private readonly generationPolicies: readonly GenerationPolicy[],
    private readonly triggerPolicies: readonly TriggerPolicy[] = [],
  ) {}

  async getRelationship(id: string): Promise<Relationship | undefined> {
    return this.relationships.find((relationship) => relationship.id === id)
  }

  async getContext(id: string): Promise<ContextItem | undefined> {
    return this.contexts.find((context) => context.id === id)
  }

  async getOriginalAsset(id: string): Promise<OriginalAsset | undefined> {
    return this.originalAssets.find((asset) => asset.id === id)
  }

  async getGenerationPolicy(
    relationshipId: string,
  ): Promise<GenerationPolicy | undefined> {
    return this.generationPolicies.find(
      (policy) => policy.relationshipId === relationshipId,
    )
  }

  async getTriggerPolicy(
    relationshipId: string,
  ): Promise<TriggerPolicy | undefined> {
    return this.triggerPolicies.find(
      (policy) => policy.relationshipId === relationshipId,
    )
  }
}
