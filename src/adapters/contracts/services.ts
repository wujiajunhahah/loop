import type {
  AgentPolicy,
  AgentPresentation,
  HardwareEvent,
  HardwareEventType,
  Memory,
  OriginalContent,
  Relationship,
} from '../../domain'

export interface CaptureMemoryInput {
  ownerId: string
  relationshipId?: string
  recipientId?: string
  topic: string
  meaning: string
  visibility: Memory['visibility']
  original: OriginalContent
}

export interface ContextCaptureService {
  capture(input: CaptureMemoryInput): Promise<Memory>
}

export interface RelationshipStore {
  getRelationship(id: string): Promise<Relationship | undefined>
  getMemoriesForRecipient(
    relationshipId: string,
    recipientId: string,
  ): Promise<Memory[]>
  saveMemory(memory: Memory): Promise<void>
}

export interface AgentService {
  compose(input: {
    relationshipId: string
    recipientId: string
    policy: AgentPolicy
  }): Promise<AgentPresentation | undefined>
}

export type HardwareEventListener = (event: HardwareEvent) => void

export interface HardwareBridge {
  readonly bridgeId: string
  subscribe(listener: HardwareEventListener): () => void
  simulate(type: HardwareEventType, actorId?: string): HardwareEvent
  setLight(state: 'off' | 'ready' | 'active'): Promise<void>
  setVibration(pattern: 'none' | 'acknowledge' | 'attention'): Promise<void>
}

export interface PlaybackService {
  play(content: OriginalContent): Promise<void>
  stop(): Promise<void>
}
