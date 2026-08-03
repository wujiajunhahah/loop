import { describe, expect, it, vi } from 'vitest'
import type {
  DeviceAdapter,
  DeviceCapabilityReport,
  DeviceDiscoverySession,
  DeviceResult,
  DeviceSession,
  DeviceSubscription,
  DeviceTransport,
  DeviceTransportFrame,
  DeviceTransportNotificationSubscription,
  DeviceTransportSession,
  DeviceTransportSessionState,
  DeviceTransportState,
  DiscoveredDevice,
  NormalizedDeviceEvent,
  NormalizedDeviceEventBase,
} from '../contracts'
import { createDeviceRuntime, type RuntimeClock } from './index'

const ok = <T>(value: T): DeviceResult<T> => ({ ok: true, value })

const capabilities: DeviceCapabilityReport = {
  interaction_events: { status: 'implemented' },
  telemetry: { status: 'implemented' },
  haptic_feedback: { status: 'requires_vendor_profile', reason: 'fixture' },
  light_feedback: { status: 'requires_vendor_profile', reason: 'fixture' },
  status_reporting: { status: 'implemented' },
  audio_capture: { status: 'requires_real_device', reason: 'fixture' },
}

const baseEvent = (
  sessionId: string,
  deviceId: string,
  sequence: number,
  occurredAt: string,
): NormalizedDeviceEvent => ({
  eventId: `${sessionId}-event-${sequence}`,
  deviceId,
  sessionId,
  occurredAt,
  source: 'physical',
  kind: 'status',
  status: 'connected',
})

class Deferred<T> {
  promise: Promise<T>
  resolve!: (value: T) => void
  reject!: (reason?: unknown) => void

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}

function createTransportSession(
  device: DiscoveredDevice,
  sessionId: string,
): DeviceTransportSession {
  let state: DeviceTransportSessionState = 'connected'
  return {
    sessionId,
    device,
    getState: () => state,
    read: async (characteristic): Promise<DeviceResult<DeviceTransportFrame>> =>
      ok({
        payload: new Uint8Array(),
        sequence: 1,
        characteristic,
        source: 'read',
        receivedAt: device.discoveredAt,
      }),
    write: async () => ok(undefined),
    subscribe: async (
      _characteristic,
      _listener,
    ): Promise<DeviceResult<DeviceTransportNotificationSubscription>> =>
      ok({
        subscriptionId: `${sessionId}-subscription`,
        unsubscribe: async () => ok(undefined),
      }),
    close: async () => {
      state = 'disconnected'
      return ok(undefined)
    },
  }
}

function createAdapter(
  adapterId: string,
  deferredConnect?: Deferred<DeviceResult<DeviceTransportSession>>,
  eventsByDevice = new Map<string, NormalizedDeviceEventBase[]>(),
  unsubscribeError?: unknown,
): DeviceAdapter<NormalizedDeviceEventBase> {
  let sequence = 0
  return {
    adapterId,
    matches: (device) => device.displayName?.startsWith(adapterId) ?? false,
    openSession: async (transportSession) => {
      const normalizedDevice = {
        deviceId: `${adapterId}-device`,
        displayName: transportSession.device.displayName,
        category: adapterId === 'ring' ? ('ring' as const) : ('wearable' as const),
        adapterId,
      }
      const sessionId = `${adapterId}-session-${++sequence}`
      const events = eventsByDevice.get(transportSession.device.discoveryId) ?? []
      let state: DeviceSession['getState'] extends () => infer S ? S : never = 'open'
      const listeners = new Set<(event: NormalizedDeviceEventBase) => void>()
      const session: DeviceSession<NormalizedDeviceEventBase> = {
        sessionId,
        device: normalizedDevice,
        capabilities,
        getState: () => state,
        subscribe: (listener) => {
          listeners.add(listener)
          for (const event of events) listener(event)
          return ok({
            subscriptionId: `${sessionId}-listener`,
            unsubscribe: () => {
              const cleanupError =
                typeof unsubscribeError === 'function'
                  ? (unsubscribeError as () => unknown)()
                  : unsubscribeError
              if (cleanupError !== undefined) throw cleanupError
              listeners.delete(listener)
            },
          })
        },
        execute: async (command) =>
          ok({
            commandId: command.commandId,
            sessionId,
            status: 'completed',
            acknowledgedAt: command.issuedAt,
          }),
        close: async () => {
          state = 'closed'
          return transportSession.close()
        },
      }
      return ok(session)
    },
  }
}

