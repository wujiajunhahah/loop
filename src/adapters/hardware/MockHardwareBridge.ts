import type {
  HardwareBridge,
  HardwareEventListener,
  HardwareLifecycleListener,
  HardwareStateListener,
} from './HardwareBridge'
import type {
  DeviceBinding,
  HardwareAvailability,
  HardwareEvent,
  HardwareEventTransition,
  HardwareFeedbackState,
  HardwareTriggerResult,
  TriggerHardwareEventInput,
  VerificationProof,
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

export class MockHardwareBridge implements HardwareBridge {
  readonly bridgeId = 'mock-hardware-bridge'
  private availability: HardwareAvailability
  private readonly bindings = new Map<string, DeviceBinding>()
  private feedback = initialFeedback
  private readonly processedEvents = new Map<string, HardwareEvent>()
  private readonly consumedEvents = new Set<string>()
  private readonly eventListeners = new Set<HardwareEventListener>()
  private readonly lifecycleListeners = new Set<HardwareLifecycleListener>()
  private readonly stateListeners = new Set<HardwareStateListener>()
  private readonly verificationValue: string
  private readonly now: () => string
  private readonly createId: () => string

  constructor(options: MockHardwareBridgeOptions = {}) {
    this.availability = {
      available: options.available ?? true,
      fallback: 'software_simulator',
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

  subscribe(listener: HardwareEventListener): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  subscribeLifecycle(listener: HardwareLifecycleListener): () => void {
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

  async trigger(
    input: TriggerHardwareEventInput,
  ): Promise<HardwareTriggerResult> {
    const eventId = input.eventId ?? this.createId()
    const duplicate = this.processedEvents.get(eventId)
    if (duplicate) {
      const event = { ...duplicate, verificationStatus: 'rejected' as const }
      this.publishLifecycle({ event, stage: 'rejected', reason: 'duplicate_event' })
      await this.rejectFeedback()
      return { event, outcome: 'duplicate', fallbackUsed: false }
    }

    const binding = this.bindings.get(input.deviceId)
    const fallbackUsed = !this.availability.available && input.allowFallback !== false
    const event: HardwareEvent = {
      eventId,
      deviceId: input.deviceId,
      deviceType: binding?.deviceType ?? 'unknown',
      recipientId: input.recipientId,
      eventType: fallbackUsed ? 'simulated' : input.eventType,
      occurredAt: input.occurredAt ?? this.now(),
      verificationStatus: 'pending',
      payload: fallbackUsed
        ? { ...input.payload, originalEventType: input.eventType, fallback: true }
        : (input.payload ?? {}),
    }
    this.processedEvents.set(eventId, event)
    this.publishLifecycle({ event, stage: 'produced' })
    await this.setFeedback({ confirmation: 'pending' })

    if (!binding?.recipientId) {
      return this.reject(event, 'unbound_device')
    }
    if (binding.recipientId !== input.recipientId) {
      return this.reject(event, 'invalid_identity')
    }

    const verified = { ...event, verificationStatus: 'verified' as const }
    this.processedEvents.set(eventId, verified)
    this.publishLifecycle({ event: verified, stage: 'verified' })
    this.eventListeners.forEach((listener) => listener(verified))
    await this.setFeedback({
      led: 'active',
      vibration: 'acknowledge',
      confirmation: 'confirmed',
    })
    return { event: verified, outcome: 'accepted', fallbackUsed }
  }

  async consume(eventId: string): Promise<HardwareEvent> {
    const event = this.processedEvents.get(eventId)
    if (!event || event.verificationStatus !== 'verified') {
      throw new Error('Only verified hardware events can be consumed')
    }
    if (this.consumedEvents.has(eventId)) {
      throw new Error('Hardware event has already been consumed')
    }
    this.consumedEvents.add(eventId)
    this.publishLifecycle({ event, stage: 'consumed' })
    return event
  }

  async setFeedback(state: Partial<HardwareFeedbackState>): Promise<void> {
    this.feedback = { ...this.feedback, ...state }
    this.stateListeners.forEach((listener) => listener())
  }

  setAvailable(available: boolean, reason?: string): void {
    this.availability = {
      available,
      fallback: 'software_simulator',
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
    event: HardwareEvent,
    reason: 'invalid_identity' | 'unbound_device',
  ): Promise<HardwareTriggerResult> {
    const rejected = { ...event, verificationStatus: 'rejected' as const }
    this.processedEvents.set(event.eventId, rejected)
    this.publishLifecycle({ event: rejected, stage: 'rejected', reason })
    await this.rejectFeedback()
    return {
      event: rejected,
      outcome: reason,
      fallbackUsed: event.eventType === 'simulated',
    }
  }

  private async rejectFeedback(): Promise<void> {
    await this.setFeedback({
      led: 'error',
      vibration: 'attention',
      confirmation: 'rejected',
    })
  }

  private publishLifecycle(transition: HardwareEventTransition): void {
    this.lifecycleListeners.forEach((listener) => listener(transition))
  }
}
