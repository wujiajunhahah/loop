import { describe, expect, it } from 'vitest'
import type {
  DeviceCharacteristicRef,
  DeviceResult,
  DeviceTransportFrameListener,
  DeviceTransportNotificationSubscription,
  DeviceTransportSession,
  DiscoveredDevice,
} from '../../contracts'
import {
  createRingFrameParser,
  type RingFrameParser,
} from './parser'
import {
  createEmptyRingProfile,
  createRingProfile,
  type RingProfile,
} from './profile'
import { createRingAdapter, type RingAdapterEvent } from './adapter'
import {
  RING_FIXTURE_PROVENANCE,
  createRingFrame,
  createRingFixtureProfile,
} from './fixtures'

const RECEIVED_AT = '2026-08-03T12:00:00.000Z'

const ok = <T>(value: T): DeviceResult<T> => ({ ok: true, value })

function createFixtureProfile(
  role: 'heart_rate' | 'ppg' = 'heart_rate',
): RingProfile {
  return createRingFixtureProfile({ role })
}

function createSingleRoleProfile(
  role: 'wear' | 'history_sync',
  parser: RingFrameParser,
): RingProfile {
  return createRingProfile({
    profileId: `fixture-ring-${role}-v1`,
    provenance: {
      sourceReference: `fixture:ring:${role}:v1`,
      sourceUrl: `https://example.test/ring-profile/${role}-v1`,
      validation: 'fixture_only',
    },
    constraints: {
      model: { exact: 'Fixture Ring' },
      firmware: { exact: 'fixture-1.0.0' },
    },
    discovery: {
      serviceIds: ['fixture-service'],
      names: ['Fixture Ring'],
    },
    roles: {
      [role]: {
        capability: { status: 'implemented' },
        gatt: {
          serviceId: 'fixture-service',
          characteristicId: `fixture-${role}`,
        },
        source: 'notification',
        parser,
      },
    },
  })
}

function createCommandFixtureProfile(): RingProfile {
  const fixture = createFixtureProfile()
  return createRingProfile({
    ...fixture,
    capabilities: {
      ...fixture.capabilities,
      commands: 'implemented',
    },
    roles: {
      ...fixture.roles,
      commands: {
        capability: { status: 'implemented' },
        commands: [
          {
            commandKind: 'haptic_feedback',
            characteristic: {
              serviceId: 'fixture-command-service',
              characteristicId: 'fixture-command-characteristic',
            },
            mode: 'with_response',
            encode: () => new Uint8Array([0xa5]),
          },
        ],
      },
    },
  })
}

interface FakeTransportSession {
  session: DeviceTransportSession
  emit(bytes: Uint8Array, receivedAt?: string): void
  calls: string[]
  subscribeCount(): number
  unsubscribeCount(): number
  closeCount(): number
  writeCount(): number
  writtenPayloads(): readonly Uint8Array[]
}

