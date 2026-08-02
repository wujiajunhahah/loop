import type {
  ConnectRequest,
  DeviceCharacteristicRef,
  DeviceDiscoverySession,
  DeviceOperationOptions,
  DeviceOperationErrorCode,
  DeviceResult,
  DeviceTransport,
  DeviceTransportFrame,
  DeviceTransportFrameListener,
  DeviceTransportNotificationSubscription,
  DeviceTransportSession,
  DeviceTransportSessionState,
  DeviceTransportState,
  DeviceWriteRequest,
  DiscoveredDevice,
  DiscoveryFilter,
  DiscoveryRequest,
} from '../contracts'
import { createDeviceTransportFrameSequencer } from '../contracts'
import {
  loadCapacitorBleClient,
  type BleClientPort,
  type BleService,
  type BleScanOptions,
  type BleScanResult,
} from './bleClient'
import { normalizeBleError } from './errors'

export interface CapacitorBleTransportOptions {
  loadClient?: () => Promise<BleClientPort>
  now?: () => string
}

type OperationOutcome<T> =
  | { kind: 'fulfilled'; value: T }
  | { kind: 'rejected'; error: unknown }
  | { kind: 'cancelled' }
  | { kind: 'timeout' }

function runOperation<T>(
  operation: () => Promise<T>,
  options: DeviceOperationOptions,
): Promise<OperationOutcome<T>> {
  if (options.signal?.aborted) return Promise.resolve({ kind: 'cancelled' })

  return new Promise((resolve) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const finish = (outcome: OperationOutcome<T>) => {
      if (settled) return
      settled = true
      if (timeout !== undefined) clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abort)
      resolve(outcome)
    }
    const abort = () => finish({ kind: 'cancelled' })
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.timeoutMs !== undefined) {
      timeout = setTimeout(
        () => finish({ kind: 'timeout' }),
        Math.max(0, options.timeoutMs),
      )
    }
    operation().then(
      (value) => finish({ kind: 'fulfilled', value }),
      (error: unknown) => finish({ kind: 'rejected', error }),
    )
  })
}

const ok = <T>(value: T): DeviceResult<T> => ({ ok: true, value })

function failure<T>(
  code: DeviceOperationErrorCode,
  message: string,
  retryable: boolean,
): DeviceResult<T> {
  return { ok: false, error: { code, message, retryable } }
}

function matchesFilter(device: DiscoveredDevice, filter: DiscoveryFilter) {
  if (filter.name !== undefined && device.displayName !== filter.name) return false
  if (
    filter.namePrefix !== undefined &&
    !device.displayName?.startsWith(filter.namePrefix)
  ) {
    return false
  }
  if (
    filter.services !== undefined &&
    !filter.services.every((service) =>
      device.advertisedServiceIds?.includes(service),
    )
  ) {
    return false
  }
  return true
}

interface NotificationListenerEntry {
  listener: DeviceTransportFrameListener
  signal?: AbortSignal
  abort?: () => void
}

interface NotificationStream {
  key: string
  characteristic: DeviceCharacteristicRef
  active: boolean
  listeners: Map<number, NotificationListenerEntry>
  startPromise?: Promise<DeviceResult<void>>
  stopPromise?: Promise<DeviceResult<void>>
}

class CapacitorBleSession implements DeviceTransportSession {
  private state: DeviceTransportSessionState = 'connected'
  private closePromise?: Promise<DeviceResult<void>>
  private readonly frameSequencer = createDeviceTransportFrameSequencer()
  private readonly notifications = new Map<string, NotificationStream>()
  private subscriptionSequence = 0
  private disconnectCleanup?: Promise<DeviceResult<void>>

  constructor(
    readonly sessionId: string,
    readonly device: DiscoveredDevice,
    private readonly client: BleClientPort,
    readonly services: readonly BleService[],
    private readonly now: () => string,
    private readonly onClosed: () => void,
  ) {}

