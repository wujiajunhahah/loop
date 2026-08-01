import type { EntryEvent, EntryEventType } from '../../domain'

export const triggerSources = [
  'touch',
  'tap',
  'gesture',
  'nfc',
  'ble',
  'software',
] as const

export type TriggerSource = (typeof triggerSources)[number]
export type VerificationStatus = 'pending' | 'verified' | 'rejected'

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
  fallback: 'software'
  reason?: string
}

export type EntryEventStage = 'produced' | 'verified' | 'rejected' | 'consumed'
export type EntryEventRejectionReason =
  | 'duplicate_event'
  | 'invalid_identity'
  | 'unbound_device'
  | 'unavailable_hardware'

export interface EntryEventTransition {
  event: EntryEvent
  triggerSource: TriggerSource
  verificationStatus: VerificationStatus
  stage: EntryEventStage
  reason?: EntryEventRejectionReason
}

export interface TriggerEntryEventInput {
  eventId?: string
  deviceId: string
  source: TriggerSource
  type?: EntryEventType
  recipientId: string
  relationshipId?: string
  occurredAt?: string
  payload?: Readonly<Record<string, unknown>>
  allowFallback?: boolean
}

export interface EntryTriggerResult {
  event: EntryEvent
  verificationStatus: VerificationStatus
  outcome:
    | 'accepted'
    | 'duplicate'
    | 'invalid_identity'
    | 'unbound_device'
    | 'unavailable_hardware'
  triggerSource: TriggerSource
  fallbackUsed: boolean
}
