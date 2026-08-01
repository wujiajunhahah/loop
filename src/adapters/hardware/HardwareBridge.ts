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

export type HardwareEventListener = (event: HardwareEvent) => void
export type HardwareLifecycleListener = (
  transition: HardwareEventTransition,
) => void
export type HardwareStateListener = () => void

export interface HardwareBridge {
  readonly bridgeId: string
  getAvailability(): HardwareAvailability
  getBindings(): readonly DeviceBinding[]
  getFeedback(): HardwareFeedbackState
  subscribe(listener: HardwareEventListener): () => void
  subscribeLifecycle(listener: HardwareLifecycleListener): () => void
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
  trigger(input: TriggerHardwareEventInput): Promise<HardwareTriggerResult>
  consume(eventId: string): Promise<HardwareEvent>
  setFeedback(state: Partial<HardwareFeedbackState>): Promise<void>
}