  getState() {
    return this.state
  }

  handleDisconnected(): Promise<DeviceResult<void>> {
    if (this.disconnectCleanup !== undefined) return this.disconnectCleanup
    this.state = 'disconnected'
    const streams = [...this.notifications.values()]
    this.disconnectCleanup = (async () => {
      let cleanupFailure: DeviceResult<void> | undefined
      for (const stream of streams) {
        const stopped = await this.stopNotificationStream(stream)
        if (!stopped.ok && cleanupFailure === undefined) cleanupFailure = stopped
      }
      this.onClosed()
      return cleanupFailure ?? ok(undefined)
    })()
    return this.disconnectCleanup
  }

  async read(
    characteristic: DeviceCharacteristicRef,
    options: DeviceOperationOptions = {},
  ): Promise<DeviceResult<DeviceTransportFrame>> {
    if (this.state !== 'connected') {
      return failure('disconnected', 'The Bluetooth device disconnected.', true)
    }
    const discovered = this.findCharacteristic(characteristic)
    if (discovered === undefined || !discovered.properties.read) {
      return failure(
        'read_failed',
        'The requested characteristic is not readable.',
        false,
      )
    }

    const read = await runOperation(
      () =>
        this.client.read(
          this.device.discoveryId,
          characteristic.serviceId,
          characteristic.characteristicId,
          { timeout: options.timeoutMs },
        ),
      options,
    )
    if (read.kind === 'cancelled' || read.kind === 'timeout') {
      return failure(
        read.kind === 'cancelled' ? 'operation_cancelled' : 'timeout',
        read.kind === 'cancelled'
          ? 'Characteristic read was cancelled.'
          : 'The Bluetooth operation timed out.',
        true,
      )
    }
    if (read.kind === 'rejected') {
      return {
        ok: false,
        error: normalizeBleError(read.error, {
          fallbackCode: 'read_failed',
          fallbackMessage: 'The characteristic read failed.',
        }),
      }
    }
    if (this.state !== 'connected') {
      return failure('disconnected', 'The Bluetooth device disconnected.', true)
    }

    const bytes = new Uint8Array(
      read.value.buffer,
      read.value.byteOffset,
      read.value.byteLength,
    )
    return ok(
      this.frameSequencer.create({
        payload: bytes,
        characteristic,
        source: 'read',
        receivedAt: this.now(),
      }),
    )
  }

  async write(request: DeviceWriteRequest): Promise<DeviceResult<void>> {
    if (this.state !== 'connected') {
      return failure('disconnected', 'The Bluetooth device disconnected.', true)
    }
    const discovered = this.findCharacteristic(request.characteristic)
    const canWrite =
      request.mode === 'with_response'
        ? discovered?.properties.write
        : discovered?.properties.writeWithoutResponse
    if (!canWrite) {
      return failure(
        'write_failed',
        'The requested characteristic does not support this write mode.',
        false,
      )
    }

    const bytes = new Uint8Array(request.payload)
    const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const write = await runOperation(
      () => {
        const args = [
          this.device.discoveryId,
          request.characteristic.serviceId,
          request.characteristic.characteristicId,
          value,
          { timeout: request.timeoutMs },
        ] as const
        return request.mode === 'with_response'
          ? this.client.write(...args)
          : this.client.writeWithoutResponse(...args)
      },
      request,
    )
    if (write.kind === 'cancelled' || write.kind === 'timeout') {
      return failure(
        write.kind === 'cancelled' ? 'operation_cancelled' : 'timeout',
        write.kind === 'cancelled'
          ? 'Characteristic write was cancelled.'
          : 'The Bluetooth operation timed out.',
        true,
      )
    }
    if (write.kind === 'rejected') {
      return {
        ok: false,
        error: normalizeBleError(write.error, {
          fallbackCode: 'write_failed',
          fallbackMessage: 'The characteristic write failed.',
        }),
      }
    }
    if (this.state !== 'connected') {
      return failure('disconnected', 'The Bluetooth device disconnected.', true)
    }
    return ok(undefined)
  }

