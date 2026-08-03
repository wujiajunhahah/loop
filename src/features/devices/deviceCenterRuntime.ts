import { createDeviceRuntime, type DeviceRuntime } from '../../devices/runtime'
import { createOmiSimulator, createRingSimulator } from '../../devices/simulators'
import { createCapacitorBleTransport } from '../../devices/transports'
import type { SimulatorRuntime } from '../../devices/simulators/types'
import type { NormalizedDeviceEventBase } from '../../devices/contracts'
import {
  createConfiguredPhysicalAdapters,
  readDeviceNativeConfiguration,
  type DeviceNativeConfiguration,
  type DeviceNativeEnvironment,
} from './deviceNativeConfiguration'
import { Capacitor } from '@capacitor/core'

let fallbackRuntime: DeviceRuntime | undefined
let physicalRuntime: DeviceRuntime | undefined
let simulatorRuntime: DeviceRuntime | undefined
let simulatorSources:
  | Readonly<{
      omi: SimulatorRuntime<NormalizedDeviceEventBase>
      ring: SimulatorRuntime<NormalizedDeviceEventBase>
    }>
  | undefined

export function getFallbackDeviceRuntime() {
  fallbackRuntime ??= createDeviceRuntime({ transports: [], adapters: [] })
  return fallbackRuntime
}

export function createPhysicalDeviceRuntime(
  configuration: DeviceNativeConfiguration,
) {
  return createDeviceRuntime({
    transports: [createCapacitorBleTransport()],
    adapters: createConfiguredPhysicalAdapters(configuration),
  })
}

export function getPhysicalDeviceRuntime(
  environment: DeviceNativeEnvironment = import.meta.env,
) {
  if (!Capacitor.isNativePlatform()) return getFallbackDeviceRuntime()
  physicalRuntime ??= createPhysicalDeviceRuntime(
    readDeviceNativeConfiguration(environment),
  )
  return physicalRuntime
}

export function getDefaultDeviceCenterEnvironment() {
  if (!Capacitor.isNativePlatform()) {
    return { physicalSupported: false, permission: 'unsupported' as const }
  }
  return {
    physicalSupported: true,
    permission: 'prompt' as const,
    appState: typeof document !== 'undefined' && document.visibilityState === 'hidden'
      ? 'background' as const
      : 'foreground' as const,
    openSettings: () => {
      void import('@capacitor-community/bluetooth-le').then(({ BleClient }) =>
        BleClient.openAppSettings(),
      )
    },
  }
}

export function getDeterministicSimulatorRuntime() {
  if (simulatorRuntime !== undefined) return simulatorRuntime

  const omi = createOmiSimulator({ deviceName: 'OMI 演示设备' })
  const ring = createRingSimulator({ deviceName: '智能戒指演示设备' })
  simulatorSources = { omi, ring }
  simulatorRuntime = createDeviceRuntime({
    transports: [omi.transport, ring.transport],
    adapters: [omi.adapter, ring.adapter],
  })
  return simulatorRuntime
}

export function advanceDeterministicSimulator(kind: 'omi' | 'ring') {
  const source = simulatorSources?.[kind]
  source?.next()
}
