import { describe, expect, it } from 'vitest'
import {
  capabilityStatuses,
  capabilityUnavailable,
  commandCapability,
  createDeviceTransportFrameSequencer,
  deviceCapabilityIds,
  deviceOperationErrorCodes,
  requireCommandCapability,
  type CommandAcknowledgement,
  type DeviceAdapter,
  type DeviceCapabilityReport,
  type DeviceCharacteristicRef,
  type DeviceCommand,
  type DeviceResult,
  type DeviceSession,
  type DeviceSubscription,
  type DeviceTransport,
  type DeviceTransportNotificationSubscription,
  type DeviceTransportSession,
  type DiscoveredDevice,
  type NormalizedDeviceEvent,
  type NormalizedDeviceEventBase,
  type TelemetryReference,
} from '.'

const discoveredRing: DiscoveredDevice = {
  discoveryId: 'discovery-ring-1',
  transportId: 'transport-ble-1',
  transportKind: 'bluetooth_low_energy',
  displayName: 'Loop ring',
  advertisedServiceIds: ['profile-service'],
  connectable: true,
  discoveredAt: '2026-08-02T09:00:00.000Z',
}

const ok = <T>(value: T): DeviceResult<T> => ({ ok: true, value })

const capabilityReport: DeviceCapabilityReport = {
  interaction_events: { status: 'implemented' },
  telemetry: {
    status: 'requires_real_device',
    reason: 'No physical device is connected in this test.',
  },
  haptic_feedback: {
    status: 'requires_vendor_profile',
    reason: 'No reviewed command encoding is configured.',
  },
  light_feedback: {
    status: 'requires_vendor_profile',
    reason: 'No reviewed command encoding is configured.',
  },
  status_reporting: { status: 'implemented' },
  audio_capture: {
    status: 'requires_real_device',
    reason: 'Audio requires consent and a validated physical device.',
  },
}

interface AudioChunkContractEvent extends NormalizedDeviceEventBase {
  kind: 'audio_chunk'
  mediaReferenceId: string
  codec: string
}

interface ParseFailureContractEvent extends NormalizedDeviceEventBase {
  kind: 'parse_failure'
  errorCode: 'invalid_data'
  message: string
}

type ExtendedDeviceEvent =
  | NormalizedDeviceEvent
  | AudioChunkContractEvent
  | ParseFailureContractEvent