function createTransport(
  devices: readonly DiscoveredDevice[],
  connectResults: readonly (
    | DeviceResult<DeviceTransportSession>
    | Promise<DeviceResult<DeviceTransportSession>>
  )[],
): DeviceTransport {
  let state: DeviceTransportState = 'idle'
  let connectIndex = 0
  let discoveryState: 'active' | 'stopped' = 'stopped'
  return {
    transportId: 'fixture-transport',
    kind: 'bluetooth_low_energy',
    getState: () => state,
    open: async () => {
      state = 'open'
      return ok(undefined)
    },
    startDiscovery: async (request, listener) => {
      discoveryState = 'active'
      if (request.signal?.aborted) {
        discoveryState = 'stopped'
        return {
          ok: false,
          error: {
            code: 'operation_cancelled',
            message: 'Discovery was cancelled.',
            retryable: true,
          },
        }
      }
      for (const device of devices) listener(device)
      const stop = async () => {
        discoveryState = 'stopped'
        return ok(undefined)
      }
      return ok({
        discoverySessionId: 'fixture-discovery',
        getState: () => discoveryState,
        stop,
      })
    },
    connect: async () =>
      (connectResults[connectIndex++] ?? connectResults.at(-1)!),
    close: async () => {
      state = 'closed'
      return ok(undefined)
    },
  }
}

function createClock(): RuntimeClock & { advance(ms: number): void } {
  let current = Date.parse('2026-08-03T00:00:00.000Z')
  return {
    now: () => new Date(current).toISOString(),
    advance: (ms) => {
      current += ms
    },
  }
}

