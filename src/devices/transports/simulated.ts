import type {
  ConnectRequest,
  DeviceCharacteristicRef,
  DeviceDiscoverySession,
  DeviceOperationOptions,
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

const simulatedDevice: DiscoveredDevice = {
  discoveryId: 'simulated-device-1',
  transportId: 'simulated-web',
  transportKind: 'simulated',
  displayName: 'Simulated wearable',
  advertisedServiceIds: ['simulated-service'],
  connectable: true,
  signalStrength: -42,
  discoveredAt: '2026-01-01T00:00:00.000Z',
}

const ok = <T>(value: T): DeviceResult<T> => ({ ok: true, value })

const unavailable = <T>(message: string): DeviceResult<T> => ({
  ok: false,
  error: {
    code: 'transport_unavailable',
    message,
    retryable: false,
  },
})

const operationFailure = <T>(
  code:
    | 'operation_cancelled'
    | 'timeout'
    | 'disconnected'
    | 'read_failed'
    | 'write_failed'
    | 'notification_failed',
  message: string,
  retryable: boolean,
): DeviceResult<T> => ({
  ok: false,
  error: { code, message, retryable },
})

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

const simulatedCharacteristic: DeviceCharacteristicRef = {
  serviceId: 'simulated-service',
  characteristicId: 'simulated-value',
}

class SimulatedDeviceTransportSession implements DeviceTransportSession {
  private state: DeviceTransportSessionState = 'connected'
  private value = new Uint8Array([0])
  private readonly frameSequencer = createDeviceTransportFrameSequencer()
  private readonly listeners = new Map<
    number,
    {
      listener: DeviceTransportFrameListener
      signal?: AbortSignal
      abort?: () => void
    }
  >()
  private listenerSequence = 0

  constructor(
    readonly sessionId: string,
    readonly device: DiscoveredDevice,
    private readonly onClosed: () => void,
  ) {}

  getState() {
    return this.state
  }

  async read(
    characteristic: DeviceCharacteristicRef,
    options: DeviceOperationOptions = {},
  ): Promise<DeviceResult<DeviceTransportFrame>> {
    const blocked = this.checkOperation<DeviceTransportFrame>(
      characteristic,
      options,
      'read_failed',
    )
    if (blocked !== undefined) return blocked
    return ok(
      this.frameSequencer.create({
        payload: this.value,
        characteristic,
        source: 'read',
        receivedAt: simulatedDevice.discoveredAt,
      }),
    )
  }

  async write(request: DeviceWriteRequest): Promise<DeviceResult<void>> {
    const blocked = this.checkOperation<void>(
      request.characteristic,
      request,
      'write_failed',
    )
    if (blocked !== undefined) return blocked
    this.value = new Uint8Array(request.payload)
    if (this.listeners.size > 0) {
      const frame = this.frameSequencer.create({
        payload: this.value,
        characteristic: request.characteristic,
        source: 'notification',
        receivedAt: simulatedDevice.discoveredAt,
      })
      for (const entry of [...this.listeners.values()]) {
        try {
          entry.listener({
            ...frame,
            payload: new Uint8Array(frame.payload),
            characteristic: { ...frame.characteristic },
          })
        } catch {
          // A simulated consumer cannot block the remaining listeners.
        }
      }
    }
    return ok(undefined)
  }

  async subscribe(
    characteristic: DeviceCharacteristicRef,
    listener: DeviceTransportFrameListener,
    options: DeviceOperationOptions = {},
  ): Promise<DeviceResult<DeviceTransportNotificationSubscription>> {
    const blocked = this.checkOperation<DeviceTransportNotificationSubscription>(
      characteristic,
      options,
      'notification_failed',
    )
    if (blocked !== undefined) return blocked

    const listenerId = ++this.listenerSequence
    let unsubscribed = false
    const unsubscribe = async () => {
      if (unsubscribed) return ok(undefined)
      unsubscribed = true
      const entry = this.listeners.get(listenerId)
      entry?.signal?.removeEventListener('abort', entry.abort!)
      this.listeners.delete(listenerId)
      return ok(undefined)
    }
    const abort = () => void unsubscribe()
    this.listeners.set(listenerId, { listener, signal: options.signal, abort })
    options.signal?.addEventListener('abort', abort, { once: true })
    return ok({
      subscriptionId: `${this.sessionId}-notification-${listenerId}`,
      unsubscribe,
    })
  }

  async close(): Promise<DeviceResult<void>> {
    if (this.state === 'disconnected') return ok(undefined)
    this.state = 'disconnecting'
    for (const entry of this.listeners.values()) {
      entry.signal?.removeEventListener('abort', entry.abort!)
    }
    this.listeners.clear()
    this.state = 'disconnected'
    this.onClosed()
    return ok(undefined)
  }

  private checkOperation<T>(
    characteristic: DeviceCharacteristicRef,
    options: DeviceOperationOptions,
    fallbackCode: 'read_failed' | 'write_failed' | 'notification_failed',
  ): DeviceResult<T> | undefined {
    if (this.state !== 'connected') {
      return operationFailure(
        'disconnected',
        'The simulated device is disconnected.',
        true,
      )
    }
    if (options.signal?.aborted) {
      return operationFailure(
        'operation_cancelled',
        'The simulated operation was cancelled.',
        true,
      )
    }
    if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
      return operationFailure(
        'timeout',
        'The simulated operation timed out.',
        true,
      )
    }
    if (
      characteristic.serviceId !== simulatedCharacteristic.serviceId ||
      characteristic.characteristicId !==
        simulatedCharacteristic.characteristicId
    ) {
      return operationFailure(
        fallbackCode,
        'The simulated characteristic is unavailable.',
        false,
      )
    }
    return undefined
  }
}

