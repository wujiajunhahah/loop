import { deviceOperationErrorCodes } from '../contracts'
import type {
  CommandAcknowledgement,
  DeviceAdapter,
  DeviceCapabilityReport,
  DeviceCommand,
  DeviceDiscoverySession,
  DeviceError,
  DeviceOperationErrorCode,
  DeviceResult,
  DeviceSession,
  DeviceSessionState,
  DeviceStateSubscription,
  DeviceSubscription,
  DeviceTransport,
  DeviceTransportSession,
  DiscoveredDevice,
  NormalizedDevice,
  NormalizedDeviceEventBase,
} from '../contracts'
import type {
  DeviceRuntime,
  DeviceRuntimeOptions,
  RuntimeClock,
  RuntimeConnectOptions,
  RuntimeConnection,
  RuntimeConsentSettings,
  RuntimeDevicePhase,
  RuntimeDeviceSnapshot,
  RuntimeDiagnostic,
  RuntimeLatestValue,
  RuntimePersistedState,
  RuntimePhase,
  RuntimePreferences,
  RuntimeReconnectOptions,
  RuntimeReconnectPolicy,
  RuntimeScanOptions,
  RuntimeScanResult,
  RuntimeScheduler,
  RuntimeSessionSnapshot,
  RuntimeSnapshot,
  RuntimeUnsubscribe,
} from './types'

const DEFAULT_CONSENT: RuntimeConsentSettings = {
  audioCapture: false,
  sensitiveTelemetryExport: false,
  interactionEvents: false,
}

const DEFAULT_RECONNECT_POLICY: RuntimeReconnectPolicy = {
  maxAttempts: 3,
  delayMs: (attempt) => 250 * 2 ** Math.max(0, attempt - 1),
}

const DEFAULT_HISTORY_LIMIT = 64
const DEFAULT_DIAGNOSTICS_LIMIT = 64
const PRIVATE_EVENT_KEYS = new Set([
  'payload',
  'bytes',
  'transportFrame',
  'characteristic',
])

const ok = <T>(value: T): DeviceResult<T> => ({ ok: true, value })

function failure<T>(
  code: DeviceOperationErrorCode,
  message: string,
  retryable: boolean,
): DeviceResult<T> {
  return { ok: false, error: { code, message, retryable } }
}

function cancelled<T>(message = 'The device operation was cancelled.') {
  return failure<T>('operation_cancelled', message, true)
}

function isDeviceError(value: unknown): value is DeviceError {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.code !== 'string' ||
    typeof candidate.message !== 'string' ||
    typeof candidate.retryable !== 'boolean'
  ) {
    return false
  }
  if (deviceOperationErrorCodes.some((code) => code === candidate.code)) return true
  return (
    candidate.code === 'capability_unavailable' &&
    candidate.retryable === false &&
    typeof candidate.capabilityId === 'string' &&
    (candidate.capabilityState === 'requires_real_device' ||
      candidate.capabilityState === 'requires_vendor_profile') &&
    typeof candidate.reason === 'string'
  )
}

function errorFromUnknown<T>(
  code: DeviceOperationErrorCode,
  value: unknown,
  retryable: boolean,
): DeviceResult<T> {
  if (isDeviceError(value)) return { ok: false, error: value }
  return failure<T>(code, 'The device operation failed.', retryable)
}

function safeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 1) {
    return fallback
  }
  return value
}

function safeAttempts(value: number | undefined): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 1) {
    return DEFAULT_RECONNECT_POLICY.maxAttempts
  }
  return value
}

function safePreferences(
  value: RuntimePreferences | undefined,
): Record<string, string | number | boolean | null> {
  const preferences: Record<string, string | number | boolean | null> = {}
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      entry === null
    ) {
      preferences[key] = entry
    }
  }
  return preferences
}

function applySafeConsent(
  target: RuntimeConsentSettings,
  value: Partial<RuntimeConsentSettings> | undefined,
): void {
  for (const key of Object.keys(DEFAULT_CONSENT) as Array<keyof RuntimeConsentSettings>) {
    const next = value?.[key]
    if (typeof next === 'boolean') target[key] = next
  }
}

function deviceKey(device: DiscoveredDevice): string {
  return `${device.transportId}::${device.discoveryId}`
}

function copyDevice(device: DiscoveredDevice): DiscoveredDevice {
  return {
    ...device,
    ...(device.advertisedServiceIds === undefined
      ? {}
      : { advertisedServiceIds: [...device.advertisedServiceIds] }),
  }
}

function copyCapabilities(
  capabilities: DeviceCapabilityReport,
): DeviceCapabilityReport {
  return Object.fromEntries(
    Object.entries(capabilities).map(([capabilityId, state]) => [
      capabilityId,
      { ...state },
    ]),
  ) as unknown as DeviceCapabilityReport
}

function copyLatestValues(
  values: Map<string, RuntimeLatestValue>,
): Readonly<Record<string, RuntimeLatestValue>> {
  return Object.fromEntries(
    [...values].map(([name, value]) => [
      name,
      {
        ...value,
        value: Array.isArray(value.value) ? [...value.value] : value.value,
      },
    ]),
  )
}

function cloneEventData(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value !== 'object') return undefined
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return undefined
  if (seen.has(value)) return undefined
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((entry) => cloneEventData(entry, seen))
  }
  const copy: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (PRIVATE_EVENT_KEYS.has(key)) continue
    const cloned = cloneEventData(entry, seen)
    if (cloned !== undefined) copy[key] = cloned
  }
  return copy
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value
  seen.add(value)
  for (const nested of Object.values(value)) deepFreeze(nested, seen)
  return Object.freeze(value)
}

function unsubscribeSafely(subscription: DeviceSubscription): DeviceResult<void> {
  try {
    subscription.unsubscribe()
    return ok(undefined)
  } catch (error) {
    return errorFromUnknown('disconnected', error, true)
  }
}

function defaultClock(): RuntimeClock {
  return { now: () => new Date().toISOString() }
}

