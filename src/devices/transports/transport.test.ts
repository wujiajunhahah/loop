import { describe, expect, it, vi } from 'vitest'
import { createDeviceTransport } from '.'
import { MockBleClient } from './testing/MockBleClient'

describe('device transport selection and simulation', () => {
  it('imports without a native bridge and selects the deterministic web fallback', async () => {
    const loadClient = vi.fn(async () => {
      throw new Error('native bridge unavailable')
    })
    const transport = await createDeviceTransport({
      isNativePlatform: () => false,
      native: { loadClient },
    })

    expect(transport.kind).toBe('simulated')
    await expect(transport.open()).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    expect(loadClient).not.toHaveBeenCalled()
  })

  it('discovers a fixed device labeled as simulated and stops idempotently', async () => {
    const transport = await createDeviceTransport({
      isNativePlatform: () => false,
    })
    await transport.open()
    const listener = vi.fn()

    const discovery = await transport.startDiscovery(
      { filters: [{ namePrefix: 'Simulated' }] },
      listener,
    )

    expect(discovery.ok).toBe(true)
    expect(listener).toHaveBeenCalledWith({
      discoveryId: 'simulated-device-1',
      transportId: 'simulated-web',
      transportKind: 'simulated',
      displayName: 'Simulated wearable',
      advertisedServiceIds: ['simulated-service'],
      connectable: true,
      signalStrength: -42,
      discoveredAt: '2026-01-01T00:00:00.000Z',
    })
    if (!discovery.ok) return

    await expect(discovery.value.stop()).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    await expect(discovery.value.stop()).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    expect(discovery.value.getState()).toBe('stopped')
  })

  it('selects native BLE without loading its client before open', async () => {
    const client = new MockBleClient()
    const loadClient = vi.fn(async () => client)
    const transport = await createDeviceTransport({
      isNativePlatform: () => true,
      native: { loadClient },
    })

    expect(transport.kind).toBe('bluetooth_low_energy')
    expect(loadClient).not.toHaveBeenCalled()
    await expect(transport.open()).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    expect(loadClient).toHaveBeenCalledTimes(1)
  })

  it('provides deterministic simulated read, write, and notification operations', async () => {
    const transport = await createDeviceTransport({
      isNativePlatform: () => false,
    })
    await transport.open()
    const discovered: Parameters<Parameters<typeof transport.startDiscovery>[1]>[0][] = []
    const discovery = await transport.startDiscovery({}, (device) =>
      discovered.push(device),
    )
    expect(discovery.ok).toBe(true)
    if (discovery.ok) await discovery.value.stop()
    const connection = await transport.connect({ device: discovered[0] })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return
    const characteristic = {
      serviceId: 'simulated-service',
      characteristicId: 'simulated-value',
    }

    await expect(connection.value.read(characteristic)).resolves.toMatchObject({
      ok: true,
      value: {
        payload: new Uint8Array([0]),
        sequence: 1,
        source: 'read',
        characteristic,
      },
    })
    const frames: Array<{ payload: Uint8Array; sequence: number }> = []
    const subscription = await connection.value.subscribe(
      characteristic,
      (frame) => frames.push(frame),
    )
    expect(subscription.ok).toBe(true)
    const backing = new Uint8Array([90, 5, 6, 80])
    await expect(
      connection.value.write({
        characteristic,
        payload: backing.subarray(1, 3),
        mode: 'with_response',
      }),
    ).resolves.toEqual({ ok: true, value: undefined })
    backing[1] = 255

    expect(frames).toEqual([
      expect.objectContaining({
        payload: new Uint8Array([5, 6]),
        sequence: 2,
        source: 'notification',
      }),
    ])
    await expect(connection.value.read(characteristic)).resolves.toMatchObject({
      ok: true,
      value: { payload: new Uint8Array([5, 6]), sequence: 3 },
    })
    if (subscription.ok) {
      await subscription.value.unsubscribe()
      await subscription.value.unsubscribe()
    }
    await connection.value.close()
    await connection.value.close()
    expect(connection.value.getState()).toBe('disconnected')
  })
})
