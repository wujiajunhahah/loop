import type { DeviceTransport } from '../contracts'
import {
  createCapacitorBleTransport,
  type CapacitorBleTransportOptions,
} from './capacitorBle'
import { createSimulatedDeviceTransport } from './simulated'

export interface DeviceTransportFactoryOptions {
  isNativePlatform?: () => boolean | Promise<boolean>
  native?: CapacitorBleTransportOptions
}

async function detectNativePlatform(): Promise<boolean> {
  const { Capacitor } = await import('@capacitor/core')
  return Capacitor.isNativePlatform()
}

export async function createDeviceTransport(
  options: DeviceTransportFactoryOptions = {},
): Promise<DeviceTransport> {
  const isNative = await (options.isNativePlatform ?? detectNativePlatform)()
  if (isNative) {
    return createCapacitorBleTransport(options.native)
  }
  return createSimulatedDeviceTransport()
}

export { createSimulatedDeviceTransport } from './simulated'
export {
  createCapacitorBleTransport,
  type CapacitorBleTransportOptions,
} from './capacitorBle'
export type { BleClientPort } from './bleClient'