  async subscribe(
    characteristic: DeviceCharacteristicRef,
    listener: DeviceTransportFrameListener,
    options: DeviceOperationOptions = {},
  ): Promise<DeviceResult<DeviceTransportNotificationSubscription>> {
    if (this.state !== 'connected') {
      return failure('disconnected', 'The Bluetooth device disconnected.', true)
    }
    if (options.signal?.aborted) {
      return failure(
        'operation_cancelled',
        'Notification subscription was cancelled.',
        true,
      )
    }
    const discovered = this.findCharacteristic(characteristic)
    if (
      discovered === undefined ||
      (!discovered.properties.notify && !discovered.properties.indicate)
    ) {
      return failure(
        'notification_failed',
        'The requested characteristic does not support notifications.',
        false,
      )
    }

    const key = this.characteristicKey(characteristic)
    const existing = this.notifications.get(key)
    if (existing !== undefined) {
      const subscription = this.addNotificationListener(
        existing,
        listener,
        options.signal,
      )
      const started = await this.ensureNotificationStarted(existing, options)
      if (started.ok) return ok(subscription)
      await subscription.unsubscribe()
      return started
    }

    const stream: NotificationStream = {
      key,
      characteristic: { ...characteristic },
      active: true,
      listeners: new Map(),
    }
    this.notifications.set(key, stream)
    const subscription = this.addNotificationListener(
      stream,
      listener,
      options.signal,
    )
    const started = await this.ensureNotificationStarted(stream, options)
    if (started.ok && this.state === 'connected') return ok(subscription)
    await subscription.unsubscribe()
    return started.ok
      ? failure('disconnected', 'The Bluetooth device disconnected.', true)
      : started
  }

  close(): Promise<DeviceResult<void>> {
    if (this.state === 'disconnected') {
      return this.disconnectCleanup ?? Promise.resolve(ok(undefined))
    }
    if (this.closePromise !== undefined) return this.closePromise
    this.state = 'disconnecting'
    this.closePromise = (async () => {
      let cleanupFailure: DeviceResult<void> | undefined
      for (const stream of [...this.notifications.values()]) {
        const stopped = await this.stopNotificationStream(stream)
        if (!stopped.ok && cleanupFailure === undefined) cleanupFailure = stopped
      }
      try {
        await this.client.disconnect(this.device.discoveryId)
        return cleanupFailure ?? ok(undefined)
      } catch (error) {
        const normalized = normalizeBleError(error, {
          fallbackCode: 'connection_failed',
          fallbackMessage: 'Bluetooth disconnect failed.',
        })
        if (normalized.code === 'disconnected') return ok(undefined)
        return { ok: false, error: normalized }
      } finally {
        this.state = 'disconnected'
        this.onClosed()
      }
    })()
    return this.closePromise
  }

  private findCharacteristic(characteristic: DeviceCharacteristicRef) {
    const service = this.services.find(
      (candidate) =>
        candidate.uuid.toLowerCase() === characteristic.serviceId.toLowerCase(),
    )
    return service?.characteristics.find(
      (candidate) =>
        candidate.uuid.toLowerCase() ===
        characteristic.characteristicId.toLowerCase(),
    )
  }

  private characteristicKey(characteristic: DeviceCharacteristicRef) {
    return `${characteristic.serviceId.toLowerCase()}\u0000${characteristic.characteristicId.toLowerCase()}`
  }

