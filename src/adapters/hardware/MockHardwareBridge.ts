import { createEntryEvent, type EntryEvent, type EntryEventSource } from '../../domain'
import type {
  EntryEventListener,
  EntryLifecycleListener,
  HardwareBridge,
  HardwareStateListener,
} from './HardwareBridge'
import type {
  DeviceBinding,
  EntryEventRejectionReason,
  EntryEventTransition,
  EntryTriggerResult,
  HardwareAvailability,
  HardwareFeedbackState,
  TriggerEntryEventInput,
  TriggerSource,
  VerificationProof,
  VerificationStatus,
} from './types'

const initialFeedback: HardwareFeedbackState = {
  led: 'off',
  vibration: 'none',
  confirmation: 'idle',
}

interface MockHardwareBridgeOptions {
  available?: boolean
  verificationValue?: string
  now?: () => string
  createId?: () => string
}

interface StoredEvent {
  event: EntryEvent
  triggerSource: TriggerSource
  verificationStatus: VerificationStatus
}

function toEntryEventSource(source: TriggerSource): EntryEventSource {
  if (source === 'nfc' || source === 'ble' || source === 'software') return source
  return 'device'
}

export class MockHardwareBridge implements HardwareBridge {
  readonly bridgeId = 'mock-hardware-bridge'
  private availability: HardwareAvailability
  private readonly bindings = new Map<string, DeviceBinding>()
  private feedback = initialFeedback
  private readonly processedEvents = new Map<string, StoredEvent>()
  private readonly consumedEvents = new Set<string>()
  private readonly eventListeners = new Set<EntryEventListener>()
  private readonly lifecycleListeners = new Set<EntryLifecycleListener>()
  private readonly stateListeners = new Set<HardwareStateListener>()
  private readonly verificationValue: string
  private readonly now: () => string
  private readonly createId: () => string

  constructor(options: MockHardwareBridgeOptions = {}) {
    this.availability = {
      available: options.available ?? true,
      fallback: 'software',
      reason: options.available === false ? 'Physical hardware unavailable' : undefined,
    }
    this.verificationValue = options.verificationValue ?? 'LOOP-DEMO'
    this.now = options.now ?? (() => new Date().toISOString())
    this.createId = options.createId ?? (() => crypto.randomUUID())
  }

  getAvailability(): HardwareAvailability {
    return this.availability
  }

  getBindings(): readonly DeviceBinding[] {
    return [...this.bindings.values()]
  }

  getFeedback(): HardwareFeedbackState {
    return this.feedback
  }

  subscribe(listener: EntryEventListener): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  subscribeLifecycle(listener: EntryLifecycleListener): () => void {
    this.lifecycleListeners.add(listener)
    return () => this.lifecycleListeners.delete(listener)
  }

  subscribeState(listener: HardwareStateListener): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  async bindDevice(input: {
    deviceId: string
    deviceType: string
    ownerProof: VerificationProof
  }): Promise<DeviceBinding> {
    this.assertProof(input.ownerProof)
    if (!input.deviceId.trim() || !input.deviceType.trim()) {
      throw new Error('Device identity is required')
    }

    const binding: DeviceBinding = {
      deviceId: input.deviceId,
      deviceType: input.deviceType,
      ownerId: input.ownerProof.identityId,
      status: 'verified',
      boundAt: this.now(),
    }
    this.bindings.set(binding.deviceId, binding)
    await this.setFeedback({ led: 'ready', confirmation: 'confirmed' })
    return binding
  }

  async entrustDevice(input: {
    deviceId: string
    ownerProof: VerificationProof
    recipientProof: VerificationProof
  }): Promise<DeviceBinding> {
    const binding = this.bindings.get(input.deviceId)
    if (!binding) throw new Error('Device must be bound before entrustment')
    this.assertProof(input.ownerProof)
    this.assertProof(input.recipientProof)
    if (input.ownerProof.identityId !== binding.ownerId) {
      throw new Error('Owner identity does not match the verified binding')
    }
    if (input.recipientProof.identityId === binding.ownerId) {
      throw new Error('Recipient must be independently identified')
    }

    const entrusted: DeviceBinding = {
      ...binding,
      recipientId: input.recipientProof.identityId,
      entrustedAt: this.now(),
    }
    this.bindings.set(binding.deviceId, entrusted)
    await this.setFeedback({ led: 'ready', confirmation: 'confirmed' })
    return entrusted
  }

