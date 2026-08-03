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
  createOfficialOmiAudioProfile,
  OFFICIAL_OMI_AUDIO_PROFILE,
} from './profile'
import {
  createOmiAudioStreamParser,
  type OmiAudioParserInput,
} from './parser'
import { createOmiAudioAdapter, type OmiAdapterEvent } from './adapter'
import {
  OMI_AUDIO_FIXTURE_PROVENANCE,
  OMI_COMPLETE_FRAME,
  OMI_FRAGMENTED_PACKET,
  omiAudioFrame,
} from './fixtures'

const RECEIVED_AT = '2026-08-02T12:00:00.000Z'
const FIRMWARE = {
  model: 'Omi protocol-derived synthetic fixture; no physical device',
  version: 'unspecified',
  validation: 'fixture_only' as const,
}
const FRAMING = {
  payloadBytesByFragmentIndex: { 0: 4, 1: 2, 2: 4 },
}

const ok = <T>(value: T): DeviceResult<T> => ({ ok: true, value })

function concat(...chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    chunks.reduce((length, chunk) => length + chunk.byteLength, 0),
  )
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

function parserInput(
  bytes: Uint8Array,
  transportSequence = 1,
): OmiAudioParserInput {
  return {
    bytes,
    transportSequence,
    receivedAt: RECEIVED_AT,
    source: 'notification',
  }
}

function createParser(codecId = 20) {
  return createOmiAudioStreamParser({
    codecId,
    framing: FRAMING,
    profile: OFFICIAL_OMI_AUDIO_PROFILE,
    firmware: FIRMWARE,
  })
}

interface FakeTransportSession {
  session: DeviceTransportSession
  calls: string[]
  emit(bytes: Uint8Array, receivedAt?: string): void
  subscribeCount(): number
  unsubscribeCount(): number
  closeCount(): number
  disconnectUnexpectedly(): void
}

function createFakeTransportSession(options?: {
  codecId?: number
  sessionId?: string
}): FakeTransportSession {
  const profile = OFFICIAL_OMI_AUDIO_PROFILE
  const calls: string[] = []
  let listener: DeviceTransportFrameListener | undefined
  let sequence = 1
  let subscriptions = 0
  let unsubscriptions = 0
  let closes = 0
  let state: ReturnType<DeviceTransportSession['getState']> = 'connected'
  const stateListeners = new Set<
    Parameters<NonNullable<DeviceTransportSession['subscribeState']>>[0]
  >()
  const transitionState = (next: ReturnType<DeviceTransportSession['getState']>) => {
    state = next
    for (const stateListener of [...stateListeners]) stateListener(state)
  }
  const device: DiscoveredDevice = {
    discoveryId: 'opaque-omi-device',
    transportId: 'ble-test',
    transportKind: 'bluetooth_low_energy',
    displayName: 'Omi',
    advertisedServiceIds: [profile.gatt.serviceId],
    connectable: true,
    discoveredAt: RECEIVED_AT,
  }
  const sameCharacteristic = (
    actual: DeviceCharacteristicRef,
    expectedId: string,
  ) =>
    actual.serviceId.toLowerCase() === profile.gatt.serviceId &&
    actual.characteristicId.toLowerCase() === expectedId

  const session: DeviceTransportSession = {
    sessionId: options?.sessionId ?? 'transport-session',
    device,
    getState: () => state,
    subscribeState: (stateListener) => {
      stateListeners.add(stateListener)
      stateListener(state)
      let stopped = false
      return {
        unsubscribe() {
          if (stopped) return
          stopped = true
          stateListeners.delete(stateListener)
        },
      }
    },
    read: async (characteristic) => {
      calls.push('read_codec')
      if (!sameCharacteristic(characteristic, profile.gatt.audioCodecId)) {
        return {
          ok: false,
          error: {
            code: 'read_failed',
            message: 'The expected readable characteristic is unavailable.',
            retryable: false,
          },
        }
      }
      return ok({
        payload: new Uint8Array([options?.codecId ?? 20]),
        sequence: sequence++,
        characteristic,
        source: 'read',
        receivedAt: RECEIVED_AT,
      })
    },
    write: async () =>
      Promise.resolve({
        ok: false,
        error: {
          code: 'write_failed',
          message: 'Writes are not configured.',
          retryable: false,
        },
      }),
    subscribe: async (characteristic, nextListener) => {
      calls.push('subscribe_audio')
      if (!sameCharacteristic(characteristic, profile.gatt.audioDataId)) {
        return {
          ok: false,
          error: {
            code: 'notification_failed',
            message: 'The expected notify characteristic is unavailable.',
            retryable: false,
          },
        }
      }
      subscriptions += 1
      listener = nextListener
      let stopped = false
      const subscription: DeviceTransportNotificationSubscription = {
        subscriptionId: `transport-notification-${subscriptions}`,
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
        transitionState('disconnected')
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
        payload: bytes,
        sequence: sequence++,
        characteristic: {
          serviceId: profile.gatt.serviceId,
          characteristicId: profile.gatt.audioDataId,
        },
        source: 'notification',
        receivedAt,
      })
    },
    subscribeCount: () => subscriptions,
    unsubscribeCount: () => unsubscriptions,
    closeCount: () => closes,
    disconnectUnexpectedly() {
      transitionState('disconnected')
    },
  }
}