  private addNotificationListener(
    stream: NotificationStream,
    listener: DeviceTransportFrameListener,
    signal?: AbortSignal,
  ): DeviceTransportNotificationSubscription {
    const listenerId = ++this.subscriptionSequence
    let unsubscribePromise: Promise<DeviceResult<void>> | undefined
    const unsubscribe = () => {
      if (unsubscribePromise !== undefined) return unsubscribePromise
      const entry = stream.listeners.get(listenerId)
      if (entry === undefined) return Promise.resolve(ok(undefined))
      stream.listeners.delete(listenerId)
      entry.signal?.removeEventListener('abort', entry.abort!)
      unsubscribePromise =
        stream.listeners.size === 0
          ? this.stopNotificationStream(stream)
          : Promise.resolve(ok(undefined))
      return unsubscribePromise
    }
    const abort = () => void unsubscribe()
    stream.listeners.set(listenerId, { listener, signal, abort })
    signal?.addEventListener('abort', abort, { once: true })
    return {
      subscriptionId: `${this.sessionId}-notification-${listenerId}`,
      unsubscribe,
    }
  }

  private ensureNotificationStarted(
    stream: NotificationStream,
    options: DeviceOperationOptions,
  ): Promise<DeviceResult<void>> {
    if (stream.startPromise !== undefined) return stream.startPromise
    stream.startPromise = (async () => {
      const started = await runOperation(
        () =>
          this.client.startNotifications(
            this.device.discoveryId,
            stream.characteristic.serviceId,
            stream.characteristic.characteristicId,
            (value) => this.receiveNotification(stream, value),
            { timeout: options.timeoutMs },
          ),
        options,
      )
      if (started.kind === 'fulfilled' && this.state === 'connected') {
        return ok(undefined)
      }
      if (started.kind === 'cancelled' || started.kind === 'timeout') {
        return failure(
          started.kind === 'cancelled' ? 'operation_cancelled' : 'timeout',
          started.kind === 'cancelled'
            ? 'Notification subscription was cancelled.'
            : 'The Bluetooth operation timed out.',
          true,
        )
      }
      if (started.kind === 'rejected') {
        return {
          ok: false,
          error: normalizeBleError(started.error, {
            fallbackCode: 'notification_failed',
            fallbackMessage: 'Bluetooth notification setup failed.',
          }),
        }
      }
      return failure('disconnected', 'The Bluetooth device disconnected.', true)
    })()
    return stream.startPromise
  }

  private receiveNotification(stream: NotificationStream, value: DataView) {
    if (
      this.state !== 'connected' ||
      !stream.active ||
      this.notifications.get(stream.key) !== stream
    ) {
      return
    }
    const payload = new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    )
    const frame = this.frameSequencer.create({
      payload,
      characteristic: stream.characteristic,
      source: 'notification',
      receivedAt: this.now(),
    })
    for (const entry of [...stream.listeners.values()]) {
      try {
        entry.listener({
          ...frame,
          payload: new Uint8Array(frame.payload),
          characteristic: { ...frame.characteristic },
        })
      } catch {
        // One consumer cannot prevent delivery to the remaining subscriptions.
      }
    }
  }

  private stopNotificationStream(
    stream: NotificationStream,
  ): Promise<DeviceResult<void>> {
    if (stream.stopPromise !== undefined) return stream.stopPromise
    stream.active = false
    if (this.notifications.get(stream.key) === stream) {
      this.notifications.delete(stream.key)
    }
    for (const entry of stream.listeners.values()) {
      entry.signal?.removeEventListener('abort', entry.abort!)
    }
    stream.listeners.clear()
    stream.stopPromise = (async () => {
      try {
        if (stream.startPromise !== undefined) await stream.startPromise
        await this.client.stopNotifications(
          this.device.discoveryId,
          stream.characteristic.serviceId,
          stream.characteristic.characteristicId,
        )
        return ok(undefined)
      } catch (error) {
        const normalized = normalizeBleError(error, {
          fallbackCode: 'notification_failed',
          fallbackMessage: 'Bluetooth notification cleanup failed.',
        })
        return normalized.code === 'disconnected'
          ? ok(undefined)
          : { ok: false, error: normalized }
      }
    })()
    return stream.stopPromise
  }
}

