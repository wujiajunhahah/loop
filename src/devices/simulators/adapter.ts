import {
  capabilityUnavailable,
  commandCapability,
  type DeviceAdapter,
  type DeviceCapabilityReport,
  type DeviceResult,
  type DeviceSession,
  type DeviceSessionState,
  type DeviceSubscription,
  type DeviceTransportSession,
  type NormalizedDevice,
  type NormalizedDeviceEventBase,
} from '../contracts'
import type { SimulatorSessionInfo } from './types'

const ok = <T>(value: T): DeviceResult<T> => ({ ok: true, value })

function failure<T>(
  code: 'disconnected' | 'protocol_error' | 'session_closed',
  message: string,
  retryable: boolean,
): DeviceResult<T> {
  return { ok: false, error: { code, message, retryable } }
}

export interface SimulatorAdapterController<
  Event extends NormalizedDeviceEventBase,
  Input,
> {
  adapter: DeviceAdapter<Event>
  emit(input: Input): Event | undefined
  reset(): void
  getSequence(): number
}

export function createSimulatorAdapter<
  Event extends NormalizedDeviceEventBase,
  Input,
>(options: {
  adapterId: string
  device: import('../contracts').DiscoveredDevice
  normalizedDevice: NormalizedDevice
  capabilities: DeviceCapabilityReport
  fallbackSession: SimulatorSessionInfo
  createEvent(
    input: Input,
    context: SimulatorSessionInfo,
    sequence: number,
    occurredAt: string,
  ): Event
  now(): string
}): SimulatorAdapterController<Event, Input> {
  const activeTransportSessions = new WeakSet<DeviceTransportSession>()
  const sessions = new Map<
    string,
    {
      session: DeviceSession<Event>
      listeners: Set<(event: Event) => void>
    }
  >()
  let sessionSequence = 0
  let eventSequence = 0

  const adapter: DeviceAdapter<Event> = {
    adapterId: options.adapterId,
    matches(device) {
      return (
        device.transportKind === 'simulated' &&
        device.transportId === options.device.transportId &&
        device.discoveryId === options.device.discoveryId &&
        device.connectable
      )
    },
    async openSession(transportSession) {
      if (transportSession.getState() !== 'connected') {
        return failure('disconnected', 'The simulator transport is not connected.', true)
      }
      if (activeTransportSessions.has(transportSession)) {
        return failure('protocol_error', 'The simulator session is already open.', false)
      }
      activeTransportSessions.add(transportSession)
      const sessionId = `${options.adapterId}-session-${++sessionSequence}`
      let state: DeviceSessionState = 'open'
      const listeners = new Set<(event: Event) => void>()
      let closePromise: Promise<DeviceResult<void>> | undefined
      const session: DeviceSession<Event> = {
        sessionId,
        device: { ...options.normalizedDevice },
        capabilities: { ...options.capabilities },
        getState: () => state,
        subscribe(listener): DeviceResult<DeviceSubscription> {
          if (state !== 'open') {
            return failure('session_closed', 'The simulator session is closed.', false)
          }
          listeners.add(listener)
          let unsubscribed = false
          return ok({
            subscriptionId: `${sessionId}-listener-${listeners.size}`,
            unsubscribe() {
              if (unsubscribed) return
              unsubscribed = true
              listeners.delete(listener)
            },
          })
        },
        async execute(command) {
          if (state !== 'open') {
            return failure('session_closed', 'The simulator session is closed.', false)
          }
          return capabilityUnavailable(commandCapability(command), {
            status: 'requires_vendor_profile',
            reason: 'Simulators do not encode hardware commands.',
          })
        },
        close() {
          if (closePromise !== undefined) return closePromise
          state = 'closing'
          closePromise = (async () => {
            const closed = await transportSession.close()
            listeners.clear()
            sessions.delete(sessionId)
            activeTransportSessions.delete(transportSession)
            state = closed.ok ? 'closed' : 'failed'
            return closed
          })()
          return closePromise
        },
      }
      sessions.set(sessionId, { session, listeners })
      return ok(session)
    },
  }

  return {
    adapter,
    emit(input) {
      eventSequence += 1
      let first: Event | undefined
      if (sessions.size === 0) {
        return options.createEvent(
          input,
          options.fallbackSession,
          eventSequence,
          options.now(),
        )
      }
      for (const { session, listeners } of sessions.values()) {
        const event = options.createEvent(
          input,
          { sessionId: session.sessionId, deviceId: session.device.deviceId },
          eventSequence,
          options.now(),
        )
        first ??= event
        for (const listener of [...listeners]) {
          try {
            listener(event)
          } catch {
            // One simulated consumer cannot block another consumer.
          }
        }
      }
      return first
    },
    reset() {
      // An active session keeps its event identity monotonic; a fresh replay
      // starts from zero once all consumers have disconnected.
      if (sessions.size === 0) eventSequence = 0
    },
    getSequence: () => eventSequence,
  }
}