function createFakeTransportSession(
  profile: RingProfile,
  options: { sessionId?: string; allowWrites?: boolean } = {},
): FakeTransportSession {
  const calls: string[] = []
  let listener: DeviceTransportFrameListener | undefined
  let sequence = 0
  let subscriptions = 0
  let unsubscriptions = 0
  let closes = 0
  let writes = 0
  const writtenPayloads: Uint8Array[] = []
  let state: ReturnType<DeviceTransportSession['getState']> = 'connected'
  const configuredCharacteristic = Object.values(profile.roles).find(
    (definition) => definition?.gatt !== undefined,
  )?.gatt ?? {
    serviceId: 'unused-service',
    characteristicId: 'unused-characteristic',
  }

  const device: DiscoveredDevice = {
    discoveryId: 'opaque-ring-device',
    transportId: 'ble-fixture',
    transportKind: 'bluetooth_low_energy',
    displayName: 'Fixture Ring',
    advertisedServiceIds: [configuredCharacteristic.serviceId],
    connectable: true,
    discoveredAt: RECEIVED_AT,
  }

  const sameCharacteristic = (actual: DeviceCharacteristicRef) =>
    actual.serviceId.toLowerCase() === configuredCharacteristic.serviceId.toLowerCase() &&
    actual.characteristicId.toLowerCase() === configuredCharacteristic.characteristicId.toLowerCase()

  const session: DeviceTransportSession = {
    sessionId: options.sessionId ?? 'ring-transport-session',
    device,
    getState: () => state,
    read: async () => ({
      ok: false,
      error: {
        code: 'read_failed',
        message: 'Fixture reads are unavailable.',
        retryable: false,
      },
    }),
    write: async (request) => {
      calls.push('write')
      if (!options.allowWrites) {
        return {
          ok: false,
          error: {
            code: 'write_failed' as const,
            message: 'Fixture writes are unavailable.',
            retryable: false,
          },
        }
      }
      writes += 1
      writtenPayloads.push(new Uint8Array(request.payload))
      return ok(undefined)
    },
    subscribe: async (characteristic, nextListener) => {
      calls.push('subscribe')
      if (!sameCharacteristic(characteristic)) {
        return {
          ok: false,
          error: {
            code: 'notification_failed',
            message: 'Fixture characteristic is unavailable.',
            retryable: false,
          },
        }
      }
      subscriptions += 1
      listener = nextListener
      let stopped = false
      const subscription: DeviceTransportNotificationSubscription = {
        subscriptionId: `ring-notification-${subscriptions}`,
        unsubscribe: async () => {
          if (!stopped) {
            stopped = true
            unsubscriptions += 1
            listener = undefined
          }
          return ok(undefined)
        },
      }
      return ok(subscription)
    },
    close: async () => {
      if (state !== 'disconnected') {
        state = 'disconnected'
        closes += 1
      }
      return ok(undefined)
    },
  }

  return {
    session,
    calls,
    emit(bytes, receivedAt = RECEIVED_AT) {
      listener?.({
        payload: new Uint8Array(bytes),
        sequence: ++sequence,
        characteristic: configuredCharacteristic,
        source: 'notification',
        receivedAt,
      })
    },
    subscribeCount: () => subscriptions,
    unsubscribeCount: () => unsubscriptions,
    closeCount: () => closes,
    writeCount: () => writes,
    writtenPayloads: () => writtenPayloads,
  }
}

describe('ring profile foundation', () => {
  it('has no enabled roles or native subscriptions without a configured profile', async () => {
    const profile = createEmptyRingProfile()
    const adapter = createRingAdapter(profile)
    const device: DiscoveredDevice = {
      discoveryId: 'empty-ring-device',
      transportId: 'ble-fixture',
      transportKind: 'bluetooth_low_energy',
      displayName: 'Unknown Ring',
      connectable: true,
      discoveredAt: RECEIVED_AT,
    }

    const transport = createFakeTransportSession(profile)
    const opened = await adapter.openSession(transport.session)

    expect(Object.values(profile.roles)).toHaveLength(0)
    expect(adapter.matches(device)).toBe(false)
    expect(opened.ok).toBe(true)
    expect(transport.subscribeCount()).toBe(0)
    expect(profile.capabilities.spo2.status).toBe('requires_vendor_profile')
    expect(profile.capabilities.spo2.reason).not.toContain('0')
  })

  it('preserves source provenance for one explicitly configured role', () => {
    const profile = createFixtureProfile()

    expect(profile.provenance).toEqual(RING_FIXTURE_PROVENANCE)
    expect(profile.constraints).toEqual({
      model: { exact: 'Fixture Ring' },
      firmware: { exact: 'fixture-1.0.0' },
    })
    expect(profile.roles.heart_rate?.capability.status).toBe('implemented')
  })
})

