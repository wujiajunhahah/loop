import { describe, expect, it } from 'vitest'
import {
  createConfiguredPhysicalAdapters,
  readDeviceNativeConfiguration,
} from './deviceNativeConfiguration'

const omiDevice = {
  discoveryId: 'opaque-omi',
  transportId: 'capacitor-ble',
  transportKind: 'bluetooth_low_energy' as const,
  displayName: 'Omi',
  advertisedServiceIds: ['19b10000-e8f2-537e-4f6c-d104768a1214'],
  connectable: true,
  discoveredAt: '2026-08-03T00:00:00.000Z',
}

describe('native device configuration', () => {
  it('does not enable OMI parsing from partial or malformed framing input', () => {
    expect(
      readDeviceNativeConfiguration({
        VITE_OMI_FRAGMENT_LAYOUT: '{"0":160}',
        VITE_OMI_FIRMWARE_MODEL: 'Omi',
      }).omi,
    ).toBeUndefined()
    expect(
      readDeviceNativeConfiguration({
        VITE_OMI_FRAGMENT_LAYOUT: '{"0":0}',
        VITE_OMI_FIRMWARE_MODEL: 'Omi',
        VITE_OMI_FIRMWARE_VERSION: '1.0.3',
      }).omi,
    ).toBeUndefined()
  })

  it('builds the official OMI adapter only from complete reviewed inputs', () => {
    const configuration = readDeviceNativeConfiguration({
      VITE_OMI_FRAGMENT_LAYOUT: '{"0":160,"1":80}',
      VITE_OMI_FIRMWARE_MODEL: 'Omi',
      VITE_OMI_FIRMWARE_VERSION: '1.0.3',
    })

    expect(configuration.omi).toMatchObject({
      framing: { payloadBytesByFragmentIndex: { 0: 160, 1: 80 } },
      firmware: {
        model: 'Omi',
        version: '1.0.3',
        validation: 'fixture_only',
      },
    })
    expect(createConfiguredPhysicalAdapters(configuration)[0]?.adapterId).toBe(
      'omi-audio',
    )
  })

  it('keeps OMI discoverable while framing is unconfigured', () => {
    const [adapter] = createConfiguredPhysicalAdapters({})

    expect(adapter?.adapterId).toBe('omi-audio-unconfigured')
    expect(adapter?.matches(omiDevice)).toBe(true)
  })

  it('only recognizes a ring from explicit discovery hints', () => {
    const configuration = readDeviceNativeConfiguration({
      VITE_RING_DISCOVERY_NAMES: 'Alloop Ring, Reviewed Ring',
      VITE_RING_DISCOVERY_SERVICE_IDS: '1234',
    })
    const ringAdapter = createConfiguredPhysicalAdapters(configuration).find(
      (adapter) => adapter.adapterId === 'ring',
    )

    expect(ringAdapter?.matches({
      ...omiDevice,
      discoveryId: 'opaque-ring',
      displayName: 'Alloop Ring',
      advertisedServiceIds: [],
    })).toBe(true)
    expect(ringAdapter?.matches({
      ...omiDevice,
      discoveryId: 'unknown-ring',
      displayName: 'Unknown Ring',
      advertisedServiceIds: [],
    })).toBe(false)
  })
})