class CapacitorBleTransport implements DeviceTransport {
  readonly transportId = 'capacitor-ble'
  readonly kind = 'bluetooth_low_energy' as const
  private state: DeviceTransportState = 'idle'
  private client?: BleClientPort
  private poweredOn = false
  private scanGeneration = 0
  private connectionGeneration = 0
  private activeDiscovery?: DeviceDiscoverySession
  private readonly sessions = new Set<CapacitorBleSession>()
  private connectQueue: Promise<void> = Promise.resolve()
  private readonly loadClient: () => Promise<BleClientPort>
  private readonly now: () => string

  constructor(options: CapacitorBleTransportOptions) {
    this.loadClient = options.loadClient ?? loadCapacitorBleClient
    this.now = options.now ?? (() => new Date().toISOString())
  }

  getState() {
    return this.state
  }

  async open(): Promise<DeviceResult<void>> {
    if (this.state === 'open') return ok(undefined)
    if (this.state === 'closing' || this.state === 'closed') {
      return failure('transport_unavailable', 'The transport is closed.', false)
    }

    this.state = 'opening'
    let client: BleClientPort
    try {
      client = await this.loadClient()
    } catch {
      this.state = 'failed'
      return failure(
        'unsupported_platform',
        'Bluetooth is unsupported on this platform.',
        false,
      )
    }

    try {
      await client.initialize()
      this.poweredOn = await client.isEnabled()
      if (!this.poweredOn) {
        this.state = 'failed'
        return failure('powered_off', 'Bluetooth is powered off.', true)
      }
      await client.startEnabledNotifications((enabled) => {
        this.poweredOn = enabled
        if (!enabled) {
          this.scanGeneration += 1
          void this.activeDiscovery?.stop()
          for (const session of [...this.sessions]) {
            void session.handleDisconnected()
          }
        }
      })
    } catch (error) {
      try {
        await client.stopEnabledNotifications()
      } catch {
        // Initialization failure remains the authoritative result.
      }
      this.state = 'failed'
      return {
        ok: false,
        error: normalizeBleError(error, {
          fallbackCode: 'transport_unavailable',
          fallbackMessage: 'Bluetooth transport initialization failed.',
          retryable: false,
        }),
      }
    }

    this.client = client
    this.state = 'open'
    return ok(undefined)
  }