describe('ring frame parser', () => {
  it('applies only injected bounds, signedness, scaling, units, and checksum rules', () => {
    const parser = createRingFrameParser({
      role: 'heart_rate',
      rules: {
        fields: [
          {
            name: 'heart_rate',
            offset: 0,
            byteLength: 2,
            signed: true,
            endianness: 'little_endian',
            scale: 0.5,
            unit: 'bpm',
            min: -50,
            max: 100,
          },
        ],
        checksum: {
          offset: 2,
          byteLength: 1,
          endianness: 'little_endian',
          calculate: (bytes) => (bytes[0] ?? 0) ^ (bytes[1] ?? 0),
        },
      },
      output: { kind: 'metric', name: 'heart_rate', valueField: 'heart_rate' },
    })

    const parsed = parser({
      bytes: new Uint8Array([0x06, 0x00, 0x06]),
      transportSequence: 1,
      receivedAt: RECEIVED_AT,
      source: 'notification',
    })

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        kind: 'metric',
        metric: { name: 'heart_rate', value: 3, unit: 'bpm' },
      },
    })
  })

  it('rejects injected bounds and checksum failures without exposing raw values', () => {
    const parser: RingFrameParser = createRingFrameParser({
      role: 'heart_rate',
      rules: {
        fields: [
          {
            name: 'heart_rate',
            offset: 0,
            byteLength: 1,
            signed: false,
            endianness: 'little_endian',
            min: 30,
            max: 220,
            unit: 'bpm',
          },
        ],
        checksum: {
          offset: 1,
          byteLength: 1,
          endianness: 'little_endian',
          calculate: (bytes) => (bytes[0] ?? 0) + 1,
        },
      },
      output: { kind: 'metric', name: 'heart_rate', valueField: 'heart_rate' },
    })

    const outOfBounds = parser({
      bytes: new Uint8Array([1, 2]),
      transportSequence: 1,
      receivedAt: RECEIVED_AT,
      source: 'notification',
    })
    const badChecksum = parser({
      bytes: new Uint8Array([80, 0]),
      transportSequence: 2,
      receivedAt: RECEIVED_AT,
      source: 'notification',
    })

    expect(outOfBounds).toMatchObject({
      ok: false,
      failure: { code: 'value_out_of_bounds', retryable: false },
    })
    expect(badChecksum).toMatchObject({
      ok: false,
      failure: { code: 'checksum_mismatch', retryable: false },
    })
    const serialized = JSON.stringify({ outOfBounds, badChecksum })
    expect(serialized).not.toContain('80')
    expect(serialized).not.toContain('raw')
    expect(serialized).not.toContain('payload')
  })
})

