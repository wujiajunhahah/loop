export interface BleScanResult {
  device: {
    deviceId: string
    name?: string
    uuids?: string[]
  }
  localName?: string
  rssi?: number
  uuids?: string[]
}

export interface BleScanOptions {
  services?: string[]
  name?: string
  namePrefix?: string
  allowDuplicates?: boolean
}

export interface BleCharacteristicProperties {
  read: boolean
  write: boolean
  writeWithoutResponse: boolean
  notify: boolean
  indicate: boolean
}

export interface BleCharacteristic {
  uuid: string
  properties: BleCharacteristicProperties
}

export interface BleService {
  uuid: string
  characteristics: BleCharacteristic[]
}

export interface BleClientPort {
  initialize(): Promise<void>
  isEnabled(): Promise<boolean>
  startEnabledNotifications(listener: (enabled: boolean) => void): Promise<void>
  stopEnabledNotifications(): Promise<void>
  requestLEScan(
    options: BleScanOptions,
    listener: (result: BleScanResult) => void,
  ): Promise<void>
  stopLEScan(): Promise<void>
  connect(
    deviceId: string,
    onDisconnect?: (deviceId: string) => void,
    options?: { timeout?: number },
  ): Promise<void>
  disconnect(deviceId: string): Promise<void>
  getServices(deviceId: string): Promise<BleService[]>
  read(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    options?: { timeout?: number },
  ): Promise<DataView>
  write(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    value: DataView,
    options?: { timeout?: number },
  ): Promise<void>
  writeWithoutResponse(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    value: DataView,
    options?: { timeout?: number },
  ): Promise<void>
  startNotifications(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    listener: (value: DataView) => void,
    options?: { timeout?: number },
  ): Promise<void>
  stopNotifications(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
  ): Promise<void>
}

export async function loadCapacitorBleClient(): Promise<BleClientPort> {
  const { BleClient } = await import('@capacitor-community/bluetooth-le')
  return BleClient
}
