import {
  AgentPolicyEvaluator,
  ContextAssembler,
  PlannedInteractionService,
  RelationshipAgent,
  type AgentContextRepository,
  type RecipientAgentView,
  type RelationshipAgentInput,
  type RelationshipAgentPort,
} from '../../features/agent'

export class MockRelationshipAgent implements RelationshipAgentPort {
  private readonly agent: RelationshipAgent
  readonly plannedInteractions: PlannedInteractionService

  private constructor(
    repository: AgentContextRepository,
    plannedInteractions: PlannedInteractionService,
  ) {
    this.plannedInteractions = plannedInteractions
    this.agent = new RelationshipAgent(
      new ContextAssembler(
        repository,
        new AgentPolicyEvaluator(),
        plannedInteractions,
      ),
      plannedInteractions,
    )
  }

  static async create(
    repository: AgentContextRepository,
    relationshipId: string,
  ): Promise<MockRelationshipAgent> {
    const plans = await repository.getPlannedInteractions(relationshipId)

    return new MockRelationshipAgent(
      repository,
      new PlannedInteractionService(plans),
    )
  }

  enter(input: RelationshipAgentInput): Promise<RecipientAgentView> {
    return this.agent.enter(input)
  }
}