describe('official OMI audio profile', () => {
  it('forwards an unexpected transport disconnect as a normalized session state', async () => {
    const transport = createFakeTransportSession()
    const opened = await createOmiAudioAdapter({
      framing: FRAMING,
      firmware: FIRMWARE,
    }).openSession(transport.session)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const states: string[] = []
    opened.value.subscribeState?.((state) => states.push(state))

    transport.disconnectUnexpectedly()

    expect(states).toEqual(['open', 'disconnected'])
    expect(opened.value.getState()).toBe('disconnected')
  })

  it('contains only the source-cited official audio GATT and codec values', () => {
    expect(OFFICIAL_OMI_AUDIO_PROFILE).toMatchObject({
      profileId: 'omi-audio-official-eb353430',
      discovery: { names: ['Omi'] },
      gatt: {
        serviceId: '19b10000-e8f2-537e-4f6c-d104768a1214',
        audioDataId: '19b10001-e8f2-537e-4f6c-d104768a1214',
        audioCodecId: '19b10002-e8f2-537e-4f6c-d104768a1214',
      },
      header: {
        byteLength: 3,
        packetSequenceByteOrder: 'little_endian',
      },
      codecs: {
        0: { codec: 'pcm_s16le', sampleRateHz: 16_000, bitDepth: 16, channels: 1 },
        1: { codec: 'pcm_u8', sampleRateHz: 16_000, bitDepth: 8, channels: 1 },
        20: { codec: 'opus', sampleRateHz: 16_000, bitDepth: 16, channels: 1 },
      },
      provenance: {
        sourceReference: 'eb35343053ffda69676d13eb88874b576f71f180',
      },
    })
    expect(OFFICIAL_OMI_AUDIO_PROFILE.provenance.sourceUrl).toContain(
      OFFICIAL_OMI_AUDIO_PROFILE.provenance.sourceReference,
    )
    expect(OFFICIAL_OMI_AUDIO_PROFILE.provenance.firmwareCaveat).toContain(
      'firmware-coupled',
    )
    expect(OFFICIAL_OMI_AUDIO_PROFILE).not.toHaveProperty('touch')
    expect(OFFICIAL_OMI_AUDIO_PROFILE).not.toHaveProperty('commands')
    expect(OFFICIAL_OMI_AUDIO_PROFILE).not.toHaveProperty('acknowledgements')
    expect(OFFICIAL_OMI_AUDIO_PROFILE).not.toHaveProperty('sensors')
  })

  it('requires caller provenance for configurable profile variants', () => {
    const configured = createOfficialOmiAudioProfile({
      discovery: { names: ['Lab Omi'], namePrefixes: ['Omi-'] },
      firmwareCaveat: 'Validated only with lab firmware 1.2.3.',
      sourceReference: 'omi-lab-profile-1',
      sourceUrl: 'https://example.test/official-omi-profile',
    })

    expect(configured.discovery).toEqual({
      names: ['Lab Omi'],
      namePrefixes: ['Omi-'],
    })
    expect(configured.gatt).toEqual(OFFICIAL_OMI_AUDIO_PROFILE.gatt)
    expect(configured.provenance).toMatchObject({
      sourceReference: 'omi-lab-profile-1',
      sourceUrl: 'https://example.test/official-omi-profile',
      firmwareCaveat: 'Validated only with lab firmware 1.2.3.',
    })
  })
})

