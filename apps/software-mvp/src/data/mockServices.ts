import type {
  AgentService,
  CaptureMemoryInput,
  ContextCaptureService,
  HardwareBridge,
  HardwareEventListener,
  PlaybackService,
  RelationshipStore,
} from '../adapters/contracts'
import {
  canAgentUseMemory,
  createHardwareEvent,
  type AgentPolicy,
  type AgentPresentation,
  type HardwareEvent,
  type HardwareEventType,
  type Memory,
  type OriginalContent,
  type Relationship,
} from '../domain'

export class InMemoryRelationshipStore implements RelationshipStore {
  constructor(
    private readonly relationships: Relationship[],
    private readonly memories: Memory[],
  ) {}

  async getRelationship(id: string): Promise<Relationship | undefined> {
    return this.relationships.find((relationship) => relationship.id === id)
  }

  async getMemoriesForRecipient(
    relationshipId: string,
    recipientId: string,
  ): Promise<Memory[]> {
    return this.memories.filter(
      (memory) =>
        memory.visibility !== 'private' &&
        (memory.visibility === 'public_persona' ||
          (memory.relationshipId === relationshipId &&
            memory.recipientId === recipientId)),
    )
  }

  async saveMemory(memory: Memory): Promise<void> {
    this.memories.push(memory)
  }
}

export class InMemoryContextCaptureService implements ContextCaptureService {
  constructor(private readonly store: RelationshipStore) {}

  async capture(input: CaptureMemoryInput): Promise<Memory> {
    const memory: Memory = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    await this.store.saveMemory(memory)
    return memory
  }
}

export class MockAgentService implements AgentService {
  constructor(private readonly store: RelationshipStore) {}

  async compose(input: {
    relationshipId: string
    recipientId: string
    policy: AgentPolicy
  }): Promise<AgentPresentation | undefined> {
    const memories = await this.store.getMemoriesForRecipient(
      input.relationshipId,
      input.recipientId,
    )
    const memory = memories.find((candidate) =>
      canAgentUseMemory(
        candidate,
        input.relationshipId,
        input.recipientId,
        input.policy,
      ),
    )
    if (!memory) return undefined

    return {
      relationshipId: input.relationshipId,
      memoryIds: [memory.id],
      headline: memory.organized?.reviewedByOwner
        ? memory.organized.text
        : memory.meaning,
      provenance: memory.organized?.reviewedByOwner
        ? 'ai_organized'
        : 'original',
    }
  }
}

export class MockHardwareBridge implements HardwareBridge {
  readonly bridgeId = 'mock-hardware-bridge'
  private readonly listeners = new Set<HardwareEventListener>()

  subscribe(listener: HardwareEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  simulate(type: HardwareEventType, actorId?: string): HardwareEvent {
    const event = createHardwareEvent({
      id: crypto.randomUUID(),
      bridgeId: this.bridgeId,
      type,
      actorId,
    })
    this.listeners.forEach((listener) => listener(event))
    return event
  }

  async setLight(_state: 'off' | 'ready' | 'active'): Promise<void> {}

  async setVibration(
    _pattern: 'none' | 'acknowledge' | 'attention',
  ): Promise<void> {}
}

export class MockPlaybackService implements PlaybackService {
  current?: OriginalContent

  async play(content: OriginalContent): Promise<void> {
    this.current = content
  }

  async stop(): Promise<void> {
    this.current = undefined
  }
}
