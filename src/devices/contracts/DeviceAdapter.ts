import type { DeviceResult } from './errors'
import type { DeviceTransportSession, DiscoveredDevice } from './DeviceTransport'
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
  | 'failed'

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