function defaultScheduler(): RuntimeScheduler {
  return {
    sleep(milliseconds, signal) {
      if (signal?.aborted) return Promise.resolve(cancelled<void>())
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          signal?.removeEventListener('abort', abort)
          resolve(ok(undefined))
        }, Math.max(0, milliseconds))
        const abort = () => {
          clearTimeout(timeout)
          signal?.removeEventListener('abort', abort)
          resolve(cancelled<void>())
        }
        signal?.addEventListener('abort', abort, { once: true })
      })
    },
  }
}

function makeUnsubscribe(remove: () => void): RuntimeUnsubscribe {
  let active = true
  const unsubscribe = (() => {
    if (!active) return
    active = false
    remove()
  }) as RuntimeUnsubscribe
  unsubscribe.unsubscribe = unsubscribe
  return unsubscribe
}

function normalizedEvent(event: NormalizedDeviceEventBase): NormalizedDeviceEventBase {
  const candidate = event as unknown as Record<string, unknown>
  const {
    payload: _payload,
    bytes: _bytes,
    transportFrame: _transportFrame,
    characteristic: _characteristic,
    ...safe
  } = candidate
  const normalized = cloneEventData(safe) as Record<string, unknown>
  const metric = normalized.metric
  if (
    normalized.kind === 'metric' &&
    typeof metric === 'object' &&
    metric !== null
  ) {
    const metricRecord = metric as Record<string, unknown>
    if (
      metricRecord.privacy === 'local_only' ||
      metricRecord.exportConsentRequired === true
    ) {
      const safeMetric: Record<string, unknown> = {}
      for (const key of [
        'contextStrength',
        'interpretationPolicy',
        'role',
        'name',
        'privacy',
        'exportConsentRequired',
      ]) {
        if (metricRecord[key] !== undefined) safeMetric[key] = metricRecord[key]
      }
      if (typeof metricRecord.provenance === 'object' && metricRecord.provenance !== null) {
        const provenance = metricRecord.provenance as Record<string, unknown>
        safeMetric.provenance = Object.fromEntries(
          ['profileId', 'sourceReference', 'sourceUrl', 'model', 'firmware', 'validation']
            .filter((key) => provenance[key] !== undefined)
            .map((key) => [key, provenance[key]]),
        )
      }
      normalized.metric = safeMetric
    }
  }
  if (normalized.kind === 'status' || normalized.kind === 'history') {
    const payload = normalized[normalized.kind] as Record<string, unknown> | undefined
    if (payload?.role === 'ppg' || payload?.role === 'accelerometer') {
      if (normalized.kind === 'history') normalized.history = { ...payload, record: {} }
      else normalized.status = { ...payload, value: 'local_only' }
    }
  }
  return normalized as unknown as NormalizedDeviceEventBase
}

function eventKind(event: NormalizedDeviceEventBase): unknown {
  return (event as unknown as { kind?: unknown }).kind
}

function isInteractionEvent(event: NormalizedDeviceEventBase): boolean {
  return eventKind(event) === 'interaction'
}

function parseFailureCode(
  event: NormalizedDeviceEventBase,
): Extract<DeviceOperationErrorCode, 'invalid_data' | 'protocol_error'> | undefined {
  if (eventKind(event) !== 'parse_failure') return undefined
  const code = (event as unknown as { errorCode?: unknown }).errorCode
  return code === 'protocol_error' ? 'protocol_error' : 'invalid_data'
}

function eventValue(event: NormalizedDeviceEventBase): RuntimeLatestValue | undefined {
  const metricEvent = event as unknown as {
    kind?: unknown
    metric?: {
      name?: unknown
      value?: unknown
      unit?: unknown
      privacy?: unknown
      exportConsentRequired?: unknown
    }
  }
  if (metricEvent.kind !== 'metric' || metricEvent.metric === undefined) return undefined
  const metric = metricEvent.metric
  if (
    typeof metric.name !== 'string' ||
    metric.value === undefined ||
    metric.privacy !== 'normalized' ||
    metric.exportConsentRequired === true
  ) {
    return undefined
  }
  if (
    typeof metric.value !== 'number' &&
    typeof metric.value !== 'string' &&
    typeof metric.value !== 'boolean' &&
    !(
      Array.isArray(metric.value) &&
      metric.value.every((value) => typeof value === 'number')
    )
  ) {
    return undefined
  }
  return {
    name: metric.name,
    value: Array.isArray(metric.value) ? [...metric.value] : metric.value,
    ...(typeof metric.unit === 'string' ? { unit: metric.unit } : {}),
    occurredAt: event.occurredAt,
    source: event.source,
    privacy: metric.privacy,
  }
}

interface InternalDevice {
  deviceKey: string
  discovered: DiscoveredDevice
  matchedAdapterIds: readonly string[]
  phase: RuntimeDevicePhase
  normalized?: NormalizedDevice
  capabilities?: DeviceCapabilityReport
  sessionId?: string
  latestEvent?: NormalizedDeviceEventBase
  latestValues: Map<string, RuntimeLatestValue>
}

interface InternalSession {
  deviceKey: string
  adapterId: string
  session: DeviceSession
  subscription: DeviceSubscription
  stateSubscription?: DeviceStateSubscription
  phase: RuntimeSessionSnapshot['phase']
  latestEvent?: NormalizedDeviceEventBase
  latestValues: Map<string, RuntimeLatestValue>
  history: NormalizedDeviceEventBase[]
  operationEpoch: number
}

interface DeviceOperation {
  epoch: number
  controller: AbortController
  removeAbort: RuntimeUnsubscribe
  kind: 'connect' | 'reconnect' | 'disconnect'
}

interface ActiveScan {
  generation: number
  scanId: string
  controller: AbortController
  sessions: Set<DeviceDiscoverySession>
  removeAbort: RuntimeUnsubscribe
  timeout?: ReturnType<typeof setTimeout>
}

