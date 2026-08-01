import type { EntryEvent } from '../../domain'
import type {
  DeviceBinding,
  EntryEventTransition,
  EntryTriggerResult,
  HardwareAvailability,
  HardwareFeedbackState,
  TriggerEntryEventInput,
  VerificationProof,
} from './types'

export type EntryEventListener = (event: EntryEvent) => void
export type EntryLifecycleListener = (transition: EntryEventTransition) => void
export type HardwareStateListener = () => void

export interface HardwareBridge {
  readonly bridgeId: string
  getAvailability(): HardwareAvailability
  getBindings(): readonly DeviceBinding[]
  getFeedback(): HardwareFeedbackState
  subscribe(listener: EntryEventListener): () => void
  subscribeLifecycle(listener: EntryLifecycleListener): () => void
  subscribeState(listener: HardwareStateListener): () => void
  bindDevice(input: {
    deviceId: string
    deviceType: string
    ownerProof: VerificationProof
  }): Promise<DeviceBinding>
  entrustDevice(input: {
    deviceId: string
    ownerProof: VerificationProof
    recipientProof: VerificationProof
  }): Promise<DeviceBinding>
  trigger(input: TriggerEntryEventInput): Promise<EntryTriggerResult>
  consume(eventId: string): Promise<EntryEvent>
  setFeedback(state: Partial<HardwareFeedbackState>): Promise<void>
}