  async startDiscovery(
    request: DiscoveryRequest,
    listener: (device: DiscoveredDevice) => void,
  ): Promise<DeviceResult<DeviceDiscoverySession>> {
    const client = this.client
    if (this.state !== 'open' || client === undefined) {
      return failure('transport_unavailable', 'The transport is not open.', false)
    }
    if (!this.poweredOn) {
      return failure('powered_off', 'Bluetooth is powered off.', true)
    }
    if (request.signal?.aborted) {
      return failure('operation_cancelled', 'Discovery was cancelled.', true)
    }
    if (this.activeDiscovery?.getState() === 'active') {
      return failure('discovery_failed', 'Discovery is already active.', true)
    }

    const generation = ++this.scanGeneration
    let state: 'active' | 'stopping' | 'stopped' = 'active'
    let timeout: ReturnType<typeof setTimeout> | undefined
    let stopPromise: Promise<DeviceResult<void>> | undefined
    const stop = (): Promise<DeviceResult<void>> => {
      if (state === 'stopped') return Promise.resolve(ok(undefined))
      if (stopPromise !== undefined) return stopPromise
      state = 'stopping'
      if (this.scanGeneration === generation) this.scanGeneration += 1
      if (timeout !== undefined) clearTimeout(timeout)
      request.signal?.removeEventListener('abort', abort)
      stopPromise = (async () => {
        try {
          await client.stopLEScan()
          return ok(undefined)
        } catch (error) {
          return {
            ok: false,
            error: normalizeBleError(error, {
              fallbackCode: 'discovery_failed',
              fallbackMessage: 'Bluetooth discovery cleanup failed.',
            }),
          }
        } finally {
          state = 'stopped'
          if (this.activeDiscovery === session) this.activeDiscovery = undefined
        }
      })()
      return stopPromise
    }
    const abort = () => void stop()
    const session: DeviceDiscoverySession = {
      discoverySessionId: `ble-discovery-${generation}`,
      getState: () => state,
      stop,
    }
    this.activeDiscovery = session
    request.signal?.addEventListener('abort', abort, { once: true })

    const pluginOptions: BleScanOptions = {
      allowDuplicates: request.allowDuplicates,
    }
    if (request.filters?.length === 1) {
      const [filter] = request.filters
      pluginOptions.services = filter.services ? [...filter.services] : undefined
      pluginOptions.name = filter.name
      pluginOptions.namePrefix = filter.namePrefix
    }

    const onScanResult = (result: BleScanResult) => {
      if (this.scanGeneration !== generation || state !== 'active') return
      const advertisedServiceIds = result.uuids ?? result.device.uuids
      const device: DiscoveredDevice = {
        discoveryId: result.device.deviceId,
        transportId: this.transportId,
        transportKind: this.kind,
        displayName: result.localName ?? result.device.name,
        advertisedServiceIds: advertisedServiceIds
          ? [...advertisedServiceIds]
          : undefined,
        connectable: true,
        signalStrength: result.rssi,
        discoveredAt: this.now(),
      }
      if (
        request.filters === undefined ||
        request.filters.length === 0 ||
        request.filters.some((filter) => matchesFilter(device, filter))
      ) {
        listener(device)
      }
    }

    try {
      await client.requestLEScan(pluginOptions, onScanResult)
    } catch (error) {
      await stop()
      return {
        ok: false,
        error: normalizeBleError(error, {
          fallbackCode: 'discovery_failed',
          fallbackMessage: 'Bluetooth discovery failed.',
        }),
      }
    }

    if (
      state !== 'active' ||
      this.scanGeneration !== generation ||
      request.signal?.aborted
    ) {
      await stop()
      return failure('operation_cancelled', 'Discovery was cancelled.', true)
    }

    if (request.timeoutMs !== undefined) {
      timeout = setTimeout(() => void stop(), request.timeoutMs)
    }
    return ok(session)
  }