describe('OMI audio stream parser', () => {
  it('parses one complete frame with explicit metadata and private copied bytes', () => {
    const parser = createParser()
    const outcomes = parser.push(parserInput(OMI_COMPLETE_FRAME, 7))

    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]).toMatchObject({
      ok: true,
      metadata: {
        codec: 'opus',
        sampleRateHz: 16_000,
        bitDepth: 16,
        channelCount: 1,
        transportSequence: 7,
        sessionSequence: 1,
        packetSequence: 0x1234,
        fragmentIndex: 0,
        receivedAt: RECEIVED_AT,
        source: 'notification',
        provenance: {
          profileId: OFFICIAL_OMI_AUDIO_PROFILE.profileId,
          sourceReference:
            OFFICIAL_OMI_AUDIO_PROFILE.provenance.sourceReference,
          firmware: FIRMWARE,
        },
      },
      payload: new Uint8Array([0x11, 0x22, 0x33, 0x44]),
    })
    if (outcomes[0]?.ok) {
      expect(outcomes[0].metadata).not.toHaveProperty('payload')
      OMI_COMPLETE_FRAME[3] = 0xff
      expect(outcomes[0].payload[0]).toBe(0x11)
      OMI_COMPLETE_FRAME[3] = 0x11
    }
  })

  it('retains fragmented bytes and drains coalesced frames without loss', () => {
    const parser = createParser()
    const first = OMI_FRAGMENTED_PACKET.first
    const coalescedTail = concat(
      first.subarray(2),
      OMI_FRAGMENTED_PACKET.second,
    )

    expect(parser.push(parserInput(first.subarray(0, 2), 1))).toEqual([])
    const outcomes = parser.push(parserInput(coalescedTail, 2))

    expect(outcomes).toHaveLength(2)
    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, true])
    expect(
      outcomes.map((outcome) =>
        outcome.ok
          ? [outcome.metadata.packetSequence, outcome.metadata.fragmentIndex]
          : outcome.failure.code,
      ),
    ).toEqual([
      [0x1235, 0],
      [0x1235, 1],
    ])
    expect(
      outcomes.map((outcome) => (outcome.ok ? [...outcome.payload] : [])),
    ).toEqual([
      [0x51, 0x52, 0x53, 0x54],
      [0x55, 0x56],
    ])
  })

  it('accepts packet-number wrap without a discontinuity failure', () => {
    const parser = createParser()
    const outcomes = parser.push(
      parserInput(
        concat(
          omiAudioFrame(0xffff, 0, [1, 2, 3, 4]),
          omiAudioFrame(0, 0, [5, 6, 7, 8]),
        ),
      ),
    )

    expect(outcomes).toHaveLength(2)
    expect(
      outcomes.map((outcome) =>
        outcome.ok ? outcome.metadata.packetSequence : outcome.failure.code,
      ),
    ).toEqual([0xffff, 0])
  })

  it('reports index discontinuity but preserves the valid audio frame', () => {
    const parser = createParser()
    const outcomes = parser.push(
      parserInput(
        concat(
          omiAudioFrame(8, 0, [1, 2, 3, 4]),
          omiAudioFrame(8, 2, [5, 6, 7, 8]),
        ),
      ),
    )

    expect(outcomes.map((outcome) => (outcome.ok ? 'audio' : outcome.failure.code))).toEqual([
      'audio',
      'fragment_discontinuity',
      'audio',
    ])
  })

  it('returns typed non-sensitive failures for empty, short, and malformed input', () => {
    const parser = createParser()
    const empty = parser.push(parserInput(new Uint8Array()))
    expect(empty).toMatchObject([
      { ok: false, failure: { code: 'empty_input', retryable: true } },
    ])

    expect(parser.push(parserInput(new Uint8Array([0x01, 0x02])))).toEqual([])
    expect(parser.finish()).toMatchObject([
      { ok: false, failure: { code: 'incomplete_frame', retryable: true } },
    ])

    const malformed = parser.push(
      parserInput(omiAudioFrame(1, 9, [0xaa, 0xbb, 0xcc, 0xdd])),
    )
    expect(malformed).toMatchObject([
      { ok: false, failure: { code: 'invalid_fragment_layout', retryable: false } },
    ])
    expect(JSON.stringify([...empty, ...malformed])).not.toContain('170')
    expect(JSON.stringify([...empty, ...malformed])).not.toContain('payload')
  })

  it('rejects an unknown codec without exposing codec or audio values', () => {
    const parser = createParser(99)
    const outcomes = parser.push(parserInput(omiAudioFrame(4, 0, [91, 92, 93, 94])))

    expect(outcomes).toMatchObject([
      { ok: false, failure: { code: 'unknown_codec', retryable: false } },
    ])
    const serialized = JSON.stringify(outcomes)
    expect(serialized).not.toContain('99')
    expect(serialized).not.toContain('91')
    expect(serialized).not.toContain('payload')
  })
})

