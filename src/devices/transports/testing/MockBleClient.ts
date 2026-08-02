import { vi } from 'vitest'

export interface MockScanResult {
  device: {
    deviceId: string
    name?: string
    uuids?: string[]
  }
  localName?: string
  rssi?: number
  uuids?: string[]
}

export class MockBleClient {
  private scanListener?: (result: MockScanResult) => void
  private powerListener?: (enabled: boolean) => void
  private notificationListeners = new Map<
    string,
    (value: DataView) => void
  >()
  private disconnectListeners = new Map<string, (deviceId: string) => void>()
  readonly cleanupOrder: string[] = []

  initialize = vi.fn(async () => undefined)
  isEnabled = vi.fn(async () => true)
  startEnabledNotifications = vi.fn(
    async (listener: (enabled: boolean) => void) => {
      this.powerListener = listener
    },
  )
  stopEnabledNotifications = vi.fn(async () => {
    this.cleanupOrder.push('power-listener')
    this.powerListener = undefined
  })
  requestLEScan = vi.fn(
    async (
      _options: Record<string, unknown>,
      listener: (result: MockScanResult) => void,
    ) => {
      this.scanListener = listener
    },
  )
  stopLEScan = vi.fn(async () => {
    this.cleanupOrder.push('scan')
    this.scanListener = undefined
  })
  connect = vi.fn(
    async (
      deviceId: string,
      onDisconnect?: (deviceId: string) => void,
      _options?: { timeout?: number },
    ) => {
      if (onDisconnect) this.disconnectListeners.set(deviceId, onDisconnect)
    },
  )
  disconnect = vi.fn(async () => {
    this.cleanupOrder.push('disconnect')
  })
  getServices = vi.fn(async () => [
    {
      uuid: 'service-a',
      characteristics: [
        {
          uuid: 'characteristic-a',
          properties: {
            read: true,
            write: true,
            writeWithoutResponse: true,
            notify: true,
            indicate: false,
          },
          descriptors: [],
        },
      ],
    },
  ])
  read = vi.fn(async () => new DataView(new Uint8Array([1]).buffer))
  write = vi.fn(
    async (
      _deviceId: string,
      _serviceId: string,
      _characteristicId: string,
      _value: DataView,
      _options?: { timeout?: number },
    ) => undefined,
  )
  writeWithoutResponse = vi.fn(
    async (
      _deviceId: string,
      _serviceId: string,
      _characteristicId: string,
      _value: DataView,
      _options?: { timeout?: number },
    ) => undefined,
  )
  startNotifications = vi.fn(
    async (
      deviceId: string,
      serviceId: string,
      characteristicId: string,
      listener: (value: DataView) => void,
    ) => {
      this.notificationListeners.set(
        this.notificationKey(deviceId, serviceId, characteristicId),
        listener,
      )
    },
  )
  stopNotifications = vi.fn(
    async (deviceId: string, serviceId: string, characteristicId: string) => {
      this.cleanupOrder.push(`notification:${serviceId}:${characteristicId}`)
      this.notificationListeners.delete(
        this.notificationKey(deviceId, serviceId, characteristicId),
      )
    },
  )

  emitScan(result: MockScanResult) {
    this.scanListener?.(result)
  }

  emitPower(enabled: boolean) {
    this.powerListener?.(enabled)
  }

  emitDisconnect(deviceId: string) {
    this.disconnectListeners.get(deviceId)?.(deviceId)
  }

  emitNotification(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    value: DataView,
  ) {
    this.notificationListeners.get(
      this.notificationKey(deviceId, serviceId, characteristicId),
    )?.(value)
  }

  private notificationKey(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
  ) {
    return `${deviceId}\u0000${serviceId}\u0000${characteristicId}`
  }
}