  async trigger(input: TriggerEntryEventInput): Promise<EntryTriggerResult> {
    const eventId = input.eventId ?? this.createId()
    const duplicate = this.processedEvents.get(eventId)
    if (duplicate) {
      this.publishLifecycle({
        ...duplicate,
        stage: 'rejected',
        verificationStatus: 'rejected',
        reason: 'duplicate_event',
      })
      await this.rejectFeedback()
      return {
        ...duplicate,
        verificationStatus: 'rejected',
        outcome: 'duplicate',
        fallbackUsed: false,
      }
    }

    const needsHardware = input.source !== 'software'
    const fallbackUsed = needsHardware && !this.availability.available && input.allowFallback !== false
    const triggerSource = fallbackUsed ? 'software' : input.source
    const event = createEntryEvent({
      id: eventId,
      source: toEntryEventSource(triggerSource),
      type: input.type ?? 'open',
      occurredAt: input.occurredAt ?? this.now(),
      recipientId: input.recipientId,
      relationshipId: input.relationshipId,
      payload: fallbackUsed
        ? { ...input.payload, originalSource: input.source, fallback: true }
        : input.payload,
    })
    const pending: StoredEvent = {
      event,
      triggerSource,
      verificationStatus: 'pending',
    }
    this.processedEvents.set(eventId, pending)
    this.publishLifecycle({ ...pending, stage: 'produced' })
    await this.setFeedback({ confirmation: 'pending' })

    if (needsHardware && !this.availability.available && !fallbackUsed) {
      return this.reject(pending, 'unavailable_hardware')
    }

    const binding = this.bindings.get(input.deviceId)
    if (!binding?.recipientId) return this.reject(pending, 'unbound_device')
    if (binding.recipientId !== input.recipientId) {
      return this.reject(pending, 'invalid_identity')
    }

    const verified: StoredEvent = { ...pending, verificationStatus: 'verified' }
    this.processedEvents.set(eventId, verified)
    this.publishLifecycle({ ...verified, stage: 'verified' })
    this.eventListeners.forEach((listener) => listener(event))
    await this.setFeedback({
      led: 'active',
      vibration: 'acknowledge',
      confirmation: 'confirmed',
    })
    return { ...verified, outcome: 'accepted', fallbackUsed }
  }

  async consume(eventId: string): Promise<EntryEvent> {
    const stored = this.processedEvents.get(eventId)
    if (!stored || stored.verificationStatus !== 'verified') {
      throw new Error('Only verified entry events can be consumed')
    }
    if (this.consumedEvents.has(eventId)) {
      throw new Error('Entry event has already been consumed')
    }
    this.consumedEvents.add(eventId)
    this.publishLifecycle({ ...stored, stage: 'consumed' })
    return stored.event
  }

  async setFeedback(state: Partial<HardwareFeedbackState>): Promise<void> {
    this.feedback = { ...this.feedback, ...state }
    this.stateListeners.forEach((listener) => listener())
  }

  setAvailable(available: boolean, reason?: string): void {
    this.availability = {
      available,
      fallback: 'software',
      reason: available ? undefined : (reason ?? 'Physical hardware unavailable'),
    }
    this.stateListeners.forEach((listener) => listener())
  }

  private assertProof(proof: VerificationProof): void {
    if (!proof.identityId.trim() || proof.value !== this.verificationValue) {
      throw new Error('Identity verification failed')
    }
  }

  private async reject(
    stored: StoredEvent,
    reason: Exclude<EntryEventRejectionReason, 'duplicate_event'>,
  ): Promise<EntryTriggerResult> {
    const rejected: StoredEvent = { ...stored, verificationStatus: 'rejected' }
    this.processedEvents.set(stored.event.id, rejected)
    this.publishLifecycle({ ...rejected, stage: 'rejected', reason })
    await this.rejectFeedback()
    return {
      ...rejected,
      outcome: reason,
      fallbackUsed: stored.triggerSource === 'software' && stored.event.payload.fallback === true,
    }
  }

  private async rejectFeedback(): Promise<void> {
    await this.setFeedback({
      led: 'error',
      vibration: 'attention',
      confirmation: 'rejected',
    })
  }

  private publishLifecycle(transition: EntryEventTransition): void {
    this.lifecycleListeners.forEach((listener) => listener(transition))
  }
}
