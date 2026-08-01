export const hardwareEventTypes = [
  'touch',
  'tap',
  'gesture',
  'nfc',
  'ble',
  'simulated',
] as const

export type HardwareEventType = (typeof hardwareEventTypes)[number]
export type VerificationStatus = 'pending' | 'verified' | 'rejected'

export interface HardwareEvent {
  eventId: string
  deviceId: string
  deviceType: string
  recipientId: string
  eventType: HardwareEventType
  occurredAt: string
  verificationStatus: VerificationStatus
  payload: Readonly<Record<string, unknown>>
}

export interface VerificationProof {
  identityId: string
  method: 'mock_code' | 'mock_confirmation'
  value: string
}

export interface DeviceBinding {
  deviceId: string
  deviceType: string
  ownerId: string
  status: 'verified'
  boundAt: string
  recipientId?: string
  entrustedAt?: string
}

export interface HardwareFeedbackState {
  led: 'off' | 'ready' | 'active' | 'error'
  vibration: 'none' | 'acknowledge' | 'attention'
  confirmation: 'idle' | 'pending' | 'confirmed' | 'rejected'
}

export interface HardwareAvailability {
  available: boolean
  fallback: 'software_simulator'
  reason?: string
}

export type HardwareEventStage =
  | 'produced'
  | 'verified'
  | 'rejected'
  | 'consumed'

export interface HardwareEventTransition {
  event: HardwareEvent
  stage: HardwareEventStage
  reason?: 'duplicate_event' | 'invalid_identity' | 'unbound_device'
}

export interface TriggerHardwareEventInput {
  eventId?: string
  deviceId: string
  eventType: HardwareEventType
  recipientId: string
  occurredAt?: string
  payload?: Readonly<Record<string, unknown>>
  allowFallback?: boolean
}

export interface HardwareTriggerResult {
  event: HardwareEvent
  outcome:
    | 'accepted'
    | 'duplicate'
    | 'invalid_identity'
    | 'unbound_device'
  fallbackUsed: boolean
}