describe('device runtime', () => {
  it('connects OMI and ring sessions independently and publishes bounded normalized state', async () => {
    const clock = createClock()
    const omiDevice: DiscoveredDevice = {
      discoveryId: 'omi-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'omi audio',
      connectable: true,
      discoveredAt: clock.now(),
    }
    const ringDevice = { ...omiDevice, discoveryId: 'ring-discovery', displayName: 'ring' }
    const omiTransportSession = createTransportSession(omiDevice, 'omi-transport')
    const ringTransportSession = createTransportSession(ringDevice, 'ring-transport')
    const events = new Map([
      [omiDevice.discoveryId, [baseEvent('ignored', 'ignored', 1, clock.now())]],
      [ringDevice.discoveryId, [baseEvent('ignored', 'ignored', 2, clock.now())]],
    ])
    const transport = createTransport(
      [omiDevice, ringDevice],
      [ok(omiTransportSession), ok(ringTransportSession)],
    )
    const runtime = createDeviceRuntime({
      transports: [transport],
      adapters: [createAdapter('omi', undefined, events), createAdapter('ring', undefined, events)],
      clock,
      historyLimit: 1,
    })

    await runtime.ready()
    await runtime.scan()
    const [omi, ring] = await Promise.all([
      runtime.connect(omiDevice.discoveryId, { consent: { audioCapture: true } }),
      runtime.connect(ringDevice.discoveryId),
    ])

    expect(omi.ok).toBe(true)
    expect(ring.ok).toBe(true)
    const snapshot = runtime.getSnapshot()
    expect(snapshot.sessions).toHaveLength(2)
    expect(snapshot.sessions.map((session) => session.adapterId)).toEqual(
      expect.arrayContaining(['omi', 'ring']),
    )
    expect(snapshot.sessions.every((session) => session.history.length <= 1)).toBe(true)
    await runtime.scan()
    expect(runtime.getSnapshot().phase).toBe('connected')
    await runtime.disconnect(omiDevice.discoveryId)
    expect(runtime.getSnapshot().sessions).toHaveLength(1)
    expect(runtime.getSnapshot().phase).toBe('connected')
  })

  it('does not let stale scan or connection results overwrite newer generations', async () => {
    const clock = createClock()
    const device: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: clock.now(),
    }
    const firstConnect = new Deferred<DeviceResult<DeviceTransportSession>>()
    const secondConnect = new Deferred<DeviceResult<DeviceTransportSession>>()
    const transport = createTransport(
      [device],
      [firstConnect.promise, secondConnect.promise],
    )
    const runtime = createDeviceRuntime({
      transports: [transport],
      adapters: [createAdapter('ring')],
      clock,
    })

    const oldScan = runtime.scan()
    const newScan = runtime.scan()
    const [oldScanResult, newScanResult] = await Promise.all([oldScan, newScan])
    expect(newScanResult).toMatchObject({ ok: true })
    expect(oldScanResult.ok || oldScanResult.error.code === 'operation_cancelled').toBe(true)

    const oldConnect = runtime.connect(device.discoveryId)
    await Promise.resolve()
    await Promise.resolve()
    const newConnect = runtime.connect(device.discoveryId)
    secondConnect.resolve(ok(createTransportSession(device, 'new-transport')))
    await expect(newConnect).resolves.toMatchObject({ ok: true })
    firstConnect.resolve(ok(createTransportSession(device, 'old-transport')))
    await expect(oldConnect).resolves.toMatchObject({ ok: false, error: { code: 'operation_cancelled' } })
    expect(runtime.getSnapshot().sessions[0]?.sessionId).toContain('ring-session')
  })

  it('stops a late discovery session without publishing its stale device', async () => {
    const staleDiscovery = new Deferred<DeviceResult<DeviceDiscoverySession>>()
    const discoveredAt = '2026-08-03T00:00:00.000Z'
    const staleDevice: DiscoveredDevice = {
      discoveryId: 'stale-ring',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring stale',
      connectable: true,
      discoveredAt,
    }
    const freshDevice = { ...staleDevice, discoveryId: 'fresh-ring', displayName: 'ring fresh' }
    let starts = 0
    let staleStops = 0
    let state: DeviceTransportState = 'idle'
    const discoverySession = (
      id: string,
      onStop: () => void = () => undefined,
    ): DeviceDiscoverySession => {
      let discoveryState: 'active' | 'stopped' = 'active'
      return {
        discoverySessionId: id,
        getState: () => discoveryState,
        stop: async () => {
          if (discoveryState === 'active') onStop()
          discoveryState = 'stopped'
          return ok(undefined)
        },
      }
    }
    const transport: DeviceTransport = {
      transportId: 'fixture-transport',
      kind: 'bluetooth_low_energy',
      getState: () => state,
      open: async () => {
        state = 'open'
        return ok(undefined)
      },
      startDiscovery: async (_request, listener) => {
        starts += 1
        if (starts === 1) {
          const result = await staleDiscovery.promise
          listener(staleDevice)
          return result
        }
        listener(freshDevice)
        return ok(discoverySession('fresh-discovery'))
      },
      connect: async () => ({
        ok: false,
        error: { code: 'connection_failed', message: 'unused', retryable: false },
      }),
      close: async () => {
        state = 'closed'
        return ok(undefined)
      },
    }
    const runtime = createDeviceRuntime({ transports: [transport], adapters: [createAdapter('ring')] })

    const staleScan = runtime.scan()
    await Promise.resolve()
    await Promise.resolve()
    const freshScan = runtime.scan()
    await expect(freshScan).resolves.toMatchObject({ ok: true })
    staleDiscovery.resolve(ok(discoverySession('stale-discovery', () => staleStops += 1)))
    await expect(staleScan).resolves.toMatchObject({
      ok: false,
      error: { code: 'operation_cancelled' },
    })

    expect(staleStops).toBe(1)
    expect(runtime.getSnapshot().devices.map((device) => device.discovered.discoveryId)).toEqual([
      freshDevice.discoveryId,
    ])
  })

  it('restores only safe preferences and blocks OMI audio without consent', async () => {
    const saved: unknown[] = []
    const device: DiscoveredDevice = {
      discoveryId: 'omi-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'omi-audio',
      connectable: true,
      discoveredAt: '2026-08-03T00:00:00.000Z',
    }
    const session = createTransportSession(device, 'omi-transport')
    const runtime = createDeviceRuntime({
      transports: [createTransport([device], [ok(session)])],
      adapters: [createAdapter('omi-audio')],
      persistence: {
        load: async () => ({
          version: 1,
          selectedDeviceIds: [device.discoveryId],
          profiles: { omi: 'fixture-profile' },
          preferences: { theme: 'quiet' },
          consent: { audioCapture: false },
          activeClaims: ['must-not-restore'],
          rawAudio: 'must-not-persist',
        } as never),
        save: async (value) => {
          saved.push(value)
        },
      },
    })

    await runtime.ready()
    expect(runtime.getSnapshot().selectedDeviceIds).toEqual([device.discoveryId])
    expect(runtime.getSnapshot().sessions).toEqual([])
    await runtime.scan()
    await expect(runtime.connect(device.discoveryId)).resolves.toMatchObject({
      ok: false,
      error: { code: 'permission_denied' },
    })
    await expect(
      runtime.connect(device.discoveryId, { consent: { audioCapture: true } }),
    ).resolves.toMatchObject({ ok: true })
    expect(runtime.getSnapshot().sessions).toHaveLength(1)
    await runtime.setConsent({ audioCapture: false })
    expect(runtime.getSnapshot().sessions).toEqual([])
    expect(session.getState()).toBe('disconnected')
    expect(saved.at(-1)).not.toHaveProperty('activeClaims')
    expect(saved.at(-1)).not.toHaveProperty('rawAudio')
  })

  it('serializes preference updates after asynchronous persistence restore', async () => {
    const restored = new Deferred<{
      version: 1
      selectedDeviceIds: string[]
      profiles: Record<string, string>
      preferences: Record<string, string>
      consent: { audioCapture: boolean }
    }>()
    const saved: Array<{ preferences: Readonly<Record<string, unknown>> }> = []
    const runtime = createDeviceRuntime({
      transports: [],
      adapters: [],
      persistence: {
        load: () => restored.promise,
        save: (state) => {
          saved.push(state)
        },
      },
    })

    const setting = runtime.setPreferences({ theme: 'new' })
    await Promise.resolve()
    expect(saved).toEqual([])
    restored.resolve({
      version: 1,
      selectedDeviceIds: [],
      profiles: {},
      preferences: { theme: 'old' },
      consent: { audioCapture: false },
    })
    await setting

    expect(runtime.getSnapshot().preferences).toEqual({ theme: 'new' })
    expect(saved.at(-1)?.preferences).toEqual({ theme: 'new' })
  })

  it('cancels a pending connection without allowing its late session to attach', async () => {
    const clock = createClock()
    const device: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: clock.now(),
    }
    const pending = new Deferred<DeviceResult<DeviceTransportSession>>()
    const transport = createTransport([device], [pending.promise])
    const runtime = createDeviceRuntime({
      transports: [transport],
      adapters: [createAdapter('ring')],
      clock,
    })
    await runtime.ready()
    await runtime.scan()
    const controller = new AbortController()
    const connecting = runtime.connect(device.discoveryId, { signal: controller.signal })
    await Promise.resolve()
    await Promise.resolve()
    controller.abort()
    pending.resolve(ok(createTransportSession(device, 'late-transport')))

    await expect(connecting).resolves.toMatchObject({
      ok: false,
      error: { code: 'operation_cancelled' },
    })
    expect(runtime.getSnapshot().sessions).toEqual([])
  })

  it('bounds reconnect attempts and uses injected backoff timing', async () => {
    const clock = createClock()
    const device: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: clock.now(),
    }
    const connectResults: Array<DeviceResult<DeviceTransportSession>> = [
      {
        ok: false,
        error: { code: 'connection_failed', message: 'retry', retryable: true },
      },
      {
        ok: false,
        error: { code: 'connection_failed', message: 'retry', retryable: true },
      },
      ok(createTransportSession(device, 'reconnected-transport')),
    ]
    const delays: number[] = []
    const runtime = createDeviceRuntime({
      transports: [createTransport([device], connectResults)],
      adapters: [createAdapter('ring')],
      clock,
      scheduler: {
        sleep: async (milliseconds) => {
          delays.push(milliseconds)
          return ok(undefined)
        },
      },
      reconnectPolicy: { maxAttempts: 3, delayMs: (attempt) => attempt * 10 },
    })
    await runtime.ready()
    await runtime.scan()

    const result = await runtime.reconnect(device.discoveryId)
    expect(result.ok).toBe(true)
    expect(delays).toEqual([10, 20])
    expect(runtime.getSnapshot().sessions).toHaveLength(1)
  })

  it('closes each session and transport once when runtime close is repeated', async () => {
    const simulatorDevice: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: '2026-08-03T00:00:00.000Z',
    }
    const session = createTransportSession(simulatorDevice, 'ring-transport')
    let transportCloses = 0
    const base = createTransport([simulatorDevice], [ok(session)])
    const transport: DeviceTransport = {
      ...base,
      close: async () => {
        transportCloses += 1
        return base.close()
      },
    }
    const runtime = createDeviceRuntime({
      transports: [transport],
      adapters: [createAdapter('ring')],
    })
    await runtime.ready()
    await runtime.scan()
    await runtime.connect(simulatorDevice.discoveryId)
    await Promise.all([runtime.close(), runtime.close()])

    expect(transportCloses).toBe(1)
    expect(runtime.getSnapshot().phase).toBe('closed')
    expect(runtime.getSnapshot().sessions).toEqual([])
  })

  it('cancels reconnect backoff and clears the reconnecting phase', async () => {
    const clock = createClock()
    const device: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: clock.now(),
    }
    const controller = new AbortController()
    const runtime = createDeviceRuntime({
      transports: [
        createTransport(
          [device],
          [{ ok: false, error: { code: 'connection_failed', message: 'retry', retryable: true } }],
        ),
      ],
      adapters: [createAdapter('ring')],
      clock,
      scheduler: {
        sleep: async (_milliseconds, signal) => {
          controller.abort()
          expect(signal?.aborted).toBe(true)
          return {
            ok: false,
            error: { code: 'operation_cancelled', message: 'cancelled', retryable: true },
          }
        },
      },
    })
    await runtime.ready()
    await runtime.scan()

    await expect(runtime.reconnect(device.discoveryId, { signal: controller.signal })).resolves.toMatchObject({
      ok: false,
      error: { code: 'operation_cancelled' },
    })
    expect(runtime.getSnapshot().phase).toBe('ready')
    expect(runtime.getSnapshot().devices[0]?.phase).toBe('disconnected')
  })

  it('keeps an existing session when reconnect is already cancelled', async () => {
    const device: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: '2026-08-03T00:00:00.000Z',
    }
    const originalTransportSession = createTransportSession(device, 'ring-transport')
    const runtime = createDeviceRuntime({
      transports: [createTransport([device], [ok(originalTransportSession)])],
      adapters: [createAdapter('ring')],
    })
    await runtime.ready()
    await runtime.scan()
    await runtime.connect(device.discoveryId)
    const originalSessionId = runtime.getSnapshot().sessions[0]?.sessionId
    const controller = new AbortController()
    controller.abort()

    await expect(runtime.reconnect(device.discoveryId, { signal: controller.signal })).resolves.toMatchObject({
      ok: false,
      error: { code: 'operation_cancelled' },
    })
    expect(originalTransportSession.getState()).toBe('connected')
    expect(runtime.getSnapshot().sessions[0]?.sessionId).toBe(originalSessionId)
    expect(runtime.getSnapshot().devices[0]?.phase).toBe('connected')
  })

  it('supports external-store subscriptions with idempotent unsubscribe', async () => {
    const clock = createClock()
    const device: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: clock.now(),
    }
    const runtime = createDeviceRuntime({
      transports: [createTransport([device], [ok(createTransportSession(device, 'ring-transport'))])],
      adapters: [createAdapter('ring')],
      clock,
    })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    await runtime.ready()
    await runtime.scan()
    expect(listener).toHaveBeenCalled()
    const calls = listener.mock.calls.length
    unsubscribe()
    unsubscribe.unsubscribe()
    await runtime.cancelScan()
    expect(listener).toHaveBeenCalledTimes(calls)
    expect(runtime.getServerSnapshot()).toBe(runtime.getSnapshot())
  })

  it('redacts local-only values before retaining event history', async () => {
    const device: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: '2026-08-03T00:00:00.000Z',
    }
    const localOnlyEvent = {
      eventId: 'local-only-event',
      deviceId: 'ring-device',
      sessionId: 'ring-session',
      occurredAt: device.discoveredAt,
      source: 'physical',
      kind: 'metric',
      metric: {
        name: 'ppg',
        value: [12, 34, 56],
        unit: 'raw',
        privacy: 'local_only',
        exportConsentRequired: true,
      },
    } as const
    const runtime = createDeviceRuntime({
      transports: [createTransport([device], [ok(createTransportSession(device, 'ring-transport'))])],
      adapters: [createAdapter('ring', undefined, new Map([[device.discoveryId, [localOnlyEvent]]]))],
    })
    await runtime.ready()
    await runtime.scan()
    await runtime.connect(device.discoveryId)

    const retained = runtime.getSnapshot().sessions[0]?.history[0] as unknown as {
      metric?: Record<string, unknown>
    }
    expect(retained.metric).not.toHaveProperty('value')
    expect(retained.metric).not.toHaveProperty('unit')
    expect(runtime.getSnapshot().sessions[0]?.latestValues).toEqual({})
  })

  it('sanitizes thrown transport errors during discovery', async () => {
    const transport: DeviceTransport = {
      ...createTransport([], []),
      open: async () => {
        throw { code: 'not_a_device_error', retryable: true }
      },
    }
    const runtime = createDeviceRuntime({ transports: [transport], adapters: [] })

    await expect(runtime.scan()).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'transport_unavailable',
        message: 'The device operation failed.',
        retryable: true,
      },
    })
  })

  it('maps parse failures to typed diagnostics without retaining sensitive details', async () => {
    const clock = createClock()
    const device: DiscoveredDevice = {
      discoveryId: 'private-ring-discovery-id',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: clock.now(),
    }
    const parseFailure = {
      eventId: 'private-parse-event-id',
      deviceId: 'private-normalized-device-id',
      sessionId: 'private-session-id',
      occurredAt: clock.now(),
      source: 'physical',
      kind: 'parse_failure',
      errorCode: 'invalid_data',
      failure: {
        code: 'value_out_of_bounds',
        message: 'private-ring-discovery-id returned physiological value 187',
        payload: 'deadbeef',
        rawSample: 187,
      },
    } as const
    const runtime = createDeviceRuntime({
      transports: [
        createTransport(
          [device],
          [ok(createTransportSession(device, 'private-transport-session'))],
        ),
      ],
      adapters: [
        createAdapter(
          'ring',
          undefined,
          new Map([[device.discoveryId, [parseFailure]]]),
        ),
      ],
      clock,
    })
    await runtime.ready()
    await runtime.scan()
    await runtime.connect(device.discoveryId)

    const diagnostic = runtime.getSnapshot().diagnostics.find(
      (entry) => entry.message === 'Device data could not be parsed.',
    )
    expect(diagnostic).toEqual({
      diagnosticId: expect.stringMatching(/^runtime-diagnostic-/),
      occurredAt: clock.now(),
      operation: 'event',
      phase: 'connected',
      code: 'invalid_data',
      message: 'Device data could not be parsed.',
    })
    const serialized = JSON.stringify(diagnostic)
    expect(serialized).not.toContain('private-ring-discovery-id')
    expect(serialized).not.toContain('private-normalized-device-id')
    expect(serialized).not.toContain('deadbeef')
    expect(serialized).not.toContain('187')
  })

  it('publishes frozen snapshots detached from producer event objects', async () => {
    const device: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: '2026-08-03T00:00:00.000Z',
    }
    const producerEvent = {
      eventId: 'heart-rate-event',
      deviceId: 'ring-device',
      sessionId: 'ring-session',
      occurredAt: device.discoveredAt,
      source: 'physical',
      kind: 'metric',
      metric: {
        name: 'heart_rate',
        value: 72,
        unit: 'bpm',
        privacy: 'normalized',
        exportConsentRequired: false,
      },
    } as const
    const runtime = createDeviceRuntime({
      transports: [createTransport([device], [ok(createTransportSession(device, 'ring-transport'))])],
      adapters: [createAdapter('ring', undefined, new Map([[device.discoveryId, [producerEvent]]]))],
    })
    await runtime.ready()
    await runtime.scan()
    await runtime.connect(device.discoveryId)
    const published = runtime.getSnapshot()
    ;(producerEvent.metric as { value: number }).value = 99

    expect(published.sessions[0]?.latestValues.heart_rate.value).toBe(72)
    expect(runtime.getSnapshot()).toBe(published)
    expect(Object.isFrozen(published)).toBe(true)
    expect(Object.isFrozen(published.sessions[0]?.history[0])).toBe(true)
    expect(() => {
      const sessions = published.sessions as unknown[]
      sessions.push(published.sessions[0]!)
    }).toThrow()
  })

  it('continues runtime cleanup when a third-party unsubscribe throws', async () => {
    const device: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'fixture-transport',
      transportKind: 'bluetooth_low_energy',
      displayName: 'ring',
      connectable: true,
      discoveredAt: '2026-08-03T00:00:00.000Z',
    }
    let transportCloses = 0
    const baseTransport = createTransport(
      [device],
      [ok(createTransportSession(device, 'ring-transport'))],
    )
    const transport: DeviceTransport = {
      ...baseTransport,
      close: async () => {
        transportCloses += 1
        return baseTransport.close()
      },
    }
    let throwCleanupError = true
    const runtime = createDeviceRuntime({
      transports: [transport],
      adapters: [
        createAdapter('ring', undefined, new Map(), () => {
          if (!throwCleanupError) return undefined
          throwCleanupError = false
          return new Error('listener cleanup')
        }),
      ],
    })
    await runtime.ready()
    await runtime.scan()
    await runtime.connect(device.discoveryId)

    await expect(runtime.close()).resolves.toMatchObject({
      ok: false,
      error: { code: 'disconnected' },
    })
    await expect(runtime.close()).resolves.toMatchObject({ ok: true })
    expect(transportCloses).toBe(2)
    expect(runtime.getSnapshot().sessions).toEqual([])
    expect(runtime.getSnapshot().phase).toBe('closed')
  })
})
