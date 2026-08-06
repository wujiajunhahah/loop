import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapacitorBleTransport } from './capacitorBle'
import { MockBleClient } from './testing/MockBleClient'

const discoveredDevice = (discoveryId: string) => ({
  discoveryId,
  transportId: 'capacitor-ble',
  transportKind: 'bluetooth_low_energy' as const,
  displayName: 'Test wearable',
  connectable: true,
  discoveredAt: '2026-08-03T00:00:00.000Z',
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('Capacitor BLE transport lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads the native client only from open and maps an unavailable import', async () => {
    const loadClient = vi.fn(async () => {
      throw new Error('native module missing')
    })
    const transport = createCapacitorBleTransport({ loadClient })

    expect(loadClient).not.toHaveBeenCalled()
    expect(transport.getState()).toBe('idle')
    await expect(transport.open()).resolves.toEqual({
      ok: false,
      error: {
        code: 'unsupported_platform',
        message: 'Bluetooth is unsupported on this platform.',
        retryable: false,
      },
    })
    expect(loadClient).toHaveBeenCalledTimes(1)
    expect(transport.getState()).toBe('failed')
  })

  it('cancels discovery once and ignores scan results after abort', async () => {
    const client = new MockBleClient()
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
      now: () => '2026-08-03T00:00:00.000Z',
    })
    await transport.open()
    const abort = new AbortController()
    const listener = vi.fn()
    const discovery = await transport.startDiscovery(
      {
        filters: [{ services: ['service-a'], namePrefix: 'Loop' }],
        signal: abort.signal,
      },
      listener,
    )
    expect(discovery.ok).toBe(true)

    client.emitScan({
      device: { deviceId: 'opaque-device-1', name: 'Cached name' },
      localName: 'Loop wearable',
      rssi: -51,
      uuids: ['service-a'],
    })
    expect(listener).toHaveBeenCalledWith({
      discoveryId: 'opaque-device-1',
      transportId: 'capacitor-ble',
      transportKind: 'bluetooth_low_energy',
      displayName: 'Loop wearable',
      advertisedServiceIds: ['service-a'],
      connectable: true,
      signalStrength: -51,
      discoveredAt: '2026-08-03T00:00:00.000Z',
    })

    abort.abort()
    await vi.waitFor(() => expect(client.stopLEScan).toHaveBeenCalledTimes(1))
    client.emitScan({
      device: { deviceId: 'opaque-device-2' },
      localName: 'Loop late result',
      uuids: ['service-a'],
    })
    expect(listener).toHaveBeenCalledTimes(1)
    if (!discovery.ok) return
    await discovery.value.stop()
    expect(client.stopLEScan).toHaveBeenCalledTimes(1)
    expect(discovery.value.getState()).toBe('stopped')
  })

  it('stops discovery when its deterministic timeout expires', async () => {
    vi.useFakeTimers()
    const client = new MockBleClient()
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()
    const discovery = await transport.startDiscovery(
      { timeoutMs: 250 },
      vi.fn(),
    )
    expect(discovery.ok).toBe(true)

    await vi.advanceTimersByTimeAsync(250)

    expect(client.stopLEScan).toHaveBeenCalledTimes(1)
    if (discovery.ok) expect(discovery.value.getState()).toBe('stopped')
  })

  it('cleans up a scan when native scan startup fails', async () => {
    const client = new MockBleClient()
    client.requestLEScan.mockRejectedValueOnce(new Error('scan startup failed'))
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()

    await expect(transport.startDiscovery({}, vi.fn())).resolves.toMatchObject({
      ok: false,
      error: { code: 'discovery_failed' },
    })
    expect(client.stopLEScan).toHaveBeenCalledTimes(1)
  })

  it('serializes concurrent connect calls and discovers services before returning sessions', async () => {
    const client = new MockBleClient()
    const firstConnect = deferred<void>()
    const secondConnect = deferred<void>()
    client.connect
      .mockImplementationOnce(async () => firstConnect.promise)
      .mockImplementationOnce(async () => secondConnect.promise)
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()

    const firstResult = transport.connect({
      device: discoveredDevice('opaque-device-1'),
      timeoutMs: 1_000,
    })
    const secondResult = transport.connect({
      device: discoveredDevice('opaque-device-2'),
      timeoutMs: 1_000,
    })

    await vi.waitFor(() => expect(client.connect).toHaveBeenCalledTimes(1))
    firstConnect.resolve()
    const first = await firstResult
    expect(first.ok).toBe(true)
    expect(client.getServices).toHaveBeenNthCalledWith(1, 'opaque-device-1')
    await vi.waitFor(() => expect(client.connect).toHaveBeenCalledTimes(2))
    secondConnect.resolve()
    const second = await secondResult
    expect(second.ok).toBe(true)
    expect(client.getServices).toHaveBeenNthCalledWith(2, 'opaque-device-2')
  })

  it('times out a pending connect, disconnects once, and ignores its late result', async () => {
    vi.useFakeTimers()
    const client = new MockBleClient()
    const pendingConnect = deferred<void>()
    client.connect.mockImplementationOnce(async () => pendingConnect.promise)
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()

    const connection = transport.connect({
      device: discoveredDevice('opaque-device-timeout'),
      timeoutMs: 50,
    })
    await vi.advanceTimersByTimeAsync(50)

    await expect(connection).resolves.toMatchObject({
      ok: false,
      error: { code: 'timeout' },
    })
    expect(client.disconnect).toHaveBeenCalledTimes(1)
    pendingConnect.resolve()
    await vi.runAllTimersAsync()
    expect(client.getServices).not.toHaveBeenCalled()
    expect(client.disconnect).toHaveBeenCalledTimes(1)
  })

  it('maps service discovery failure and disconnects the incomplete connection', async () => {
    const client = new MockBleClient()
    client.getServices.mockRejectedValueOnce(new Error('service lookup failed'))
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()

    await expect(
      transport.connect({ device: discoveredDevice('opaque-device-services') }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'services_discovery_failed',
        message: 'Bluetooth service discovery failed.',
        retryable: true,
      },
    })
    expect(client.disconnect).toHaveBeenCalledTimes(1)
  })

  it('rejects operations for a characteristic absent from discovered services', async () => {
    const client = new MockBleClient()
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()
    const connection = await transport.connect({
      device: discoveredDevice('opaque-device-routing'),
    })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return

    await expect(
      connection.value.read({
        serviceId: 'unknown-service',
        characteristicId: 'unknown-characteristic',
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'read_failed' },
    })
    expect(client.read).not.toHaveBeenCalled()
  })

  it('routes reads and copies the exact DataView into a provenance frame', async () => {
    const client = new MockBleClient()
    const backing = new Uint8Array([99, 10, 20, 88])
    client.read.mockResolvedValueOnce(new DataView(backing.buffer, 1, 2))
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
      now: () => '2026-08-03T01:00:00.000Z',
    })
    await transport.open()
    const connection = await transport.connect({
      device: discoveredDevice('opaque-device-read'),
    })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return
    const characteristic = {
      serviceId: 'service-a',
      characteristicId: 'characteristic-a',
    }

    const read = await connection.value.read(characteristic, { timeoutMs: 125 })
    backing[1] = 255

    expect(client.read).toHaveBeenCalledWith(
      'opaque-device-read',
      'service-a',
      'characteristic-a',
      { timeout: 125 },
    )
    expect(read).toEqual({
      ok: true,
      value: {
        payload: new Uint8Array([10, 20]),
        sequence: 1,
        characteristic,
        source: 'read',
        receivedAt: '2026-08-03T01:00:00.000Z',
      },
    })
  })

  it('routes copied writes through the explicitly requested response mode', async () => {
    const client = new MockBleClient()
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()
    const connection = await transport.connect({
      device: discoveredDevice('opaque-device-write'),
    })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return
    const characteristic = {
      serviceId: 'service-a',
      characteristicId: 'characteristic-a',
    }
    const backing = new Uint8Array([90, 1, 2, 80])

    await expect(
      connection.value.write({
        characteristic,
        payload: backing.subarray(1, 3),
        mode: 'with_response',
        timeoutMs: 75,
      }),
    ).resolves.toEqual({ ok: true, value: undefined })
    await expect(
      connection.value.write({
        characteristic,
        payload: new Uint8Array([3]),
        mode: 'without_response',
      }),
    ).resolves.toEqual({ ok: true, value: undefined })
    backing[1] = 255

    const withResponseValue = client.write.mock.calls[0][3]
    const withoutResponseValue = client.writeWithoutResponse.mock.calls[0][3]
    expect(
      new Uint8Array(
        withResponseValue.buffer,
        withResponseValue.byteOffset,
        withResponseValue.byteLength,
      ),
    ).toEqual(new Uint8Array([1, 2]))
    expect(
      new Uint8Array(
        withoutResponseValue.buffer,
        withoutResponseValue.byteOffset,
        withoutResponseValue.byteLength,
      ),
    ).toEqual(new Uint8Array([3]))
    expect(client.write).toHaveBeenCalledWith(
      'opaque-device-write',
      'service-a',
      'characteristic-a',
      expect.any(DataView),
      { timeout: 75 },
    )
    expect(client.writeWithoutResponse).toHaveBeenCalledTimes(1)
  })

  it('shares one native notification and emits copied frames with session-wide order', async () => {
    const client = new MockBleClient()
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
      now: () => '2026-08-03T02:00:00.000Z',
    })
    await transport.open()
    const connection = await transport.connect({
      device: discoveredDevice('opaque-device-notification'),
    })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return
    const characteristic = {
      serviceId: 'service-a',
      characteristicId: 'characteristic-a',
    }
    await connection.value.read(characteristic)
    const firstFrames: Array<{
      payload: Uint8Array
      sequence: number
      source: string
    }> = []
    const secondFrames: typeof firstFrames = []

    const first = await connection.value.subscribe(characteristic, (frame) =>
      firstFrames.push(frame),
    )
    const second = await connection.value.subscribe(characteristic, (frame) =>
      secondFrames.push(frame),
    )
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(client.startNotifications).toHaveBeenCalledTimes(1)

    const backing = new Uint8Array([90, 3, 4, 80])
    client.emitNotification(
      'opaque-device-notification',
      'service-a',
      'characteristic-a',
      new DataView(backing.buffer, 1, 2),
    )
    backing[1] = 255

    expect(firstFrames).toEqual([
      expect.objectContaining({
        payload: new Uint8Array([3, 4]),
        sequence: 2,
        source: 'notification',
        characteristic,
        receivedAt: '2026-08-03T02:00:00.000Z',
      }),
    ])
    expect(secondFrames).toEqual([
      expect.objectContaining({
        payload: new Uint8Array([3, 4]),
        sequence: 2,
        source: 'notification',
      }),
    ])

    if (!first.ok || !second.ok) return
    await first.value.unsubscribe()
    await first.value.unsubscribe()
    expect(client.stopNotifications).not.toHaveBeenCalled()
    await second.value.unsubscribe()
    await second.value.unsubscribe()
    expect(client.stopNotifications).toHaveBeenCalledTimes(1)
  })

  it('waits for one native notification startup across concurrent subscriptions', async () => {
    const client = new MockBleClient()
    const start = deferred<void>()
    client.startNotifications.mockImplementationOnce(async () => start.promise)
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()
    const connection = await transport.connect({
      device: discoveredDevice('opaque-device-concurrent-notification'),
    })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return

    let firstSettled = false
    let secondSettled = false
    const characteristic = {
      serviceId: 'service-a',
      characteristicId: 'characteristic-a',
    }
    const first = connection.value
      .subscribe(characteristic, vi.fn())
      .then((result) => {
        firstSettled = true
        return result
      })
    const second = connection.value
      .subscribe(characteristic, vi.fn())
      .then((result) => {
        secondSettled = true
        return result
      })

    await vi.waitFor(() => expect(client.startNotifications).toHaveBeenCalledTimes(1))
    expect(firstSettled).toBe(false)
    expect(secondSettled).toBe(false)
    start.resolve()
    await expect(first).resolves.toMatchObject({ ok: true })
    await expect(second).resolves.toMatchObject({ ok: true })
  })

  it('cascades idempotent cleanup in notification, disconnect, listener order', async () => {
    const client = new MockBleClient()
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()
    const connection = await transport.connect({
      device: discoveredDevice('opaque-device-cleanup'),
    })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return
    const frames = vi.fn()
    const subscription = await connection.value.subscribe(
      { serviceId: 'service-a', characteristicId: 'characteristic-a' },
      frames,
    )
    expect(subscription.ok).toBe(true)

    await expect(transport.close()).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    await expect(transport.close()).resolves.toEqual({
      ok: true,
      value: undefined,
    })

    expect(client.cleanupOrder).toEqual([
      'notification:service-a:characteristic-a',
      'disconnect',
      'power-listener',
    ])
    expect(client.stopNotifications).toHaveBeenCalledTimes(1)
    expect(client.disconnect).toHaveBeenCalledTimes(1)
    expect(client.stopEnabledNotifications).toHaveBeenCalledTimes(1)
    expect(connection.value.getState()).toBe('disconnected')
    client.emitNotification(
      'opaque-device-cleanup',
      'service-a',
      'characteristic-a',
      new DataView(new Uint8Array([9]).buffer),
    )
    expect(frames).not.toHaveBeenCalled()
  })

  it('invalidates notification listeners when the native disconnect callback fires', async () => {
    const client = new MockBleClient()
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()
    const connection = await transport.connect({
      device: discoveredDevice('opaque-device-disconnected'),
    })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return
    const states: string[] = []
    const stateSubscription = connection.value.subscribeState?.((state) => {
      states.push(state)
    })
    expect(states).toEqual(['connected'])
    const frames = vi.fn()
    await connection.value.subscribe(
      { serviceId: 'service-a', characteristicId: 'characteristic-a' },
      frames,
    )

    client.emitDisconnect('opaque-device-disconnected')
    client.emitNotification(
      'opaque-device-disconnected',
      'service-a',
      'characteristic-a',
      new DataView(new Uint8Array([7]).buffer),
    )

    expect(connection.value.getState()).toBe('disconnected')
    expect(states).toEqual(['connected', 'disconnected'])
    expect(frames).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(client.stopNotifications).toHaveBeenCalledTimes(1))
    await connection.value.close()
    expect(client.disconnect).not.toHaveBeenCalled()
    expect(client.stopNotifications).toHaveBeenCalledTimes(1)
    stateSubscription?.unsubscribe()
    stateSubscription?.unsubscribe()
  })

  it('disconnects sessions when Bluetooth is powered off', async () => {
    const client = new MockBleClient()
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()
    const connection = await transport.connect({
      device: discoveredDevice('opaque-device-powered-off'),
    })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return
    const subscription = await connection.value.subscribe(
      { serviceId: 'service-a', characteristicId: 'characteristic-a' },
      vi.fn(),
    )
    expect(subscription.ok).toBe(true)

    client.emitPower(false)
    await vi.waitFor(() => expect(connection.value.getState()).toBe('disconnected'))
    await vi.waitFor(() => expect(client.stopNotifications).toHaveBeenCalledTimes(1))
    await expect(connection.value.read({
      serviceId: 'service-a',
      characteristicId: 'characteristic-a',
    })).resolves.toMatchObject({ error: { code: 'disconnected' } })
  })

  it('waits for and invalidates a pending connect before closing the transport', async () => {
    const client = new MockBleClient()
    const pendingConnect = deferred<void>()
    client.connect.mockImplementationOnce(async () => pendingConnect.promise)
    const transport = createCapacitorBleTransport({
      loadClient: async () => client,
    })
    await transport.open()

    const connection = transport.connect({
      device: discoveredDevice('opaque-device-close-race'),
    })
    await vi.waitFor(() => expect(client.connect).toHaveBeenCalledTimes(1))
    const closing = transport.close()
    pendingConnect.resolve()

    await expect(connection).resolves.toMatchObject({
      ok: false,
      error: { code: 'disconnected' },
    })
    await expect(closing).resolves.toEqual({ ok: true, value: undefined })
    expect(client.getServices).not.toHaveBeenCalled()
    expect(transport.getState()).toBe('closed')
  })
})