describe('OMI audio adapter', () => {
  function createAdapter() {
    return createOmiAudioAdapter({
      framing: FRAMING,
      firmware: FIRMWARE,
    })
  }

  it('matches configured service or official name hints only on connectable BLE devices', () => {
    const adapter = createAdapter()
    const base: DiscoveredDevice = {
      discoveryId: 'omi-discovery',
      transportId: 'ble',
      transportKind: 'bluetooth_low_energy',
      connectable: true,
      discoveredAt: RECEIVED_AT,
    }

    expect(
      adapter.matches({
        ...base,
        advertisedServiceIds: [
          OFFICIAL_OMI_AUDIO_PROFILE.gatt.serviceId.toUpperCase(),
        ],
      }),
    ).toBe(true)
    expect(adapter.matches({ ...base, displayName: 'Omi' })).toBe(true)
    expect(adapter.matches({ ...base, displayName: 'Other' })).toBe(false)
    expect(
      adapter.matches({ ...base, displayName: 'Omi', connectable: false }),
    ).toBe(false)
    expect(
      adapter.matches({
        ...base,
        displayName: 'Omi',
        transportKind: 'simulated',
      }),
    ).toBe(false)
  })

  it('validates codec before one transport subscription and reports unsupported capabilities', async () => {
    const transport = createFakeTransportSession()
    const opened = await createAdapter().openSession(transport.session)

    expect(opened.ok).toBe(true)
    expect(transport.calls).toEqual(['read_codec', 'subscribe_audio'])
    expect(transport.subscribeCount()).toBe(1)
    if (!opened.ok) return
    expect(opened.value.capabilities).toMatchObject({
      interaction_events: { status: 'requires_vendor_profile' },
      telemetry: { status: 'requires_vendor_profile' },
      haptic_feedback: { status: 'requires_vendor_profile' },
      light_feedback: { status: 'requires_vendor_profile' },
      status_reporting: { status: 'requires_vendor_profile' },
      audio_capture: { status: 'requires_real_device' },
    })

    opened.value.subscribe(() => undefined)
    opened.value.subscribe(() => undefined)
    expect(transport.subscribeCount()).toBe(1)

    const rejected = await opened.value.execute({
      commandId: 'unsupported-command',
      kind: 'haptic_feedback',
      issuedAt: RECEIVED_AT,
      pattern: 'acknowledge',
    })
    expect(rejected).toMatchObject({
      ok: false,
      error: {
        code: 'capability_unavailable',
        capabilityState: 'requires_vendor_profile',
      },
    })
  })

  it('does not subscribe when the codec characteristic is unknown or malformed', async () => {
    const transport = createFakeTransportSession({ codecId: 99 })
    const opened = await createAdapter().openSession(transport.session)

    expect(opened).toMatchObject({
      ok: false,
      error: { code: 'invalid_data', retryable: false },
    })
    expect(transport.calls).toEqual(['read_codec'])
    expect(transport.subscribeCount()).toBe(0)
    expect(transport.closeCount()).toBe(0)
    expect(JSON.stringify(opened)).not.toContain('99')

    const malformedTransport = createFakeTransportSession()
    const originalRead = malformedTransport.session.read
    malformedTransport.session.read = async (characteristic, options) => {
      const read = await originalRead(characteristic, options)
      if (!read.ok) return read
      return { ...read, value: { ...read.value, payload: new Uint8Array([20, 1]) } }
    }
    const malformed = await createAdapter().openSession(malformedTransport.session)
    expect(malformed).toMatchObject({
      ok: false,
      error: { code: 'invalid_data', retryable: false },
    })
    expect(malformedTransport.subscribeCount()).toBe(0)
  })

  it('prevents concurrent duplicate opens from creating duplicate subscriptions', async () => {
    const transport = createFakeTransportSession()
    const adapter = createAdapter()
    const [first, duplicate] = await Promise.all([
      adapter.openSession(transport.session),
      adapter.openSession(transport.session),
    ])

    expect(first.ok).toBe(true)
    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: 'protocol_error', retryable: false },
    })
    expect(transport.subscribeCount()).toBe(1)
  })

  it('keeps parse failures local and continues independent session streams', async () => {
    const firstTransport = createFakeTransportSession({ sessionId: 'first' })
    const secondTransport = createFakeTransportSession({ sessionId: 'second' })
    const adapter = createAdapter()
    const first = await adapter.openSession(firstTransport.session)
    const second = await adapter.openSession(secondTransport.session)
    if (!first.ok || !second.ok) throw new Error('Expected fixture sessions to open')
    const firstEvents: OmiAdapterEvent[] = []
    const secondEvents: OmiAdapterEvent[] = []
    first.value.subscribe((event) => firstEvents.push(event))
    first.value.subscribe(() => {
      throw new Error('A consumer listener must not block other listeners')
    })
    second.value.subscribe((event) => secondEvents.push(event))

    firstTransport.emit(new Uint8Array())
    secondTransport.emit(omiAudioFrame(20, 0, [1, 2, 3, 4]))
    firstTransport.emit(omiAudioFrame(21, 0, [5, 6, 7, 8]))

    expect(firstEvents.map((event) => event.kind)).toEqual([
      'parse_failure',
      'audio_chunk',
    ])
    expect(secondEvents.map((event) => event.kind)).toEqual(['audio_chunk'])
    expect(first.value.getState()).toBe('open')
    expect(second.value.getState()).toBe('open')
    expect(firstEvents[0]).not.toHaveProperty('payload')
    expect(firstEvents[0]).not.toHaveProperty('characteristic')
  })

  it('closes idempotently and reconnects with fresh parser and session sequences', async () => {
    const adapter = createAdapter()
    const firstTransport = createFakeTransportSession({ sessionId: 'reused-id' })
    const first = await adapter.openSession(firstTransport.session)
    if (!first.ok) throw new Error('Expected first fixture session to open')
    const firstEvents: OmiAdapterEvent[] = []
    first.value.subscribe((event) => firstEvents.push(event))
    firstTransport.emit(omiAudioFrame(30, 0, [1, 2, 3, 4]))

    const [closedOnce, closedTwice] = await Promise.all([
      first.value.close(),
      first.value.close(),
    ])
    firstTransport.emit(omiAudioFrame(31, 0, [5, 6, 7, 8]))
    expect(closedOnce).toEqual(ok(undefined))
    expect(closedTwice).toEqual(ok(undefined))
    expect(firstTransport.unsubscribeCount()).toBe(1)
    expect(firstTransport.closeCount()).toBe(1)
    expect(firstEvents).toHaveLength(1)
    expect(first.value.getState()).toBe('closed')

    const secondTransport = createFakeTransportSession({ sessionId: 'reused-id' })
    const second = await adapter.openSession(secondTransport.session)
    if (!second.ok) throw new Error('Expected reconnect fixture session to open')
    const secondEvents: OmiAdapterEvent[] = []
    second.value.subscribe((event) => secondEvents.push(event))
    secondTransport.emit(omiAudioFrame(30, 0, [9, 10, 11, 12]))

    expect(first.value.sessionId).not.toBe(second.value.sessionId)
    expect(firstEvents[0]).toMatchObject({
      kind: 'audio_chunk',
      metadata: { transportSequence: 2, sessionSequence: 1 },
    })
    expect(secondEvents[0]).toMatchObject({
      kind: 'audio_chunk',
      metadata: { transportSequence: 2, sessionSequence: 1 },
    })
    expect(secondTransport.subscribeCount()).toBe(1)
  })
})

describe('OMI fixture provenance', () => {
  it('records source, firmware, model, and transport assumptions', () => {
    expect(OMI_AUDIO_FIXTURE_PROVENANCE.sourceUrl).toContain(
      OMI_AUDIO_FIXTURE_PROVENANCE.sourceReference,
    )
    expect(OMI_AUDIO_FIXTURE_PROVENANCE.deviceModel).toContain('no physical device')
    expect(OMI_AUDIO_FIXTURE_PROVENANCE.firmware).toContain('firmware-coupled')
    expect(OMI_AUDIO_FIXTURE_PROVENANCE.transportAssumption).toContain(
      'explicit per-index payload lengths',
    )
  })
})
