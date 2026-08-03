import { createDeviceRuntime, type DeviceRuntime } from '../../devices/runtime'
import { createOmiSimulator, createRingSimulator } from '../../devices/simulators'
import type { SimulatorRuntime } from '../../devices/simulators/types'
import type { NormalizedDeviceEventBase } from '../../devices/contracts'

let fallbackRuntime: DeviceRuntime | undefined
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