export function createDeviceRuntime(options: DeviceRuntimeOptions): DeviceRuntime {
  const clock = options.clock ?? defaultClock()
  const scheduler = options.scheduler ?? defaultScheduler()
  const historyLimit = safeLimit(options.historyLimit, DEFAULT_HISTORY_LIMIT)
  const diagnosticsLimit = safeLimit(
    options.diagnosticsLimit,
    DEFAULT_DIAGNOSTICS_LIMIT,
  )
  const reconnectPolicy: RuntimeReconnectPolicy = {
    maxAttempts: safeAttempts(options.reconnectPolicy?.maxAttempts),
    delayMs: options.reconnectPolicy?.delayMs ?? DEFAULT_RECONNECT_POLICY.delayMs,
  }
  const consent: RuntimeConsentSettings = { ...DEFAULT_CONSENT }
  applySafeConsent(consent, options.consent)
  const preferences: Record<string, string | number | boolean | null> = safePreferences(
    options.preferences,
  )
  const profiles: Record<string, string> = {}
  const selectedDeviceIds: string[] = []
  const devices = new Map<string, InternalDevice>()
  const sessions = new Map<string, InternalSession>()
  const operations = new Map<string, DeviceOperation>()
  const listeners = new Set<() => void>()
  const diagnostics: RuntimeDiagnostic[] = []
  const transports = [...options.transports]
  const adapters = [...options.adapters]
  const transportById = new Map(transports.map((transport) => [transport.transportId, transport]))
  let phase: RuntimePhase = 'idle'
  let scanGeneration = 0
  let diagnosticSequence = 0
  let activeScan: ActiveScan | undefined
  let closed = false
  let closePromise: Promise<DeviceResult<void>> | undefined
  let persistenceQueue: Promise<void> = Promise.resolve()
  let persistedReady: Promise<DeviceResult<void>>

  const snapshot = (): RuntimeSnapshot =>
    deepFreeze({
      phase,
      discoveryActive: activeScan !== undefined && !activeScan.controller.signal.aborted,
      scanGeneration,
      devices: [...devices.values()].map((device) => ({
        deviceKey: device.deviceKey,
        discovered: copyDevice(device.discovered),
        matchedAdapterIds: [...device.matchedAdapterIds],
        phase: device.phase,
        ...(device.normalized === undefined ? {} : { normalized: { ...device.normalized } }),
        ...(device.capabilities === undefined
          ? {}
          : { capabilities: copyCapabilities(device.capabilities) }),
        ...(device.sessionId === undefined ? {} : { sessionId: device.sessionId }),
        ...(device.latestEvent === undefined
          ? {}
          : { latestEvent: normalizedEvent(device.latestEvent) }),
        latestValues: copyLatestValues(device.latestValues),
      })),
      sessions: [...sessions.values()].map((entry) => ({
        sessionId: entry.session.sessionId,
        deviceKey: entry.deviceKey,
        adapterId: entry.adapterId,
        device: { ...entry.session.device },
        capabilities: copyCapabilities(entry.session.capabilities),
        phase: entry.phase,
        ...(entry.latestEvent === undefined
          ? {}
          : { latestEvent: normalizedEvent(entry.latestEvent) }),
        latestValues: copyLatestValues(entry.latestValues),
        history: entry.history.map((event) => normalizedEvent(event)),
      })),
      selectedDeviceIds: [...selectedDeviceIds],
      profiles: { ...profiles },
      preferences: { ...preferences },
      consent: { ...consent },
      diagnostics: diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })

  let currentSnapshot = snapshot()

  const publish = () => {
    currentSnapshot = snapshot()
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        // A store listener cannot block another listener or device cleanup.
      }
    }
  }

  const steadyPhase = (fallback: 'ready' | 'failed' = 'ready'): RuntimePhase =>
    sessions.size > 0 ? 'connected' : fallback

  const addDiagnostic = (
    operation: RuntimeDiagnostic['operation'],
    diagnosticPhase: RuntimeDiagnostic['phase'],
    message: string,
    details: Omit<RuntimeDiagnostic, 'diagnosticId' | 'occurredAt' | 'operation' | 'phase' | 'message'> = {},
  ) => {
    diagnostics.push({
      diagnosticId: `runtime-diagnostic-${++diagnosticSequence}`,
      occurredAt: clock.now(),
      operation,
      phase: diagnosticPhase,
      message,
      ...details,
    })
    while (diagnostics.length > diagnosticsLimit) diagnostics.shift()
  }

  const persist = () => {
    const state: RuntimePersistedState = {
      version: 1,
      selectedDeviceIds: [...selectedDeviceIds],
      profiles: { ...profiles },
      preferences: { ...preferences },
      consent: { ...consent },
    }
    persistenceQueue = persistenceQueue
      .then(async () => {
        await options.persistence?.save(state)
      })
      .catch(() => {
        addDiagnostic('persistence', phase, 'Safe runtime preferences could not be saved.', {
          code: 'transport_unavailable',
        })
        publish()
      })
    return persistenceQueue
  }

  const restore = async (): Promise<DeviceResult<void>> => {
    if (options.persistence === undefined) return ok(undefined)
    try {
      const stored = await options.persistence.load()
      if (stored?.version !== 1) return ok(undefined)
      selectedDeviceIds.splice(0, selectedDeviceIds.length)
      for (const id of stored.selectedDeviceIds ?? []) {
        if (typeof id === 'string' && id.length > 0) selectedDeviceIds.push(id)
      }
      for (const [adapterId, profileId] of Object.entries(stored.profiles ?? {})) {
        if (typeof adapterId === 'string' && typeof profileId === 'string') {
          profiles[adapterId] = profileId
        }
      }
      Object.assign(preferences, safePreferences(stored.preferences))
      applySafeConsent(consent, stored.consent)
      publish()
      return ok(undefined)
    } catch {
      addDiagnostic('persistence', phase, 'Safe runtime preferences could not be loaded.', {
        code: 'transport_unavailable',
      })
      publish()
      return ok(undefined)
    }
  }

  persistedReady = restore()

  const ready = async (): Promise<DeviceResult<void>> => persistedReady

  const readyForMutation = async (): Promise<DeviceResult<void>> => {
    const readyResult = await ready()
    if (!readyResult.ok) return readyResult
    if (closed) return failure('session_closed', 'The device runtime is closed.', false)
    return ok(undefined)
  }

  const isCurrentScan = (candidate: ActiveScan): boolean =>
    activeScan?.generation === candidate.generation && !candidate.controller.signal.aborted

  const stopScan = async (candidate: ActiveScan | undefined) => {
    if (candidate === undefined) return
    candidate.controller.abort()
    candidate.removeAbort()
    if (candidate.timeout !== undefined) clearTimeout(candidate.timeout)
    await Promise.allSettled(
      [...candidate.sessions].map(async (session) => {
        await session.stop()
      }),
    )
    candidate.sessions.clear()
    if (activeScan?.generation === candidate.generation) activeScan = undefined
  }

  const completeActiveScan = async (candidate: ActiveScan) => {
    if (!isCurrentScan(candidate)) return
    await stopScan(candidate)
    if (closed) return
    phase = steadyPhase()
    addDiagnostic('scan', phase, 'Discovery completed.')
    publish()
  }

  const addDiscovered = (device: DiscoveredDevice, candidate: ActiveScan) => {
    if (!isCurrentScan(candidate) || closed) return
    const key = deviceKey(device)
    const matchedAdapterIds = adapters
      .filter((adapter) => {
        try {
          return adapter.matches(device)
        } catch {
          return false
        }
      })
      .map((adapter) => adapter.adapterId)
    const previous = devices.get(key)
    devices.set(key, {
      deviceKey: key,
      discovered: copyDevice(device),
      matchedAdapterIds,
      phase: previous?.phase === 'connected' ? previous.phase : 'discovered',
      ...(previous?.normalized === undefined ? {} : { normalized: previous.normalized }),
      ...(previous?.capabilities === undefined ? {} : { capabilities: previous.capabilities }),
      ...(previous?.sessionId === undefined ? {} : { sessionId: previous.sessionId }),
      ...(previous?.latestEvent === undefined ? {} : { latestEvent: previous.latestEvent }),
      latestValues: previous?.latestValues ?? new Map(),
    })
    publish()
  }

  const scan = async (
    scanOptions: RuntimeScanOptions = {},
  ): Promise<DeviceResult<RuntimeScanResult>> => {
    const readyResult = await ready()
    if (!readyResult.ok) return readyResult
    if (closed) return failure('session_closed', 'The device runtime is closed.', false)
    await stopScan(activeScan)
    const generation = ++scanGeneration
    const candidate: ActiveScan = {
      generation,
      scanId: `runtime-scan-${generation}`,
      controller: new AbortController(),
      sessions: new Set(),
      removeAbort: makeUnsubscribe(() => undefined),
    }
    activeScan = candidate
    candidate.removeAbort = forwardAbort(scanOptions.signal, candidate.controller)
    phase = 'scanning'
    addDiagnostic('scan', phase, 'Discovery started.')
    publish()
    const failures: DeviceError[] = []

    await Promise.all(
      transports.map(async (transport) => {
        if (!isCurrentScan(candidate)) return
        let opened: DeviceResult<void>
        try {
          opened = await transport.open()
        } catch (error) {
          const failed = errorFromUnknown<void>('transport_unavailable', error, true)
          if (!failed.ok) failures.push(failed.error)
          return
        }
        if (!opened.ok) {
          failures.push(opened.error)
          return
        }
        if (!isCurrentScan(candidate)) return
        let started: Awaited<ReturnType<DeviceTransport['startDiscovery']>>
        try {
          started = await transport.startDiscovery(
            {
              filters: scanOptions.filters,
              timeoutMs: scanOptions.timeoutMs,
              allowDuplicates: scanOptions.allowDuplicates,
              signal: candidate.controller.signal,
            },
            (device) => addDiscovered(device, candidate),
          )
        } catch {
          failures.push({
            code: 'discovery_failed',
            message: 'Discovery failed.',
            retryable: true,
          })
          return
        }
        if (!started.ok) {
          failures.push(started.error)
          return
        }
        if (!isCurrentScan(candidate)) {
          await started.value.stop()
          return
        }
        candidate.sessions.add(started.value)
      }),
    )
    if (!isCurrentScan(candidate)) {
      await stopScan(candidate)
      return cancelled('A newer discovery superseded this scan.')
    }
    if (failures.length === transports.length && failures[0] !== undefined) {
      await stopScan(candidate)
      phase = steadyPhase('failed')
      addDiagnostic('scan', phase, 'Discovery failed.', { code: failures[0].code })
      publish()
      return { ok: false, error: failures[0] }
    }
    if (candidate.sessions.size === 0) {
      await completeActiveScan(candidate)
      return ok({
        scanId: candidate.scanId,
        devices: [...devices.values()].map((entry) => deviceSnapshot(entry)),
      })
    }
    if (
      scanOptions.timeoutMs !== undefined &&
      Number.isFinite(scanOptions.timeoutMs) &&
      scanOptions.timeoutMs > 0
    ) {
      candidate.timeout = setTimeout(
        () => void completeActiveScan(candidate),
        scanOptions.timeoutMs,
      )
    }
    phase = steadyPhase()
    addDiagnostic('scan', phase, 'Discovery is active.')
    publish()
    return ok({
      scanId: candidate.scanId,
      devices: [...devices.values()].map((entry) => deviceSnapshot(entry)),
    })
  }

  const cancelScan = async (): Promise<DeviceResult<void>> => {
    const wasScanning = activeScan !== undefined || phase === 'scanning'
    await stopScan(activeScan)
    if (!closed && wasScanning) {
      if (phase === 'scanning') phase = steadyPhase()
      addDiagnostic('scan', phase, 'Discovery stopped.')
      publish()
    }
    return ok(undefined)
  }

  const resolveDevice = (reference: string | DiscoveredDevice): InternalDevice | undefined => {
    if (typeof reference !== 'string') {
      const key = deviceKey(reference)
      const existing = devices.get(key)
      if (existing !== undefined) return existing
      const matchedAdapterIds = adapters
        .filter((adapter) => {
          try {
            return adapter.matches(reference)
          } catch {
            return false
          }
        })
        .map((adapter) => adapter.adapterId)
      const entry: InternalDevice = {
        deviceKey: key,
        discovered: copyDevice(reference),
        matchedAdapterIds,
        phase: 'discovered',
        latestValues: new Map(),
      }
      devices.set(key, entry)
      return entry
    }
    return (
      devices.get(reference) ??
      [...devices.values()].find(
        (entry) => entry.discovered.discoveryId === reference || entry.normalized?.deviceId === reference,
      )
    )
  }

  const operationIsCurrent = (key: string, operation: DeviceOperation): boolean =>
    operations.get(key) === operation && !operation.controller.signal.aborted && !closed

  const beginOperation = (
    key: string,
    kind: DeviceOperation['kind'],
    signal: AbortSignal | undefined,
  ): DeviceOperation => {
    const previous = operations.get(key)
    previous?.controller.abort()
    previous?.removeAbort()
    const operation: DeviceOperation = {
      epoch: (previous?.epoch ?? 0) + 1,
      controller: new AbortController(),
      removeAbort: makeUnsubscribe(() => undefined),
      kind,
    }
    operations.set(key, operation)
    operation.removeAbort = forwardAbort(signal, operation.controller)
    return operation
  }

  const finishCancelledOperation = (
    key: string,
    entry: InternalDevice,
    operation: DeviceOperation,
  ) => {
    if (operations.get(key) !== operation) return
    operations.delete(key)
    operation.removeAbort()
    if (closed) return
    const existing = sessions.get(key)
    entry.phase = existing?.phase ?? 'disconnected'
    phase = steadyPhase()
    publish()
  }

  const closeTransportSession = async (session: DeviceTransportSession) => {
    try {
      await session.close()
    } catch {
      // The caller has no longer got a usable session; cleanup is best effort.
    }
  }

  const closeDeviceSession = async (session: DeviceSession): Promise<DeviceResult<void>> => {
    try {
      return await session.close()
    } catch (error) {
      return errorFromUnknown('disconnected', error, true)
    }
  }

  const clearSession = (key: string, session: InternalSession) => {
    if (sessions.get(key) !== session) return
    session.stateSubscription?.unsubscribe()
    unsubscribeSafely(session.subscription)
    sessions.delete(key)
    const device = devices.get(key)
    if (device?.sessionId === session.session.sessionId) {
      device.sessionId = undefined
      device.phase = 'disconnected'
    }
  }

  const acceptsEvent = (event: NormalizedDeviceEventBase) =>
    !isInteractionEvent(event) || consent.interactionEvents

  const handleUnexpectedSessionEnd = (
    key: string,
    session: InternalSession,
    state: DeviceSessionState,
  ) => {
    if (
      (state !== 'disconnected' && state !== 'failed') ||
      sessions.get(key) !== session ||
      closed
    ) return
    session.stateSubscription?.unsubscribe()
    unsubscribeSafely(session.subscription)
    sessions.delete(key)
    session.phase = 'failed'
    const device = devices.get(key)
    if (device?.sessionId === session.session.sessionId) {
      device.sessionId = undefined
      device.phase = 'failed'
    }
    phase = steadyPhase('failed')
    addDiagnostic(
      'disconnect',
      'failed',
      'The device session ended unexpectedly.',
      { code: 'disconnected' },
    )
    publish()
    void closeDeviceSession(session.session)
  }

  const handleEvent = (
    key: string,
    operation: DeviceOperation,
    sessionId: string,
    event: NormalizedDeviceEventBase,
  ) => {
    const entry = sessions.get(key)
    if (
      entry?.session.sessionId !== sessionId ||
      entry.operationEpoch !== operation.epoch ||
      operation.controller.signal.aborted ||
      closed
    ) return
    const safeEvent = normalizedEvent(event)
    if (!acceptsEvent(safeEvent)) return
    entry.latestEvent = safeEvent
    entry.history.push(safeEvent)
    while (entry.history.length > historyLimit) entry.history.shift()
    const value = eventValue(safeEvent)
    if (value !== undefined) entry.latestValues.set(value.name, value)
    const device = devices.get(key)
    if (device !== undefined) {
      device.latestEvent = safeEvent
      if (value !== undefined) device.latestValues.set(value.name, value)
    }
    const safeParseCode = parseFailureCode(safeEvent)
    if (safeParseCode === undefined) {
      addDiagnostic('event', 'connected', 'Normalized device event received.', {
        deviceKey: key,
        adapterId: entry.adapterId,
      })
    } else {
      addDiagnostic('event', 'connected', 'Device data could not be parsed.', {
        code: safeParseCode,
      })
    }
    publish()
  }

  const makeConnection = (key: string, entry: InternalSession): RuntimeConnection => ({
    sessionId: entry.session.sessionId,
    deviceKey: key,
    adapterId: entry.adapterId,
    device: { ...entry.session.device },
    capabilities: copyCapabilities(entry.session.capabilities),
    execute: (command: DeviceCommand): Promise<DeviceResult<CommandAcknowledgement>> =>
      entry.session.execute(command),
    subscribe: (listener) => entry.session.subscribe((event) => {
      const safeEvent = normalizedEvent(event)
      if (acceptsEvent(safeEvent)) listener(safeEvent)
    }),
    close: () =>
      sessions.get(key) === entry ? disconnect(key) : Promise.resolve(ok(undefined)),
  })

  const connectWithOperation = async (
    entry: InternalDevice,
    adapter: DeviceAdapter,
    operation: DeviceOperation,
    optionsForConnect: RuntimeConnectOptions,
  ): Promise<DeviceResult<RuntimeConnection>> => {
    const transport = transportById.get(entry.discovered.transportId)
    if (transport === undefined) {
      return failure('transport_unavailable', 'The device transport is unavailable.', true)
    }
    if (!operationIsCurrent(entry.deviceKey, operation)) return cancelled()
    phase = operation.kind === 'reconnect' ? 'reconnecting' : 'connecting'
    entry.phase = operation.kind === 'reconnect' ? 'reconnecting' : 'connecting'
    publish()
    let opened: DeviceResult<void>
    try {
      opened = await transport.open()
    } catch (error) {
      return errorFromUnknown('transport_unavailable', error, true)
    }
    if (!opened.ok) return opened
    if (!operationIsCurrent(entry.deviceKey, operation)) return cancelled()
    let connected: DeviceResult<DeviceTransportSession>
    try {
      connected = await transport.connect({
        device: entry.discovered,
        timeoutMs: optionsForConnect.timeoutMs,
        signal: operation.controller.signal,
      })
    } catch (error) {
      return errorFromUnknown('connection_failed', error, true)
    }
    if (!connected.ok) return connected
    if (!operationIsCurrent(entry.deviceKey, operation)) {
      await closeTransportSession(connected.value)
      return cancelled()
    }
    let openedSession: DeviceResult<DeviceSession>
    try {
      openedSession = await adapter.openSession(connected.value)
    } catch (error) {
      await closeTransportSession(connected.value)
      return errorFromUnknown('connection_failed', error, false)
    }
    if (!openedSession.ok) {
      await closeTransportSession(connected.value)
      return openedSession
    }
    const deviceSession = openedSession.value
    if (!operationIsCurrent(entry.deviceKey, operation)) {
      await closeDeviceSession(deviceSession)
      return cancelled()
    }
    const pendingEvents: NormalizedDeviceEventBase[] = []
    let sessionRegistered = false
    let subscribed: DeviceResult<DeviceSubscription>
    try {
      subscribed = deviceSession.subscribe((event) => {
        if (!acceptsEvent(event)) return
        if (sessionRegistered) {
          handleEvent(entry.deviceKey, operation, deviceSession.sessionId, event)
          return
        }
        pendingEvents.push(normalizedEvent(event))
        while (pendingEvents.length > historyLimit) pendingEvents.shift()
      })
    } catch (error) {
      await closeDeviceSession(deviceSession)
      return errorFromUnknown('notification_failed', error, true)
    }
    if (!subscribed.ok) {
      await closeDeviceSession(deviceSession)
      return subscribed
    }
    if (!operationIsCurrent(entry.deviceKey, operation)) {
      unsubscribeSafely(subscribed.value)
      await closeDeviceSession(deviceSession)
      return cancelled()
    }
    const existing = sessions.get(entry.deviceKey)
    if (existing !== undefined) {
      existing.stateSubscription?.unsubscribe()
      const unsubscribed = unsubscribeSafely(existing.subscription)
      const closedExisting = await closeDeviceSession(existing.session)
      clearSession(entry.deviceKey, existing)
      const cleanupFailure = !unsubscribed.ok ? unsubscribed : closedExisting
      if (!cleanupFailure.ok) {
        unsubscribeSafely(subscribed.value)
        await closeDeviceSession(deviceSession)
        return { ok: false, error: cleanupFailure.error }
      }
    }
    const internal: InternalSession = {
      deviceKey: entry.deviceKey,
      adapterId: adapter.adapterId,
      session: deviceSession,
      subscription: subscribed.value,
      phase: 'connected',
      latestValues: new Map(),
      history: [],
      operationEpoch: operation.epoch,
    }
    sessions.set(entry.deviceKey, internal)
    sessionRegistered = true
    entry.phase = 'connected'
    entry.normalized = { ...deviceSession.device }
    entry.capabilities = copyCapabilities(deviceSession.capabilities)
    entry.sessionId = deviceSession.sessionId
    phase = 'connected'
    internal.stateSubscription = deviceSession.subscribeState?.((state) => {
      handleUnexpectedSessionEnd(entry.deviceKey, internal, state)
    })
    if (sessions.get(entry.deviceKey) !== internal) {
      internal.stateSubscription?.unsubscribe()
      operation.removeAbort()
      return failure('disconnected', 'The device session ended while connecting.', true)
    }
    addDiagnostic('connect', phase, 'Device session connected.', {
      deviceKey: entry.deviceKey,
      adapterId: adapter.adapterId,
    })
    for (const event of pendingEvents) {
      handleEvent(entry.deviceKey, operation, deviceSession.sessionId, event)
    }
    operation.removeAbort()
    publish()
    return ok(makeConnection(entry.deviceKey, internal))
  }

  const connect = async (
    reference: string | DiscoveredDevice,
    connectOptions: RuntimeConnectOptions = {},
  ): Promise<DeviceResult<RuntimeConnection>> => {
    const readyResult = await ready()
    if (!readyResult.ok) return readyResult
    if (closed) return failure('session_closed', 'The device runtime is closed.', false)
    const entry = resolveDevice(reference)
    if (entry === undefined) return failure('device_not_found', 'The discovered device is unavailable.', false)
    const adapterId = connectOptions.adapterId ?? entry.matchedAdapterIds[0]
    const adapter = adapters.find((candidate) => candidate.adapterId === adapterId)
    if (adapter === undefined) {
      return failure('device_not_found', 'No compatible device adapter is available.', false)
    }
    const currentConsent = { ...consent }
    applySafeConsent(currentConsent, connectOptions.consent)
    if (adapter.adapterId.startsWith('omi-audio') && !currentConsent.audioCapture) {
      return failure('permission_denied', 'Explicit audio consent is required.', false)
    }
    const existing = sessions.get(entry.deviceKey)
    if (existing?.phase === 'connected') return ok(makeConnection(entry.deviceKey, existing))
    await cancelScan()
    const operation = beginOperation(entry.deviceKey, 'connect', connectOptions.signal)
    if (operation.controller.signal.aborted) {
      const result = cancelled<RuntimeConnection>()
      finishCancelledOperation(entry.deviceKey, entry, operation)
      return result
    }
    const result = await connectWithOperation(entry, adapter, operation, connectOptions)
    if (operationIsCurrent(entry.deviceKey, operation)) {
      if (!result.ok) {
        entry.phase = result.error.code === 'operation_cancelled' ? 'disconnected' : 'failed'
        phase = steadyPhase(
          result.error.code === 'operation_cancelled' ? 'ready' : 'failed',
        )
        addDiagnostic('connect', phase, 'Device session did not connect.', {
          deviceKey: entry.deviceKey,
          adapterId: adapter.adapterId,
          code: result.error.code,
        })
        publish()
      }
      operations.delete(entry.deviceKey)
      operation.removeAbort()
    } else {
      finishCancelledOperation(entry.deviceKey, entry, operation)
    }
    return result
  }

  const disconnect = async (
    reference: string | DiscoveredDevice,
  ): Promise<DeviceResult<void>> => {
    const readyResult = await ready()
    if (!readyResult.ok) return readyResult
    const entry = resolveDevice(reference)
    if (entry === undefined) return ok(undefined)
    const operation = beginOperation(entry.deviceKey, 'disconnect', undefined)
    entry.phase = 'disconnecting'
    phase = 'disconnecting'
    const current = sessions.get(entry.deviceKey)
    if (current === undefined) {
      entry.phase = 'disconnected'
      phase = closed ? 'closed' : steadyPhase()
      operations.delete(entry.deviceKey)
      publish()
      return ok(undefined)
    }
    current.phase = 'disconnecting'
    current.stateSubscription?.unsubscribe()
    publish()
    const unsubscribed = unsubscribeSafely(current.subscription)
    const closedSession = await closeDeviceSession(current.session)
    const result = !unsubscribed.ok ? unsubscribed : closedSession
    if (operationIsCurrent(entry.deviceKey, operation)) {
      clearSession(entry.deviceKey, current)
      entry.phase = result.ok ? 'disconnected' : 'failed'
      phase = steadyPhase(result.ok ? 'ready' : 'failed')
      operations.delete(entry.deviceKey)
      addDiagnostic('disconnect', phase, 'Device session disconnected.', {
        deviceKey: entry.deviceKey,
        adapterId: current.adapterId,
        ...(result.ok ? {} : { code: result.error.code }),
      })
      publish()
    }
    return result
  }

  const reconnect = async (
    reference: string | DiscoveredDevice,
    reconnectOptions: RuntimeReconnectOptions = {},
  ): Promise<DeviceResult<RuntimeConnection>> => {
    const readyResult = await ready()
    if (!readyResult.ok) return readyResult
    if (closed) return failure('session_closed', 'The device runtime is closed.', false)
    const entry = resolveDevice(reference)
    if (entry === undefined) return failure('device_not_found', 'The discovered device is unavailable.', false)
    const adapterId = reconnectOptions.adapterId ?? entry.matchedAdapterIds[0]
    const adapter = adapters.find((candidate) => candidate.adapterId === adapterId)
    if (adapter === undefined) return failure('device_not_found', 'No compatible device adapter is available.', false)
    const currentConsent = { ...consent }
    applySafeConsent(currentConsent, reconnectOptions.consent)
    if (adapter.adapterId.startsWith('omi-audio') && !currentConsent.audioCapture) {
      return failure('permission_denied', 'Explicit audio consent is required.', false)
    }
    const operation = beginOperation(entry.deviceKey, 'reconnect', reconnectOptions.signal)
    if (operation.controller.signal.aborted) {
      const result = cancelled<RuntimeConnection>()
      finishCancelledOperation(entry.deviceKey, entry, operation)
      return result
    }
    const existing = sessions.get(entry.deviceKey)
    if (existing !== undefined) {
      existing.stateSubscription?.unsubscribe()
      const unsubscribed = unsubscribeSafely(existing.subscription)
      const closedExisting = await closeDeviceSession(existing.session)
      clearSession(entry.deviceKey, existing)
      const cleanupFailure = !unsubscribed.ok ? unsubscribed : closedExisting
      if (!cleanupFailure.ok) {
        operations.delete(entry.deviceKey)
        entry.phase = 'failed'
        phase = steadyPhase('failed')
        addDiagnostic('reconnect', phase, 'Existing session cleanup failed.', {
          deviceKey: entry.deviceKey,
          adapterId: existing.adapterId,
          code: cleanupFailure.error.code,
        })
        publish()
        return { ok: false, error: cleanupFailure.error }
      }
    }
    const maxAttempts = safeAttempts(
      reconnectOptions.maxAttempts ?? reconnectPolicy.maxAttempts,
    )
    let lastFailure: DeviceResult<RuntimeConnection> = failure(
      'connection_failed',
      'The device could not reconnect.',
      true,
    )
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (!operationIsCurrent(entry.deviceKey, operation)) {
        const result = cancelled<RuntimeConnection>()
        finishCancelledOperation(entry.deviceKey, entry, operation)
        return result
      }
      addDiagnostic('reconnect', 'reconnecting', 'Reconnect attempt started.', {
        deviceKey: entry.deviceKey,
        adapterId: adapter.adapterId,
        attempt,
      })
      const result = await connectWithOperation(entry, adapter, operation, reconnectOptions)
      if (result.ok) {
        operations.delete(entry.deviceKey)
        operation.removeAbort()
        return result
      }
      lastFailure = result
      if (!result.error.retryable || result.error.code === 'operation_cancelled') break
      if (attempt >= maxAttempts) break
      const delay = Math.max(0, reconnectPolicy.delayMs(attempt))
      const slept = await scheduler.sleep(delay, operation.controller.signal)
      if (!slept.ok) {
        finishCancelledOperation(entry.deviceKey, entry, operation)
        return slept
      }
    }
    if (lastFailure.ok) return lastFailure
    if (lastFailure.error.code === 'operation_cancelled') {
      finishCancelledOperation(entry.deviceKey, entry, operation)
      return lastFailure
    }
    if (operationIsCurrent(entry.deviceKey, operation)) {
      operations.delete(entry.deviceKey)
      operation.removeAbort()
      entry.phase = 'failed'
      phase = steadyPhase('failed')
      addDiagnostic('reconnect', phase, 'Reconnect policy exhausted.', {
        deviceKey: entry.deviceKey,
        adapterId: adapter.adapterId,
        code: lastFailure.error.code,
      })
      publish()
    }
    return lastFailure
  }

  const setConsent = async (
    next: Partial<RuntimeConsentSettings>,
  ): Promise<DeviceResult<void>> => {
    const mutable = await readyForMutation()
    if (!mutable.ok) return mutable
    const revokeAudio = next.audioCapture === false
    const revokeInteractions = next.interactionEvents === false
    applySafeConsent(consent, next)
    let firstFailure: DeviceError | undefined
    if (revokeAudio) {
      const audioSessions = [...sessions.entries()]
        .filter(([, entry]) => entry.adapterId.startsWith('omi-audio'))
        .map(([key]) => key)
      for (const key of audioSessions) {
        const result = await disconnect(key)
        if (!result.ok && firstFailure === undefined) firstFailure = result.error
      }
    }
    if (revokeInteractions) {
      for (const session of sessions.values()) {
        session.history = session.history.filter((event) => !isInteractionEvent(event))
        session.latestEvent = session.history.at(-1)
      }
      for (const device of devices.values()) {
        if (device.latestEvent !== undefined && isInteractionEvent(device.latestEvent)) {
          device.latestEvent = undefined
        }
        const session = sessions.get(device.deviceKey)
        if (session !== undefined && session.session.sessionId === device.sessionId) {
          device.latestEvent = session.latestEvent
        }
      }
    }
    await persist()
    publish()
    return firstFailure === undefined ? ok(undefined) : { ok: false, error: firstFailure }
  }

  const setPreferences = async (
    next: RuntimePreferences,
  ): Promise<DeviceResult<void>> => {
    const mutable = await readyForMutation()
    if (!mutable.ok) return mutable
    for (const key of Object.keys(preferences)) delete preferences[key]
    Object.assign(preferences, safePreferences(next))
    await persist()
    publish()
    return ok(undefined)
  }

  const selectDevice = async (
    deviceId: string,
    selected = true,
  ): Promise<DeviceResult<void>> => {
    const mutable = await readyForMutation()
    if (!mutable.ok) return mutable
    const index = selectedDeviceIds.indexOf(deviceId)
    if (selected && index === -1) selectedDeviceIds.push(deviceId)
    if (!selected && index !== -1) selectedDeviceIds.splice(index, 1)
    await persist()
    publish()
    return ok(undefined)
  }

  const setProfile = async (
    adapterId: string,
    profileId: string,
  ): Promise<DeviceResult<void>> => {
    const mutable = await readyForMutation()
    if (!mutable.ok) return mutable
    if (adapterId.trim() === '' || profileId.trim() === '') {
      return failure('invalid_data', 'A profile identifier is required.', false)
    }
    profiles[adapterId] = profileId
    await persist()
    publish()
    return ok(undefined)
  }

  const close = async (): Promise<DeviceResult<void>> => {
    if (closePromise !== undefined) return closePromise
    const attempt: Promise<DeviceResult<void>> = (async () => {
      closed = true
      await stopScan(activeScan)
      for (const operation of operations.values()) {
        operation.controller.abort()
        operation.removeAbort()
      }
      const failures: DeviceError[] = []
      for (const [key, session] of sessions) {
        session.stateSubscription?.unsubscribe()
        const unsubscribed = unsubscribeSafely(session.subscription)
        if (!unsubscribed.ok) failures.push(unsubscribed.error)
        const result = await closeDeviceSession(session.session)
        if (!result.ok) failures.push(result.error)
        if (unsubscribed.ok && result.ok) sessions.delete(key)
        else session.phase = 'failed'
      }
      for (const transport of transports) {
        try {
          const result = await transport.close()
          if (!result.ok) failures.push(result.error)
        } catch {
          failures.push({
            code: 'transport_unavailable',
            message: 'A device transport could not close.',
            retryable: true,
          })
        }
      }
      phase = failures[0] === undefined ? 'closed' : 'failed'
      for (const entry of devices.values()) {
        entry.phase = failures[0] === undefined ? 'disconnected' : 'failed'
        entry.sessionId = undefined
      }
      operations.clear()
      addDiagnostic('disconnect', phase, 'Device runtime closed.', {
        ...(failures[0] === undefined ? {} : { code: failures[0].code }),
      })
      publish()
      return failures[0] === undefined ? ok(undefined) : { ok: false, error: failures[0] }
    })()
    const pending = attempt.then((result): DeviceResult<void> => {
      if (!result.ok) closePromise = undefined
      return result
    })
    closePromise = pending
    return pending
  }

  return {
    ready,
    getSnapshot: () => currentSnapshot,
    getServerSnapshot: () => currentSnapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return makeUnsubscribe(() => listeners.delete(listener))
    },
    scan,
    cancelScan,
    connect,
    reconnect,
    disconnect,
    setConsent,
    setPreferences,
    selectDevice,
    setProfile,
    close,
  }
}

function deviceSnapshot(device: InternalDevice): RuntimeDeviceSnapshot {
  return {
    deviceKey: device.deviceKey,
    discovered: copyDevice(device.discovered),
    matchedAdapterIds: [...device.matchedAdapterIds],
    phase: device.phase,
    ...(device.normalized === undefined ? {} : { normalized: { ...device.normalized } }),
    ...(device.capabilities === undefined
      ? {}
      : { capabilities: copyCapabilities(device.capabilities) }),
    ...(device.sessionId === undefined ? {} : { sessionId: device.sessionId }),
    ...(device.latestEvent === undefined ? {} : { latestEvent: device.latestEvent }),
    latestValues: Object.fromEntries(device.latestValues),
  }
}

function forwardAbort(
  source: AbortSignal | undefined,
  target: AbortController,
): RuntimeUnsubscribe {
  if (source === undefined) return makeUnsubscribe(() => undefined)
  const abort = () => target.abort()
  if (source.aborted) target.abort()
  else source.addEventListener('abort', abort, { once: true })
  return makeUnsubscribe(() => source.removeEventListener('abort', abort))
}
