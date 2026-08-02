import { createDeviceTransportFrameSequencer } from '../contracts'
import type {
  ConnectRequest,
  DeviceCharacteristicRef,
  DeviceDiscoverySession,
  DeviceOperationOptions,
  DeviceResult,
  DeviceTransport,
  DeviceTransportFrame,
  DeviceTransportSession,
  DeviceTransportSessionState,
  DeviceTransportState,
  DeviceWriteRequest,
  DiscoveredDevice,
  DiscoveryRequest,
} from '../contracts'

const ok = <T>(value: T): DeviceResult<T> => ({ ok: true, value })

const failure = <T>(
  code:
    | 'device_not_found'
    | 'operation_cancelled'
    | 'timeout'
    | 'disconnected'
    | 'read_failed'
    | 'write_failed'
    | 'notification_failed',
  message: string,
  retryable: boolean,
): DeviceResult<T> => ({ ok: false, error: { code, message, retryable } })

function filterMatches(
  device: DiscoveredDevice,
  request: DiscoveryRequest,
): boolean {
  if (request.filters === undefined || request.filters.length === 0) return true
  return request.filters.some((filter) => {
    if (filter.name !== undefined && filter.name !== device.displayName) return false
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
  })
}

class SimulatorTransportSession implements DeviceTransportSession {
  private state: DeviceTransportSessionState = 'connected'
  private readonly sequencer = createDeviceTransportFrameSequencer()

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
    const blocked = this.check<DeviceTransportFrame>(options, 'read_failed')
    if (blocked !== undefined) return blocked
    return ok(
      this.sequencer.create({
        payload: new Uint8Array(),
        characteristic,
        source: 'read',
        receivedAt: this.device.discoveredAt,
      }),
    )
  }

  async write(request: DeviceWriteRequest): Promise<DeviceResult<void>> {
    const blocked = this.check<void>(request, 'write_failed')
    if (blocked !== undefined) return blocked
    return ok(undefined)
  }

  async subscribe(
    _characteristic: DeviceCharacteristicRef,
    _listener: (frame: DeviceTransportFrame) => void,
    options: DeviceOperationOptions = {},
  ): Promise<
    DeviceResult<import('../contracts').DeviceTransportNotificationSubscription>
  > {
    const blocked = this.check<import('../contracts').DeviceTransportNotificationSubscription>(
      options,
      'notification_failed',
    )
    if (blocked !== undefined) return blocked
    let stopped = false
    return ok({
      subscriptionId: `${this.sessionId}-simulated-notification`,
      unsubscribe: async () => {
        stopped = true
        void stopped
        return ok(undefined)
      },
    })
  }

  async close(): Promise<DeviceResult<void>> {
    if (this.state === 'disconnected') return ok(undefined)
    this.state = 'disconnecting'
    this.state = 'disconnected'
    this.onClosed()
    return ok(undefined)
  }

  private check<T>(
    options: DeviceOperationOptions,
    fallbackCode: 'read_failed' | 'write_failed' | 'notification_failed',
  ): DeviceResult<T> | undefined {
    if (this.state !== 'connected') {
      return failure('disconnected', 'The simulator transport is disconnected.', true)
    }
    if (options.signal?.aborted) {
      return failure('operation_cancelled', 'The simulator operation was cancelled.', true)
    }
    if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
      return failure('timeout', 'The simulator operation timed out.', true)
    }
    void fallbackCode
    return undefined
  }
}

export function createSimulatorTransport(
  device: DiscoveredDevice,
): DeviceTransport {
  let state: DeviceTransportState = 'idle'
  let discovery: DeviceDiscoverySession | undefined
  let sessionSequence = 0
  const sessions = new Set<SimulatorTransportSession>()

  return {
    transportId: device.transportId,
    kind: 'simulated',
    getState: () => state,
    open: async () => {
      if (state === 'closed') {
        return failure('disconnected', 'The simulator transport is closed.', false)
      }
      state = 'open'
      return ok(undefined)
    },
    startDiscovery: async (request, listener) => {
      if (state !== 'open') {
        return failure('disconnected', 'The simulator transport is not open.', true)
      }
      if (request.signal?.aborted) {
        return failure('operation_cancelled', 'Discovery was cancelled.', true)
      }
      if (discovery?.getState() === 'active') {
        return failure('operation_cancelled', 'Discovery is already active.', true)
      }
      let sessionState: 'active' | 'stopping' | 'stopped' = 'active'
      let timeout: ReturnType<typeof setTimeout> | undefined
      const stop = async () => {
        if (sessionState === 'stopped') return ok(undefined)
        sessionState = 'stopping'
        if (timeout !== undefined) clearTimeout(timeout)
        request.signal?.removeEventListener('abort', abort)
        sessionState = 'stopped'
        if (discovery?.getState() === 'stopped') discovery = undefined
        return ok(undefined)
      }
      const abort = () => void stop()
      const created: DeviceDiscoverySession = {
        discoverySessionId: `${device.transportId}-discovery-1`,
        getState: () => sessionState,
        stop,
      }
      discovery = created
      request.signal?.addEventListener('abort', abort, { once: true })
      if (request.timeoutMs !== undefined) {
        timeout = setTimeout(() => void stop(), request.timeoutMs)
      }
      if (filterMatches(device, request)) listener(copyDevice(device))
      return ok(created)
    },
    connect: async (request: ConnectRequest) => {
      if (state !== 'open') {
        return failure('disconnected', 'The simulator transport is not open.', true)
      }
      if (request.signal?.aborted) {
        return failure('operation_cancelled', 'The simulator connection was cancelled.', true)
      }
      if (request.timeoutMs !== undefined && request.timeoutMs <= 0) {
        return failure('timeout', 'The simulator connection timed out.', true)
      }
      if (
        request.device.discoveryId !== device.discoveryId ||
        request.device.transportId !== device.transportId
      ) {
        return failure('device_not_found', 'The simulator device is unavailable.', false)
      }
      await discovery?.stop()
      let session: SimulatorTransportSession
      session = new SimulatorTransportSession(
        `${device.transportId}-session-${++sessionSequence}`,
        copyDevice(device),
        () => sessions.delete(session),
      )
      sessions.add(session)
      return ok(session)
    },
    close: async () => {
      if (state === 'closed') return ok(undefined)
      await discovery?.stop()
      for (const session of [...sessions]) await session.close()
      state = 'closed'
      return ok(undefined)
    },
  }
}

function copyDevice(device: DiscoveredDevice): DiscoveredDevice {
  return {
    ...device,
    ...(device.advertisedServiceIds === undefined
      ? {}
      : { advertisedServiceIds: [...device.advertisedServiceIds] }),
  }
}
