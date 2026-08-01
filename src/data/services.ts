import {
  InMemoryContextCaptureService,
  InMemoryRelationshipStore,
  MockAgentService,
  MockHardwareBridge,
  MockPlaybackService,
} from './mockServices'
import { memories, relationships, agentPolicies, plannedInteractions, recipientSessions } from './seed'
import { InMemoryAgentContextRepository } from '../adapters/agent'
import { AgentPolicyEvaluator, ContextAssembler, PlannedInteractionService, RelationshipAgent } from '../features/agent'

export const demoMemories = [...memories]
export const demoPolicies = [...agentPolicies]
export const demoPlans = [...plannedInteractions]
export const demoRecipientSessions = [...recipientSessions]
export const relationshipStore = new InMemoryRelationshipStore(
  [...relationships],
  demoMemories,
)
export const contextCaptureService = new InMemoryContextCaptureService(
  relationshipStore,
)
export const agentService = new MockAgentService(relationshipStore)
export const plannedInteractionService = new PlannedInteractionService(demoPlans)
export const relationshipAgent = new RelationshipAgent(
  new ContextAssembler(
    new InMemoryAgentContextRepository(
      relationships,
      demoMemories,
      demoPolicies,
      demoPlans,
      demoRecipientSessions,
    ),
    new AgentPolicyEvaluator(),
    plannedInteractionService,
  ),
  plannedInteractionService,
)
export const playbackService = new MockPlaybackService()
