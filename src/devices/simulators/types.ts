import type {
  DeviceAdapter,
  DeviceCapabilityReport,
  DeviceTransport,
  NormalizedDeviceEventBase,
} from '../contracts'
import type { OmiAudioChunkMetadata } from './internal-types'
import type { RingRole } from './internal-types'

export interface DeterministicClock {
  now(): string
  advance(milliseconds: number): string
  set(value: string): void
  reset(): string
}

export interface SimulatorSessionInfo {
  sessionId: string
  deviceId: string
}

export interface SimulatorRuntime<Event extends NormalizedDeviceEventBase> {
  kind: 'omi' | 'ring'
  device: import('../contracts').DiscoveredDevice
  transport: DeviceTransport
  adapter: DeviceAdapter<Event>
  clock: DeterministicClock
  next(): Event | undefined
  emit(input?: unknown): Event | undefined
  reset(): void
  getSequence(): number
}

export type OmiSimulatorMetadataInput = Partial<
  Pick<
    OmiAudioChunkMetadata,
    | 'codec'
    | 'sampleRateHz'
    | 'bitDepth'
    | 'channelCount'
    | 'packetSequence'
    | 'fragmentIndex'
  >
>

export interface OmiSimulatorEventInput {
  metadata?: OmiSimulatorMetadataInput
}

export interface OmiSimulatorOptions {
  clock?: DeterministicClock
  deviceName?: string
  events?: readonly OmiSimulatorEventInput[]
  capabilities?: DeviceCapabilityReport
}

export interface RingSimulatorEventInput {
  role: RingRole
  kind?: 'metric' | 'status' | 'history'
  name?: string
  value?: number | readonly number[] | string | boolean
  unit?: string
  status?: string
  record?: Readonly<Record<string, number | string | boolean>>
  privacy?: 'normalized' | 'local_only'
}

export interface RingSimulatorOptions {
  clock?: DeterministicClock
  deviceName?: string
  events?: readonly RingSimulatorEventInput[]
  capabilities?: DeviceCapabilityReport
}
