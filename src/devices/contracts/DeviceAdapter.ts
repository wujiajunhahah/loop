import type { DeviceResult } from './errors'
import type {
  DeviceStateSubscription,
  DeviceTransportSession,
  DiscoveredDevice,
} from './DeviceTransport'
import type {
  CommandAcknowledgement,
  DeviceCapabilityReport,
  DeviceCommand,
  DeviceSubscription,
  NormalizedDevice,
  NormalizedDeviceEvent,
  NormalizedDeviceEventBase,
} from './types'

export type DeviceSessionState =
  | 'opening'
  | 'open'
  | 'closing'
  | 'closed'
  | 'disconnected'
  | 'failed'

export type DeviceSessionStateListener = (state: DeviceSessionState) => void

export type NormalizedDeviceEventListener<
  Event extends NormalizedDeviceEventBase = NormalizedDeviceEvent,
> = (
  event: Event,
) => void

export interface DeviceSession<
  Event extends NormalizedDeviceEventBase = NormalizedDeviceEvent,
> {
  sessionId: string
  device: NormalizedDevice
  capabilities: DeviceCapabilityReport
  getState(): DeviceSessionState
  /** Reports normalized lifecycle changes and immediately emits current state. */
  subscribeState?(listener: DeviceSessionStateListener): DeviceStateSubscription
  subscribe(
    listener: NormalizedDeviceEventListener<Event>,
  ): DeviceResult<DeviceSubscription>
  execute(
    command: DeviceCommand,
  ): Promise<DeviceResult<CommandAcknowledgement>>
  /** Waits for its transport session to close; succeeds when called repeatedly. */
  close(): Promise<DeviceResult<void>>
}

export interface DeviceAdapter<
  Event extends NormalizedDeviceEventBase = NormalizedDeviceEvent,
> {
  adapterId: string
  matches(device: DiscoveredDevice): boolean
  /** On success DeviceSession owns transportSession; on failure the caller does. */
  openSession(
    transportSession: DeviceTransportSession,
  ): Promise<DeviceResult<DeviceSession<Event>>>
}