describe('device contracts', () => {
  it('exposes the approved capability states and typed unavailable results', () => {
    expect(capabilityStatuses).toEqual([
      'implemented',
      'requires_real_device',
      'requires_vendor_profile',
    ])

    const realDeviceResult = capabilityUnavailable('telemetry', {
      status: 'requires_real_device',
      reason: 'A simulator cannot validate sensor output.',
    })
    const vendorProfileResult = capabilityUnavailable('haptic_feedback', {
      status: 'requires_vendor_profile',
      reason: 'The command encoding is not configured.',
    })

    expect(realDeviceResult).toEqual({
      ok: false,
      error: {
        code: 'capability_unavailable',
        message: 'telemetry requires a real device',
        retryable: false,
        capabilityId: 'telemetry',
        capabilityState: 'requires_real_device',
        reason: 'A simulator cannot validate sensor output.',
      },
    })
    expect(vendorProfileResult).toMatchObject({
      ok: false,
      error: {
        code: 'capability_unavailable',
        capabilityId: 'haptic_feedback',
        capabilityState: 'requires_vendor_profile',
      },
    })
  })

  it('requires a complete capability report and rejects unavailable commands', () => {
    expect(Object.keys(capabilityReport)).toEqual(deviceCapabilityIds)

    const hapticCommand: DeviceCommand = {
      commandId: 'command-haptic',
      kind: 'haptic_feedback',
      issuedAt: '2026-08-02T09:02:00.000Z',
      pattern: 'acknowledge',
    }
    const statusCommand: DeviceCommand = {
      commandId: 'command-status',
      kind: 'request_status',
      issuedAt: '2026-08-02T09:02:01.000Z',
    }

    expect(requireCommandCapability(hapticCommand, capabilityReport)).toEqual({
      ok: false,
      error: {
        code: 'capability_unavailable',
        message: 'haptic_feedback requires a vendor profile',
        retryable: false,
        capabilityId: 'haptic_feedback',
        capabilityState: 'requires_vendor_profile',
        reason: 'No reviewed command encoding is configured.',
      },
    })
    expect(requireCommandCapability(statusCommand, capabilityReport)).toEqual(
      ok('status_reporting'),
    )
  })

  it('keeps telemetry as a weak reference with no emotion, grief, or health inference', () => {
    const telemetry: TelemetryReference = {
      referenceId: 'telemetry-1',
      deviceId: 'device-ring-1',
      category: 'physiological',
      observedAt: '2026-08-02T09:01:00.000Z',
      contextStrength: 'weak',
      interpretationPolicy: 'no_emotion_grief_or_health_inference',
    }
    const event: NormalizedDeviceEvent = {
      eventId: 'event-1',
      deviceId: 'device-ring-1',
      sessionId: 'device-session-1',
      kind: 'telemetry_reference',
      occurredAt: '2026-08-02T09:01:00.000Z',
      source: 'physical',
      telemetry,
    }

    expect(event.telemetry.contextStrength).toBe('weak')
    expect(event.telemetry.interpretationPolicy).toBe(
      'no_emotion_grief_or_health_inference',
    )
    expect(event).not.toHaveProperty('packet')
    expect(event).not.toHaveProperty('emotion')
  })

  it('distinguishes transport and characteristic operation errors', () => {
    expect(deviceOperationErrorCodes).toEqual(
      expect.arrayContaining([
        'powered_off',
        'unsupported_platform',
        'timeout',
        'disconnected',
        'services_discovery_failed',
        'read_failed',
        'write_failed',
        'notification_failed',
        'permission_denied',
        'operation_cancelled',
      ]),
    )
  })

  it('copies received bytes and assigns monotonic characteristic-scoped frame sequences', () => {
    const sequencer = createDeviceTransportFrameSequencer()
    const characteristic: DeviceCharacteristicRef = {
      serviceId: 'profile-service',
      characteristicId: 'profile-events',
    }
    const backingBytes = new Uint8Array([99, 10, 20, 88])
    const incomingView = backingBytes.subarray(1, 3)

    const first = sequencer.create({
      payload: incomingView,
      characteristic,
      source: 'notification',
      receivedAt: '2026-08-02T09:01:00.000Z',
    })
    const second = sequencer.create({
      payload: new Uint8Array([30]),
      characteristic,
      source: 'read',
      receivedAt: '2026-08-02T09:01:01.000Z',
    })
    backingBytes[1] = 255

    expect(first).toEqual({
      payload: new Uint8Array([10, 20]),
      sequence: 1,
      characteristic,
      source: 'notification',
      receivedAt: '2026-08-02T09:01:00.000Z',
    })
    expect(second.sequence).toBe(2)
    expect(second.source).toBe('read')
  })

  it('allows normalized adapter events to extend without exposing transport frames', () => {
    const received: ExtendedDeviceEvent[] = []
    const session: DeviceSession<ExtendedDeviceEvent> = {
      sessionId: 'device-session-extended',
      device: {
        deviceId: 'device-wearable-1',
        category: 'wearable',
        adapterId: 'extended-event-adapter',
      },
      capabilities: capabilityReport,
      getState: () => 'open',
      subscribe: (listener) => {
        listener({
          eventId: 'event-audio-1',
          deviceId: 'device-wearable-1',
          sessionId: 'device-session-extended',
          kind: 'audio_chunk',
          occurredAt: '2026-08-02T09:03:00.000Z',
          source: 'physical',
          mediaReferenceId: 'media-reference-1',
          codec: 'configured-codec',
        })
        listener({
          eventId: 'event-parse-1',
          deviceId: 'device-wearable-1',
          sessionId: 'device-session-extended',
          kind: 'parse_failure',
          occurredAt: '2026-08-02T09:03:01.000Z',
          source: 'physical',
          errorCode: 'invalid_data',
          message: 'Configured profile rejected the frame.',
        })
        return ok({
          subscriptionId: 'extended-subscription-1',
          unsubscribe: () => undefined,
        })
      },
      execute: async (command) => {
        const capability = requireCommandCapability(command, capabilityReport)
        if (!capability.ok) return capability
        return ok({
          commandId: command.commandId,
          sessionId: 'device-session-extended',
          status: 'completed',
          acknowledgedAt: '2026-08-02T09:03:02.000Z',
        })
      },
      close: async () => ok(undefined),
    }

    session.subscribe((event) => received.push(event))

    expect(received.map((event) => event.kind)).toEqual([
      'audio_chunk',
      'parse_failure',
    ])
    expect(received[0]).not.toHaveProperty('payload')
    expect(received[0]).not.toHaveProperty('characteristic')
  })

  it('lets adapters match normalized advertised services without raw advertisements', () => {
    const adapter: DeviceAdapter = {
      adapterId: 'service-matching-adapter',
      matches: (device) =>
        device.advertisedServiceIds?.includes('profile-service') ?? false,
      openSession: async () =>
        capabilityUnavailable('interaction_events', {
          status: 'requires_vendor_profile',
          reason: 'This fixture only validates discovery matching.',
        }),
    }

    expect(adapter.matches(discoveredRing)).toBe(true)
    expect(
      adapter.matches({ ...discoveredRing, advertisedServiceIds: [] }),
    ).toBe(false)
    expect(discoveredRing).not.toHaveProperty('advertisementPayload')
    expect(discoveredRing).not.toHaveProperty('manufacturerData')
  })

  it('supports a vendor-neutral discovery, transport, adapter, and command lifecycle', async () => {
    let transportState: ReturnType<DeviceTransport['getState']> = 'idle'
    let sessionState: ReturnType<DeviceSession['getState']> = 'opening'
    const events: NormalizedDeviceEvent[] = []
    const subscriptions = new Map<string, (event: NormalizedDeviceEvent) => void>()
    const frameSequencer = createDeviceTransportFrameSequencer()
    const characteristic: DeviceCharacteristicRef = {
      serviceId: 'profile-service',
      characteristicId: 'profile-events',
    }
    let discoveryState: 'active' | 'stopped' = 'active'
    let discoveryStopCount = 0
    let transportCloseCount = 0
    let transportSessionCloseCount = 0
    let deviceSessionCloseCount = 0
    let notificationStopCount = 0
    const closeOrder: string[] = []

    const transportSubscription: DeviceTransportNotificationSubscription = {
      subscriptionId: 'transport-subscription-1',
      unsubscribe: async () => {
        if (notificationStopCount === 0) notificationStopCount += 1
        return ok(undefined)
      },
    }
    const transportSession: DeviceTransportSession = {
      sessionId: 'transport-session-1',
      device: discoveredRing,
      getState: () => 'connected',
      read: async (target) =>
        ok(
          frameSequencer.create({
            payload: new Uint8Array([1, 2]),
            characteristic: target,
            source: 'read',
            receivedAt: '2026-08-02T09:01:30.000Z',
          }),
        ),
      write: async () => ok(undefined),
      subscribe: async (target, listener) => {
        listener(
          frameSequencer.create({
            payload: new Uint8Array([3, 4]),
            characteristic: target,
            source: 'notification',
            receivedAt: '2026-08-02T09:01:31.000Z',
          }),
        )
        return ok(transportSubscription)
      },
      close: async () => {
        if (transportSessionCloseCount === 0) {
          transportSessionCloseCount += 1
          closeOrder.push('transport_session')
        }
        return ok(undefined)
      },
    }
    const transport: DeviceTransport = {
      transportId: 'transport-ble-1',
      kind: 'bluetooth_low_energy',
      getState: () => transportState,
      open: async () => {
        transportState = 'open'
        return ok(undefined)
      },
      startDiscovery: async (request, listener) => {
        expect(request.filters).toEqual([
          {
            services: ['profile-service'],
            namePrefix: 'Loop',
          },
        ])
        listener(discoveredRing)
        const stop = async () => {
          if (discoveryState !== 'stopped') {
            discoveryState = 'stopped'
            discoveryStopCount += 1
          }
          return ok(undefined)
        }
        request.signal?.addEventListener('abort', () => void stop(), {
          once: true,
        })
        return ok({
          discoverySessionId: 'discovery-session-1',
          getState: () => discoveryState,
          stop,
        })
      },
      connect: async (request) => {
        expect(request.device).toBe(discoveredRing)
        expect(request.timeoutMs).toBe(5_000)
        expect(request.signal?.aborted).toBe(false)
        return ok(transportSession)
      },
      close: async () => {
        if (transportCloseCount === 0) {
          transportCloseCount += 1
          await transportSession.close()
          closeOrder.push('transport')
        }
        transportState = 'closed'
        return ok(undefined)
      },
    }

    const deviceSession: DeviceSession = {
      sessionId: 'device-session-1',
      device: {
        deviceId: 'device-ring-1',
        displayName: 'Loop ring',
        category: 'ring',
        adapterId: 'generic-wearable-adapter',
      },
      capabilities: capabilityReport,
      getState: () => sessionState,
      subscribe: (listener) => {
        subscriptions.set('device-subscription-1', listener)
        return ok({
          subscriptionId: 'device-subscription-1',
          unsubscribe: () => subscriptions.delete('device-subscription-1'),
        })
      },
      execute: async (
        command,
      ): Promise<DeviceResult<CommandAcknowledgement>> => {
        const capability = requireCommandCapability(command, capabilityReport)
        if (!capability.ok) return capability
        return ok({
          commandId: command.commandId,
          sessionId: 'device-session-1',
          status: 'completed',
          acknowledgedAt: '2026-08-02T09:02:00.000Z',
        })
      },
      close: async () => {
        if (sessionState === 'closed') return ok(undefined)
        sessionState = 'closing'
        const closed = await transportSession.close()
        if (!closed.ok) return closed
        deviceSessionCloseCount += 1
        sessionState = 'closed'
        closeOrder.push('device_session')
        return ok(undefined)
      },
    }
    const adapter: DeviceAdapter = {
      adapterId: 'generic-wearable-adapter',
      matches: (device) =>
        device.connectable &&
        (device.advertisedServiceIds?.includes('profile-service') ?? false),
      openSession: async (session) => {
        expect(session).toBe(transportSession)
        sessionState = 'open'
        return ok(deviceSession)
      },
    }

    expect(await transport.open()).toEqual(ok(undefined))
    const discovered: DiscoveredDevice[] = []
    const discoveryAbort = new AbortController()
    const discovery = await transport.startDiscovery(
      {
        filters: [
          {
            services: ['profile-service'],
            namePrefix: 'Loop',
          },
        ],
        timeoutMs: 3_000,
        signal: discoveryAbort.signal,
      },
      (device) => discovered.push(device),
    )
    expect(discovery.ok).toBe(true)
    expect(discovered).toEqual([discoveredRing])
    expect(adapter.matches(discovered[0])).toBe(true)
    discoveryAbort.abort()
    if (discovery.ok) {
      await discovery.value.stop()
      expect(discovery.value.getState()).toBe('stopped')
    }
    expect(discoveryStopCount).toBe(1)

    const connectAbort = new AbortController()
    const connection = await transport.connect({
      device: discovered[0],
      timeoutMs: 5_000,
      signal: connectAbort.signal,
    })
    expect(connection.ok).toBe(true)
    if (!connection.ok) return

    const read = await connection.value.read(characteristic, {
      timeoutMs: 1_000,
    })
    expect(read).toMatchObject({
      ok: true,
      value: {
        sequence: 1,
        source: 'read',
        characteristic,
        payload: new Uint8Array([1, 2]),
      },
    })
    await expect(
      connection.value.write({
        characteristic,
        payload: new Uint8Array([9]),
        mode: 'with_response',
        timeoutMs: 1_000,
      }),
    ).resolves.toEqual(ok(undefined))
    const frames: number[] = []
    const notification = await connection.value.subscribe(
      characteristic,
      (frame) => frames.push(frame.sequence),
      { timeoutMs: 1_000 },
    )
    expect(frames).toEqual([2])
    if (notification.ok) {
      await notification.value.unsubscribe()
      await notification.value.unsubscribe()
    }
    expect(notificationStopCount).toBe(1)

    const opened = await adapter.openSession(connection.value)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const subscription = opened.value.subscribe((event) => events.push(event))
    expect(subscription.ok).toBe(true)

    const command: DeviceCommand = {
      commandId: 'command-1',
      kind: 'haptic_feedback',
      issuedAt: '2026-08-02T09:02:00.000Z',
      pattern: 'acknowledge',
    }
    expect(commandCapability(command)).toBe('haptic_feedback')
    await expect(opened.value.execute(command)).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'capability_unavailable',
        capabilityId: 'haptic_feedback',
        capabilityState: 'requires_vendor_profile',
      },
    })

    await expect(opened.value.close()).resolves.toEqual(ok(undefined))
    await expect(opened.value.close()).resolves.toEqual(ok(undefined))
    expect(deviceSessionCloseCount).toBe(1)
    expect(transportSessionCloseCount).toBe(1)
    expect(closeOrder).toEqual(['transport_session', 'device_session'])
    await expect(transport.close()).resolves.toEqual(ok(undefined))
    await expect(transport.close()).resolves.toEqual(ok(undefined))
    expect(transportSessionCloseCount).toBe(1)
    expect(transportCloseCount).toBe(1)
    expect(closeOrder).toEqual([
      'transport_session',
      'device_session',
      'transport',
    ])
    expect(transport.getState()).toBe('closed')
  })
})
