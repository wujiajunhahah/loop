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
import type { RecipientSession } from '../domain'

export const demoMemories = [...memories]
export const demoPolicies = [...agentPolicies]
export const demoPlans = [...plannedInteractions]
export const demoRecipientSessions = [...recipientSessions]

export function upsertDemoRecipientSession(session: RecipientSession) {
  const index = demoRecipientSessions.findIndex((candidate) => candidate.id === session.id)
  if (index === -1) demoRecipientSessions.push(session)
  else demoRecipientSessions.splice(index, 1, session)
}
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
