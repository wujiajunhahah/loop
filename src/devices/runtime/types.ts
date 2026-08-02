import type {
  DeviceAdapter,
  DeviceCapabilityReport,
  DeviceCommand,
  DeviceError,
  DeviceResult,
  DeviceSession,
  DeviceSubscription,
  DeviceTransport,
  DiscoveredDevice,
  NormalizedDevice,
  NormalizedDeviceEventBase,
} from '../contracts'

export interface RuntimeClock {
  now(): string
}

export interface RuntimeScheduler {
  sleep(milliseconds: number, signal?: AbortSignal): Promise<DeviceResult<void>>
}

export type RuntimePreferenceValue = string | number | boolean | null

export type RuntimePreferences = Readonly<
  Record<string, RuntimePreferenceValue>
>

export interface RuntimeConsentSettings {
  audioCapture: boolean
  sensitiveTelemetryExport: boolean
  interactionEvents: boolean
}

export interface RuntimePersistedState {
  version: 1
  selectedDeviceIds: readonly string[]
  profiles: Readonly<Record<string, string>>
  preferences: RuntimePreferences
  consent: Partial<RuntimeConsentSettings>
}

export interface RuntimePersistence {
  load(): RuntimePersistedState | null | undefined | Promise<RuntimePersistedState | null | undefined>
  save(state: RuntimePersistedState): void | Promise<void>
}

export interface RuntimeReconnectPolicy {
  maxAttempts: number
  delayMs(attempt: number): number
}

export type RuntimePhase =
  | 'idle'
  | 'opening'
  | 'scanning'
  | 'ready'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'reconnecting'
  | 'failed'
  | 'closed'

export type RuntimeDevicePhase =
  | 'discovered'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'

export interface RuntimeLatestValue {
  name: string
  value: number | readonly number[] | string | boolean
  unit?: string
  occurredAt: string
  source: 'physical' | 'simulated'
  privacy: 'normalized' | 'local_only'
}

export interface RuntimeDiagnostic {
  diagnosticId: string
  occurredAt: string
  operation: 'persistence' | 'scan' | 'connect' | 'disconnect' | 'reconnect' | 'event'
  phase: RuntimePhase | RuntimeDevicePhase
  deviceKey?: string
  adapterId?: string
  code?: DeviceError['code']
  message: string
  attempt?: number
}

export interface RuntimeDeviceSnapshot {
  deviceKey: string
  discovered: DiscoveredDevice
  matchedAdapterIds: readonly string[]
  phase: RuntimeDevicePhase
  normalized?: NormalizedDevice
  capabilities?: DeviceCapabilityReport
  sessionId?: string
  latestEvent?: NormalizedDeviceEventBase
  latestValues: Readonly<Record<string, RuntimeLatestValue>>
}

export interface RuntimeSessionSnapshot {
  sessionId: string
  deviceKey: string
  adapterId: string
  device: NormalizedDevice
  capabilities: DeviceCapabilityReport
  phase: Extract<RuntimeDevicePhase, 'connecting' | 'connected' | 'disconnecting' | 'reconnecting' | 'disconnected' | 'failed'>
  latestEvent?: NormalizedDeviceEventBase
  latestValues: Readonly<Record<string, RuntimeLatestValue>>
  history: readonly NormalizedDeviceEventBase[]
}

export interface RuntimeSnapshot {
  phase: RuntimePhase
  scanGeneration: number
  devices: readonly RuntimeDeviceSnapshot[]
  sessions: readonly RuntimeSessionSnapshot[]
  selectedDeviceIds: readonly string[]
  profiles: Readonly<Record<string, string>>
  preferences: RuntimePreferences
  consent: RuntimeConsentSettings
  diagnostics: readonly RuntimeDiagnostic[]
}

export type RuntimeUnsubscribe = (() => void) & {
  unsubscribe(): void
}

export interface RuntimeScanOptions {
  filters?: readonly import('../contracts').DiscoveryFilter[]
  timeoutMs?: number
  allowDuplicates?: boolean
  signal?: AbortSignal
}

export interface RuntimeScanResult {
  scanId: string
  devices: readonly RuntimeDeviceSnapshot[]
}

export interface RuntimeConnectOptions {
  adapterId?: string
  timeoutMs?: number
  signal?: AbortSignal
  consent?: Partial<RuntimeConsentSettings>
}

export interface RuntimeReconnectOptions extends RuntimeConnectOptions {
  maxAttempts?: number
}

export interface RuntimeConnection {
  sessionId: string
  deviceKey: string
  adapterId: string
  device: NormalizedDevice
  capabilities: DeviceCapabilityReport
  execute(command: DeviceCommand): Promise<DeviceResult<import('../contracts').CommandAcknowledgement>>
  subscribe(
    listener: (event: NormalizedDeviceEventBase) => void,
  ): DeviceResult<DeviceSubscription>
  close(): Promise<DeviceResult<void>>
}

export interface DeviceRuntimeOptions {
  transports: readonly DeviceTransport[]
  adapters: readonly DeviceAdapter<any>[]
  clock?: RuntimeClock
  scheduler?: RuntimeScheduler
  persistence?: RuntimePersistence
  reconnectPolicy?: Partial<RuntimeReconnectPolicy>
  historyLimit?: number
  diagnosticsLimit?: number
  preferences?: RuntimePreferences
  consent?: Partial<RuntimeConsentSettings>
}

export interface DeviceRuntime {
  ready(): Promise<DeviceResult<void>>
  getSnapshot(): RuntimeSnapshot
  getServerSnapshot(): RuntimeSnapshot
  subscribe(listener: () => void): RuntimeUnsubscribe
  scan(options?: RuntimeScanOptions): Promise<DeviceResult<RuntimeScanResult>>
  cancelScan(): Promise<DeviceResult<void>>
  connect(
    device: string | DiscoveredDevice,
    options?: RuntimeConnectOptions,
  ): Promise<DeviceResult<RuntimeConnection>>
  reconnect(
    device: string | DiscoveredDevice,
    options?: RuntimeReconnectOptions,
  ): Promise<DeviceResult<RuntimeConnection>>
  disconnect(device: string | DiscoveredDevice): Promise<DeviceResult<void>>
  setConsent(
    consent: Partial<RuntimeConsentSettings>,
  ): Promise<DeviceResult<void>>
  setPreferences(
    preferences: RuntimePreferences,
  ): Promise<DeviceResult<void>>
  selectDevice(deviceId: string, selected?: boolean): Promise<DeviceResult<void>>
  setProfile(adapterId: string, profileId: string): Promise<DeviceResult<void>>
  close(): Promise<DeviceResult<void>>
}
