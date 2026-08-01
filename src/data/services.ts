import {
  InMemoryContextCaptureService,
  InMemoryRelationshipStore,
  MockAgentService,
  MockHardwareBridge,
  MockPlaybackService,
} from './mockServices'
import { memories, relationships } from './seed'

export const relationshipStore = new InMemoryRelationshipStore(
  [...relationships],
  [...memories],
)
export const contextCaptureService = new InMemoryContextCaptureService(
  relationshipStore,
)
export const agentService = new MockAgentService(relationshipStore)
export const hardwareBridge = new MockHardwareBridge()
export const playbackService = new MockPlaybackService()