class SimulatedDeviceTransport implements DeviceTransport {
  readonly transportId = 'simulated-web'
  readonly kind = 'simulated' as const
  private state: DeviceTransportState = 'idle'
  private activeDiscovery?: DeviceDiscoverySession
  private readonly sessions = new Set<SimulatedDeviceTransportSession>()
  private sessionSequence = 0
  private connectQueue: Promise<void> = Promise.resolve()

  getState() {
    return this.state
  }

  async open(): Promise<DeviceResult<void>> {
    if (this.state === 'closed') {
      return unavailable('The simulated transport is closed.')
    }
    this.state = 'open'
    return ok(undefined)
  }

  async startDiscovery(
    request: DiscoveryRequest,
    listener: (device: DiscoveredDevice) => void,
  ): Promise<DeviceResult<DeviceDiscoverySession>> {
    if (this.state !== 'open') {
      return unavailable('The simulated transport is not open.')
    }
    if (request.signal?.aborted) {
      return {
        ok: false,
        error: {
          code: 'operation_cancelled',
          message: 'Discovery was cancelled.',
          retryable: true,
        },
      }
    }
    if (this.activeDiscovery?.getState() === 'active') {
      return {
        ok: false,
        error: {
          code: 'discovery_failed',
          message: 'Discovery is already active.',
          retryable: true,
        },
      }
    }

    let state: 'active' | 'stopping' | 'stopped' = 'active'
    let timeout: ReturnType<typeof setTimeout> | undefined
    const stop = async () => {
      if (state === 'stopped') return ok(undefined)
      state = 'stopping'
      if (timeout !== undefined) clearTimeout(timeout)
      request.signal?.removeEventListener('abort', abort)
      state = 'stopped'
      return ok(undefined)
    }
    const abort = () => void stop()
    const session: DeviceDiscoverySession = {
      discoverySessionId: 'simulated-discovery-1',
      getState: () => state,
      stop,
    }
    this.activeDiscovery = session
    request.signal?.addEventListener('abort', abort, { once: true })
    if (request.timeoutMs !== undefined) {
      timeout = setTimeout(() => void stop(), request.timeoutMs)
    }

    if (
      request.filters === undefined ||
      request.filters.length === 0 ||
      request.filters.some((filter) => matchesFilter(simulatedDevice, filter))
    ) {
      listener({
        ...simulatedDevice,
        advertisedServiceIds: [...(simulatedDevice.advertisedServiceIds ?? [])],
      })
    }
    return ok(session)
  }

  async connect(
    request: ConnectRequest,
  ): Promise<DeviceResult<DeviceTransportSession>> {
    const connect = async (): Promise<DeviceResult<DeviceTransportSession>> => {
      if (this.state !== 'open') {
        return unavailable('The simulated transport is not open.')
      }
      if (request.signal?.aborted) {
        return operationFailure(
          'operation_cancelled',
          'The simulated connection was cancelled.',
          true,
        )
      }
      if (request.timeoutMs !== undefined && request.timeoutMs <= 0) {
        return operationFailure(
          'timeout',
          'The simulated connection timed out.',
          true,
        )
      }
      if (
        request.device.transportId !== this.transportId ||
        request.device.transportKind !== this.kind ||
        request.device.discoveryId !== simulatedDevice.discoveryId
      ) {
        return {
          ok: false,
          error: {
            code: 'device_not_found',
            message: 'The simulated device is unavailable.',
            retryable: false,
          },
        }
      }
      await this.activeDiscovery?.stop()
      const sessionNumber = ++this.sessionSequence
      let session: SimulatedDeviceTransportSession
      session = new SimulatedDeviceTransportSession(
        `simulated-session-${sessionNumber}`,
        { ...request.device },
        () => this.sessions.delete(session),
      )
      this.sessions.add(session)
      return ok(session)
    }
    const result = this.connectQueue.then(connect, connect)
    this.connectQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async close(): Promise<DeviceResult<void>> {
    if (this.state === 'closed') return ok(undefined)
    this.state = 'closing'
    await this.activeDiscovery?.stop()
    for (const session of [...this.sessions]) await session.close()
    this.state = 'closed'
    return ok(undefined)
  }
}

export function createSimulatedDeviceTransport(): DeviceTransport {
  return new SimulatedDeviceTransport()
}