  async connect(
    request: ConnectRequest,
  ): Promise<DeviceResult<DeviceTransportSession>> {
    const connect = () => this.connectNow(request)
    const result = this.connectQueue.then(connect, connect)
    this.connectQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private async connectNow(
    request: ConnectRequest,
  ): Promise<DeviceResult<DeviceTransportSession>> {
    const client = this.client
    if (this.state !== 'open' || client === undefined) {
      return failure('transport_unavailable', 'The transport is not open.', false)
    }
    if (!this.poweredOn) {
      return failure('powered_off', 'Bluetooth is powered off.', true)
    }
    if (request.signal?.aborted) {
      return failure('operation_cancelled', 'Connection was cancelled.', true)
    }
    if (
      request.device.transportId !== this.transportId ||
      request.device.transportKind !== this.kind
    ) {
      return failure('device_not_found', 'The discovered device is not available.', false)
    }
    if (this.activeDiscovery !== undefined) {
      const stopped = await this.activeDiscovery.stop()
      if (!stopped.ok) return stopped
    }

    const generation = ++this.connectionGeneration
    let disconnected = false
    let session: CapacitorBleSession | undefined
    let cleanupStarted = false
    const cleanup = async () => {
      if (cleanupStarted) return
      cleanupStarted = true
      try {
        await client.disconnect(request.device.discoveryId)
      } catch {
        // The connection may already be absent; no identifier is surfaced.
      }
    }
    const onDisconnect = () => {
      disconnected = true
      void session?.handleDisconnected()
    }
    const connection = await runOperation(
      () =>
        client.connect(request.device.discoveryId, onDisconnect, {
          timeout: request.timeoutMs,
        }),
      request,
    )

    if (connection.kind === 'cancelled' || connection.kind === 'timeout') {
      this.connectionGeneration += 1
      await cleanup()
      return failure(
        connection.kind === 'cancelled' ? 'operation_cancelled' : 'timeout',
        connection.kind === 'cancelled'
          ? 'Connection was cancelled.'
          : 'The Bluetooth operation timed out.',
        true,
      )
    }
    if (connection.kind === 'rejected') {
      return {
        ok: false,
        error: normalizeBleError(connection.error, {
          fallbackCode: 'connection_failed',
          fallbackMessage: 'Bluetooth connection failed.',
        }),
      }
    }
    if (
      disconnected ||
      this.connectionGeneration !== generation ||
      request.signal?.aborted
    ) {
      await cleanup()
      return failure(
        request.signal?.aborted ? 'operation_cancelled' : 'disconnected',
        request.signal?.aborted
          ? 'Connection was cancelled.'
          : 'The Bluetooth device disconnected.',
        true,
      )
    }

    const serviceDiscovery = await runOperation(
      () => client.getServices(request.device.discoveryId),
      request,
    )
    if (serviceDiscovery.kind !== 'fulfilled') {
      this.connectionGeneration += 1
      await cleanup()
      if (
        serviceDiscovery.kind === 'cancelled' ||
        serviceDiscovery.kind === 'timeout'
      ) {
        return failure(
          serviceDiscovery.kind === 'cancelled'
            ? 'operation_cancelled'
            : 'timeout',
          serviceDiscovery.kind === 'cancelled'
            ? 'Connection was cancelled.'
            : 'The Bluetooth operation timed out.',
          true,
        )
      }
      return {
        ok: false,
        error: normalizeBleError(serviceDiscovery.error, {
          fallbackCode: 'services_discovery_failed',
          fallbackMessage: 'Bluetooth service discovery failed.',
        }),
      }
    }

    if (
      this.state !== 'open' ||
      this.connectionGeneration !== generation ||
      request.signal?.aborted
    ) {
      this.connectionGeneration += 1
      await cleanup()
      return failure(
        request.signal?.aborted ? 'operation_cancelled' : 'disconnected',
        request.signal?.aborted
          ? 'Connection was cancelled.'
          : 'The Bluetooth device disconnected.',
        true,
      )
    }

    session = new CapacitorBleSession(
      `ble-session-${generation}`,
      request.device,
      client,
      serviceDiscovery.value,
      this.now,
      () => this.sessions.delete(session!),
    )
    this.sessions.add(session)
    return ok(session)
  }

  async close(): Promise<DeviceResult<void>> {
    if (this.state === 'closed') return ok(undefined)
    this.state = 'closing'
    this.connectionGeneration += 1
    let cleanupFailure: DeviceResult<void> | undefined
    const recordFailure = (result: DeviceResult<void> | undefined) => {
      if (result !== undefined && !result.ok && cleanupFailure === undefined) {
        cleanupFailure = result
      }
    }
    recordFailure(await this.activeDiscovery?.stop())
    await this.connectQueue
    for (const session of [...this.sessions]) await session.close()
    if (this.client !== undefined) {
      try {
        await this.client.stopEnabledNotifications()
      } catch (error) {
        recordFailure({
          ok: false,
          error: normalizeBleError(error, {
            fallbackCode: 'transport_unavailable',
            fallbackMessage: 'Bluetooth listener cleanup failed.',
          }),
        })
      }
    }
    this.client = undefined
    this.state = 'closed'
    return cleanupFailure ?? ok(undefined)
  }
}

export function createCapacitorBleTransport(
  options: CapacitorBleTransportOptions = {},
): DeviceTransport {
  return new CapacitorBleTransport(options)
}