describe('ring adapter session', () => {
  it('matches only connectable BLE devices using configured hints', () => {
    const adapter = createRingAdapter(createFixtureProfile())
    const base: DiscoveredDevice = {
      discoveryId: 'ring-discovery',
      transportId: 'ble',
      transportKind: 'bluetooth_low_energy',
      connectable: true,
      discoveredAt: RECEIVED_AT,
    }
    const service = createFixtureProfile().roles.heart_rate?.gatt?.serviceId
    if (service === undefined) throw new Error('Fixture service is required')

    expect(adapter.matches({ ...base, advertisedServiceIds: [service] })).toBe(true)
    expect(adapter.matches({ ...base, displayName: 'Fixture Ring' })).toBe(true)
    expect(adapter.matches({ ...base, displayName: 'Other Ring' })).toBe(false)
    expect(adapter.matches({ ...base, connectable: false, displayName: 'Fixture Ring' })).toBe(false)
    expect(adapter.matches({ ...base, transportKind: 'simulated', displayName: 'Fixture Ring' })).toBe(false)
  })

  it('fans out parsed events, keeps parse failures local, and redacts errors', async () => {
    const transport = createFakeTransportSession(createFixtureProfile())
    const opened = await createRingAdapter(createFixtureProfile()).openSession(transport.session)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const events: RingAdapterEvent[] = []
    opened.value.subscribe((event) => events.push(event))
    opened.value.subscribe(() => {
      throw new Error('consumer failure')
    })
    transport.emit(createRingFrame([80]))
    transport.emit(new Uint8Array([0xff]))

    expect(events.map((event) => event.kind)).toEqual(['metric', 'parse_failure'])
    expect(events[0]).toMatchObject({
      kind: 'metric',
      metric: {
        role: 'heart_rate',
        contextStrength: 'weak',
        interpretationPolicy: 'no_emotion_grief_or_health_inference',
        provenance: { sourceReference: RING_FIXTURE_PROVENANCE.sourceReference },
      },
    })
    expect(events[1]).toMatchObject({
      kind: 'parse_failure',
      failure: { code: 'value_out_of_bounds', message: 'The ring frame value is outside the configured bounds.' },
    })
    expect(JSON.stringify(events[1])).not.toContain('255')
    expect(JSON.stringify(events[1])).not.toContain('payload')
    expect(opened.value.getState()).toBe('open')
  })

  it('keeps raw PPG values local and requires explicit consent for export', async () => {
    const profile = createFixtureProfile('ppg')
    const transport = createFakeTransportSession(profile)
    const opened = await createRingAdapter(profile).openSession(transport.session)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const events: RingAdapterEvent[] = []
    opened.value.subscribe((event) => events.push(event))
    transport.emit(createRingFrame([127]))

    expect(events[0]).toMatchObject({
      kind: 'metric',
      metric: {
        role: 'ppg',
        privacy: 'local_only',
        exportConsentRequired: true,
      },
    })
    expect(events[0]).not.toHaveProperty('metric.value')
    expect(JSON.stringify(events[0])).not.toContain('127')
  })

  it('forces raw roles local-only even when an injected parser is misconfigured', async () => {
    const fixture = createFixtureProfile('ppg')
    const profile = createRingProfile({
      ...fixture,
      roles: {
        ppg: {
          ...fixture.roles.ppg!,
          parser: () => ({
            ok: true,
            value: {
              kind: 'metric',
              metric: {
                role: 'ppg',
                name: 'raw-127',
                value: 127,
                privacy: 'normalized',
                exportConsentRequired: false,
              },
            },
          }),
        },
      },
    })
    const transport = createFakeTransportSession(profile)
    const opened = await createRingAdapter(profile).openSession(transport.session)
    if (!opened.ok) throw new Error('Expected PPG fixture to open')
    const events: RingAdapterEvent[] = []
    opened.value.subscribe((event) => events.push(event))
    transport.emit(createRingFrame([127]))

    expect(events[0]).toMatchObject({
      kind: 'metric',
      metric: {
        role: 'ppg',
        name: 'ppg',
        privacy: 'local_only',
        exportConsentRequired: true,
      },
    })
    expect(events[0]).not.toHaveProperty('metric.value')
    expect(JSON.stringify(events[0])).not.toContain('127')
  })

  it('normalizes status and history with weak-context provenance', async () => {
    const statusProfile = createSingleRoleProfile('wear', () => ({
      ok: true,
      value: { kind: 'status', role: 'wear', status: 'worn' },
    }))
    const statusTransport = createFakeTransportSession(statusProfile)
    const statusSession = await createRingAdapter(statusProfile).openSession(
      statusTransport.session,
    )
    if (!statusSession.ok) throw new Error('Expected status fixture to open')
    const statusEvents: RingAdapterEvent[] = []
    statusSession.value.subscribe((event) => statusEvents.push(event))
    statusTransport.emit(createRingFrame([1]))

    const historyProfile = createSingleRoleProfile('history_sync', () => ({
      ok: true,
      value: {
        kind: 'history',
        role: 'history_sync',
        record: { recordType: 'activity', steps: 12 },
      },
    }))
    const historyTransport = createFakeTransportSession(historyProfile)
    const historySession = await createRingAdapter(historyProfile).openSession(
      historyTransport.session,
    )
    if (!historySession.ok) throw new Error('Expected history fixture to open')
    const historyEvents: RingAdapterEvent[] = []
    historySession.value.subscribe((event) => historyEvents.push(event))
    historyTransport.emit(createRingFrame([2]))

    expect(statusEvents[0]).toMatchObject({
      kind: 'status',
      status: {
        role: 'wear',
        value: 'worn',
        contextStrength: 'weak',
        interpretationPolicy: 'no_emotion_grief_or_health_inference',
        provenance: { sourceReference: 'fixture:ring:wear:v1' },
      },
    })
    expect(historyEvents[0]).toMatchObject({
      kind: 'history',
      history: {
        role: 'history_sync',
        record: { recordType: 'activity', steps: 12 },
        contextStrength: 'weak',
        interpretationPolicy: 'no_emotion_grief_or_health_inference',
        provenance: { sourceReference: 'fixture:ring:history_sync:v1' },
      },
    })
  })

  it('redacts errors thrown by injected parsers and invalid profiles', async () => {
    const fixture = createFixtureProfile()
    const throwingProfile = createRingProfile({
      ...fixture,
      roles: {
        heart_rate: {
          ...fixture.roles.heart_rate!,
          parser: () => {
            throw new Error('opaque-ring-device packet 255 heart-rate 80')
          },
        },
      },
    })
    const transport = createFakeTransportSession(throwingProfile)
    const opened = await createRingAdapter(throwingProfile).openSession(
      transport.session,
    )
    if (!opened.ok) throw new Error('Expected throwing parser fixture to open')
    const events: RingAdapterEvent[] = []
    opened.value.subscribe((event) => events.push(event))
    transport.emit(createRingFrame([80]))

    expect(events[0]).toMatchObject({
      kind: 'parse_failure',
      failure: {
        code: 'invalid_parser_config',
        message: 'The configured ring parser is invalid.',
      },
    })
    expect(JSON.stringify(events[0])).not.toContain('opaque-ring-device')
    expect(JSON.stringify(events[0])).not.toContain('255')
    expect(JSON.stringify(events[0])).not.toContain('80')

    const invalidProfile = createRingProfile({
      profileId: 'opaque-ring-device',
      provenance: {
        sourceReference: 'packet-255-heart-rate-80',
        validation: 'fixture_only',
      },
      discovery: fixture.discovery,
      roles: fixture.roles,
    })
    const invalidTransport = createFakeTransportSession(invalidProfile)
    const invalid = await createRingAdapter(invalidProfile).openSession(
      invalidTransport.session,
    )
    expect(invalid).toEqual({
      ok: false,
      error: {
        code: 'invalid_data',
        message: 'The ring frame or profile data is invalid.',
        retryable: false,
      },
    })
  })

  it('rejects commands until a reviewed encoder is injected', async () => {
    const profile = createFixtureProfile()
    const transport = createFakeTransportSession(profile)
    const opened = await createRingAdapter(profile).openSession(transport.session)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const rejected = await opened.value.execute({
      commandId: 'command-fixture',
      kind: 'request_status',
      issuedAt: RECEIVED_AT,
    })

    expect(rejected).toMatchObject({
      ok: false,
      error: {
        code: 'capability_unavailable',
        capabilityId: 'status_reporting',
        capabilityState: 'requires_vendor_profile',
      },
    })
    expect(transport.calls).not.toContain('write')
  })

  it('writes only bytes returned by an explicitly injected command encoder', async () => {
    const profile = createCommandFixtureProfile()
    const transport = createFakeTransportSession(profile, { allowWrites: true })
    const opened = await createRingAdapter(profile).openSession(transport.session)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const acknowledged = await opened.value.execute({
      commandId: 'reviewed-command-fixture',
      kind: 'haptic_feedback',
      issuedAt: RECEIVED_AT,
      pattern: 'acknowledge',
    })

    expect(acknowledged).toMatchObject({
      ok: true,
      value: { status: 'accepted', commandId: 'reviewed-command-fixture' },
    })
    expect(transport.writeCount()).toBe(1)
    expect(transport.writtenPayloads()).toEqual([new Uint8Array([0xa5])])
  })

  it('reports real-device requirements when a command encoder exists but is unvalidated', async () => {
    const fixture = createCommandFixtureProfile()
    const profile = createRingProfile({
      ...fixture,
      capabilities: {
        ...fixture.capabilities,
        commands: 'requires_real_device',
      },
      roles: {
        ...fixture.roles,
        commands: {
          ...fixture.roles.commands!,
          capability: { status: 'requires_real_device' },
        },
      },
    })
    const transport = createFakeTransportSession(profile)
    const opened = await createRingAdapter(profile).openSession(transport.session)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const rejected = await opened.value.execute({
      commandId: 'unvalidated-command',
      kind: 'haptic_feedback',
      issuedAt: RECEIVED_AT,
      pattern: 'attention',
    })
    expect(rejected).toMatchObject({
      ok: false,
      error: {
        code: 'capability_unavailable',
        capabilityState: 'requires_real_device',
      },
    })
    expect(transport.calls).not.toContain('write')
  })

  it('redacts rejected writes and waits for an in-flight write before close', async () => {
    const profile = createCommandFixtureProfile()
    const throwingTransport = createFakeTransportSession(profile, {
      allowWrites: true,
    })
    throwingTransport.session.write = async () => {
      throw new Error('opaque-ring-device packet 255')
    }
    const throwingSession = await createRingAdapter(profile).openSession(
      throwingTransport.session,
    )
    if (!throwingSession.ok) throw new Error('Expected command fixture to open')
    const rejected = await throwingSession.value.execute({
      commandId: 'throwing-command',
      kind: 'haptic_feedback',
      issuedAt: RECEIVED_AT,
      pattern: 'attention',
    })
    expect(rejected).toEqual({
      ok: false,
      error: {
        code: 'write_failed',
        message: 'The ring command write failed.',
        retryable: false,
      },
    })

    const deferredTransport = createFakeTransportSession(profile, {
      allowWrites: true,
    })
    let resolveWrite: ((result: DeviceResult<void>) => void) | undefined
    deferredTransport.session.write = () =>
      new Promise((resolve) => {
        resolveWrite = resolve
      })
    const deferredSession = await createRingAdapter(profile).openSession(
      deferredTransport.session,
    )
    if (!deferredSession.ok) throw new Error('Expected deferred command fixture to open')
    const executing = deferredSession.value.execute({
      commandId: 'deferred-command',
      kind: 'haptic_feedback',
      issuedAt: RECEIVED_AT,
      pattern: 'acknowledge',
    })
    let closeSettled = false
    const closing = deferredSession.value.close().then((result) => {
      closeSettled = true
      return result
    })
    await Promise.resolve()
    const closeStateBeforeWrite = {
      settled: closeSettled,
      closeCount: deferredTransport.closeCount(),
    }
    resolveWrite?.(ok(undefined))
    await executing
    await closing

    expect(closeStateBeforeWrite).toEqual({ settled: false, closeCount: 0 })
    expect(deferredTransport.closeCount()).toBe(1)
  })

  it('honors capability overrides and propagates real-device requirements', async () => {
    const fixture = createFixtureProfile()
    const disabledProfile = createRingProfile({
      ...fixture,
      capabilities: {
        ...fixture.capabilities,
        heart_rate: 'requires_vendor_profile',
      },
    })
    const disabledTransport = createFakeTransportSession(disabledProfile)
    const disabled = await createRingAdapter(disabledProfile).openSession(
      disabledTransport.session,
    )
    expect(disabled.ok).toBe(true)
    expect(disabledTransport.subscribeCount()).toBe(0)
    if (disabled.ok) {
      expect(disabled.value.ringCapabilities.heart_rate.status).toBe(
        'requires_vendor_profile',
      )
    }

    const physicalProfile = createRingProfile({
      profileId: 'ring-physical-validation-pending',
      provenance: {
        sourceReference: 'reviewed-profile-pending-device-validation',
        validation: 'fixture_only',
      },
      capabilities: { heart_rate: 'requires_real_device' },
    })
    const physicalTransport = createFakeTransportSession(physicalProfile)
    const physical = await createRingAdapter(physicalProfile).openSession(
      physicalTransport.session,
    )
    expect(physical.ok).toBe(true)
    if (physical.ok) {
      expect(physical.value.capabilities.telemetry.status).toBe(
        'requires_real_device',
      )
      const unsupportedCommand = await physical.value.execute({
        commandId: 'missing-encoder',
        kind: 'request_telemetry',
        category: 'physiological',
        issuedAt: RECEIVED_AT,
      })
      expect(unsupportedCommand).toMatchObject({
        ok: false,
        error: {
          code: 'capability_unavailable',
          capabilityState: 'requires_vendor_profile',
        },
      })
    }
    expect(physicalTransport.subscribeCount()).toBe(0)
  })

  it('rejects read-only implemented roles and blank matching constraints', async () => {
    const fixture = createFixtureProfile()
    const readProfile = createRingProfile({
      ...fixture,
      roles: {
        heart_rate: {
          ...fixture.roles.heart_rate!,
          source: 'read',
        },
      },
    })
    const readTransport = createFakeTransportSession(readProfile)
    const readOpened = await createRingAdapter(readProfile).openSession(
      readTransport.session,
    )
    expect(readOpened).toMatchObject({
      ok: false,
      error: { code: 'invalid_data', retryable: false },
    })
    expect(readTransport.calls).toEqual([])

    const blankProfile = createRingProfile({
      ...fixture,
      constraints: {
        model: { exact: ' ' },
        firmware: { exact: '' },
      },
      discovery: { namePrefixes: [''] },
    })
    const blankAdapter = createRingAdapter(blankProfile)
    const blankTransport = createFakeTransportSession(blankProfile)
    expect(blankAdapter.matches(blankTransport.session.device)).toBe(false)
    expect(await blankAdapter.openSession(blankTransport.session)).toMatchObject({
      ok: false,
      error: { code: 'invalid_data', retryable: false },
    })
  })

  it('does not subscribe unavailable roles and closes duplicate calls idempotently', async () => {
    const profile = createRingProfile({
      ...createFixtureProfile(),
      roles: {
        ...createFixtureProfile().roles,
        battery: {
          ...createFixtureProfile().roles.heart_rate,
          capability: { status: 'requires_vendor_profile' },
        },
      },
    })
    const transport = createFakeTransportSession(profile)
    const opened = await createRingAdapter(profile).openSession(transport.session)

    expect(opened.ok).toBe(true)
    expect(transport.subscribeCount()).toBe(1)
    if (!opened.ok) return

    const [firstClose, secondClose] = await Promise.all([
      opened.value.close(),
      opened.value.close(),
    ])
    expect(firstClose).toEqual(ok(undefined))
    expect(secondClose).toEqual(ok(undefined))
    expect(transport.unsubscribeCount()).toBe(1)
    expect(transport.closeCount()).toBe(1)
  })

  it('rejects duplicate opens and reconnects with a fresh session sequence', async () => {
    const profile = createFixtureProfile()
    const adapter = createRingAdapter(profile)
    const firstTransport = createFakeTransportSession(profile, { sessionId: 'same' })
    const first = await adapter.openSession(firstTransport.session)
    const duplicate = await adapter.openSession(firstTransport.session)
    expect(first.ok).toBe(true)
    expect(duplicate).toMatchObject({ ok: false, error: { code: 'protocol_error' } })
    expect(firstTransport.subscribeCount()).toBe(1)
    if (!first.ok) return
    const firstEvents: RingAdapterEvent[] = []
    first.value.subscribe((event) => firstEvents.push(event))
    firstTransport.emit(createRingFrame([80]))
    expect(firstEvents[0]).toMatchObject({ sessionSequence: 1 })
    await first.value.close()

    const secondTransport = createFakeTransportSession(profile, { sessionId: 'same' })
    const second = await adapter.openSession(secondTransport.session)
    expect(second.ok).toBe(true)
    if (!second.ok) return

    const events: RingAdapterEvent[] = []
    second.value.subscribe((event) => events.push(event))
    secondTransport.emit(createRingFrame([81]))
    expect(second.value.sessionId).not.toBe(first.value.sessionId)
    expect(events[0]).toMatchObject({ sessionSequence: 1 })
  })
})
