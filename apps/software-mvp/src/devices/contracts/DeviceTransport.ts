import type { DeviceResult } from './errors'

export type DeviceTransportKind =
  | 'bluetooth_low_energy'
  | 'near_field'
  | 'usb'
  | 'simulated'

export type DeviceTransportState =
  | 'idle'
  | 'opening'
  | 'open'
  | 'closing'
  | 'closed'
  | 'failed'

export interface DiscoveredDevice {
  /** Opaque platform identifier; callers must not assume a MAC address. */
  discoveryId: string
  transportId: string
  transportKind: DeviceTransportKind
  displayName?: string
  /** Normalized matching hints only; never raw advertisement payloads. */
  advertisedServiceIds?: readonly string[]
  connectable: boolean
  signalStrength?: number
  discoveredAt: string
}

export interface DiscoveryFilter {
  services?: readonly string[]
  name?: string
  namePrefix?: string
}

export interface DiscoveryRequest {
  filters?: readonly DiscoveryFilter[]
  timeoutMs?: number
  allowDuplicates?: boolean
  signal?: AbortSignal
}

export type DiscoveredDeviceListener = (device: DiscoveredDevice) => void

export type DeviceDiscoverySessionState = 'active' | 'stopping' | 'stopped'

export interface DeviceDiscoverySession {
  discoverySessionId: string
  getState(): DeviceDiscoverySessionState
  /** Stops discovery and succeeds when called more than once. */
  stop(): Promise<DeviceResult<void>>
}

export interface ConnectRequest {
  device: DiscoveredDevice
  timeoutMs?: number
  signal?: AbortSignal
}

export type DeviceTransportSessionState =
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'failed'

export type DeviceTransportSessionStateListener = (
  state: DeviceTransportSessionState,
) => void

export interface DeviceStateSubscription {
  /** Stops lifecycle delivery; safe to repeat. */
  unsubscribe(): void
}

/** Raw service and characteristic identifiers stay below DeviceAdapter. */
export interface DeviceCharacteristicRef {
  serviceId: string
  characteristicId: string
}

export type DeviceTransportReceiveSource = 'notification' | 'read'

export interface DeviceTransportFrame {
  payload: Uint8Array
  sequence: number
  characteristic: DeviceCharacteristicRef
  source: DeviceTransportReceiveSource
  receivedAt: string
}

export interface DeviceTransportFrameInput {
  payload: Uint8Array
  characteristic: DeviceCharacteristicRef
  source: DeviceTransportReceiveSource
  receivedAt: string
}

export interface DeviceTransportFrameSequencer {
  create(input: DeviceTransportFrameInput): DeviceTransportFrame
}

/** Create one sequencer per transport session to copy and order received bytes. */
export function createDeviceTransportFrameSequencer(): DeviceTransportFrameSequencer {
  let sequence = 0

  return {
    create(input) {
      sequence += 1
      return {
        payload: new Uint8Array(input.payload),
        sequence,
        characteristic: { ...input.characteristic },
        source: input.source,
        receivedAt: input.receivedAt,
      }
    },
  }
}

export type DeviceTransportFrameListener = (
  frame: DeviceTransportFrame,
) => void

export interface DeviceOperationOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

export interface DeviceWriteRequest extends DeviceOperationOptions {
  characteristic: DeviceCharacteristicRef
  payload: Uint8Array
  mode: 'with_response' | 'without_response'
}

export interface DeviceTransportNotificationSubscription {
  subscriptionId: string
  /** Stops notifications and succeeds when called more than once. */
  unsubscribe(): Promise<DeviceResult<void>>
}

export interface DeviceTransportSession {
  sessionId: string
  device: DiscoveredDevice
  getState(): DeviceTransportSessionState
  /**
   * Reports lifecycle changes without exposing native identifiers or errors.
   * Implementations call the listener once with the current state on subscribe.
   */
  subscribeState?(
    listener: DeviceTransportSessionStateListener,
  ): DeviceStateSubscription
  read(
    characteristic: DeviceCharacteristicRef,
    options?: DeviceOperationOptions,
  ): Promise<DeviceResult<DeviceTransportFrame>>
  write(request: DeviceWriteRequest): Promise<DeviceResult<void>>
  subscribe(
    characteristic: DeviceCharacteristicRef,
    listener: DeviceTransportFrameListener,
    options?: DeviceOperationOptions,
  ): Promise<DeviceResult<DeviceTransportNotificationSubscription>>
  /** Stops owned notifications before disconnecting; safe to repeat. */
  close(): Promise<DeviceResult<void>>
}

export interface DeviceTransport {
  transportId: string
  kind: DeviceTransportKind
  getState(): DeviceTransportState
  open(): Promise<DeviceResult<void>>
  startDiscovery(
    request: DiscoveryRequest,
    listener: DiscoveredDeviceListener,
  ): Promise<DeviceResult<DeviceDiscoverySession>>
  connect(request: ConnectRequest): Promise<DeviceResult<DeviceTransportSession>>
  /** Final cascading cleanup for discovery and every session; safe to repeat. */
  close(): Promise<DeviceResult<void>>
}
