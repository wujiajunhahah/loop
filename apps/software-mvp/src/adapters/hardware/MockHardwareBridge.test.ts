import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockHardwareBridge } from './MockHardwareBridge'
import { hardwareEventTypes, type VerificationProof } from './types'

const ownerProof: VerificationProof = {
  identityId: 'owner-a',
  method: 'mock_code',
  value: 'LOOP-DEMO',
}
const recipientProof: VerificationProof = {
  identityId: 'recipient-a',
  method: 'mock_confirmation',
  value: 'LOOP-DEMO',
}

async function prepareBridge(bridge: MockHardwareBridge) {
  await bridge.bindDevice({
    deviceId: 'device-a',
    deviceType: 'keepsake-token',
    ownerProof,
  })
  await bridge.entrustDevice({
    deviceId: 'device-a',
    ownerProof,
    recipientProof,
  })
}

describe('MockHardwareBridge', () => {
  let bridge: MockHardwareBridge

  beforeEach(async () => {
    bridge = new MockHardwareBridge({
      now: () => '2026-08-01T09:00:00.000Z',
      createId: vi.fn(() => crypto.randomUUID()),
    })
    await prepareBridge(bridge)
  })

  it('standardizes every supported source as the same verified event shape', async () => {
    const listener = vi.fn()
    bridge.subscribe(listener)

    for (const eventType of hardwareEventTypes) {
      const result = await bridge.trigger({
        deviceId: 'device-a',
        recipientId: 'recipient-a',
        eventType,
        payload: { sequence: eventType },
      })

      expect(result.event).toEqual({
        eventId: expect.any(String),
        deviceId: 'device-a',
        deviceType: 'keepsake-token',
        recipientId: 'recipient-a',
        eventType,
        occurredAt: '2026-08-01T09:00:00.000Z',
        verificationStatus: 'verified',
        payload: { sequence: eventType },
      })
    }

    expect(listener).toHaveBeenCalledTimes(hardwareEventTypes.length)
  })

  it('rejects invalid recipient identity before publishing to consumers', async () => {
    const listener = vi.fn()
    bridge.subscribe(listener)

    const result = await bridge.trigger({
      eventId: 'invalid-recipient-event',
      deviceId: 'device-a',
      recipientId: 'recipient-b',
      eventType: 'nfc',
    })

    expect(result.outcome).toBe('invalid_identity')
    expect(result.event.verificationStatus).toBe('rejected')
    expect(listener).not.toHaveBeenCalled()
    expect(bridge.getFeedback()).toEqual({
      led: 'error',
      vibration: 'attention',
      confirmation: 'rejected',
    })
  })

  it('rejects duplicate event IDs and publishes the first event only once', async () => {
    const listener = vi.fn()
    bridge.subscribe(listener)
    const input = {
      eventId: 'same-event',
      deviceId: 'device-a',
      recipientId: 'recipient-a',
      eventType: 'tap' as const,
    }

    expect((await bridge.trigger(input)).outcome).toBe('accepted')
    expect((await bridge.trigger(input)).outcome).toBe('duplicate')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('requires verified identities for binding and entrustment', async () => {
    const unbound = new MockHardwareBridge()

    await expect(
      unbound.bindDevice({
        deviceId: 'device-b',
        deviceType: 'object',
        ownerProof: { ...ownerProof, value: 'WRONG' },
      }),
    ).rejects.toThrow('Identity verification failed')

    const result = await unbound.trigger({
      deviceId: 'device-b',
      recipientId: 'recipient-a',
      eventType: 'ble',
    })
    expect(result.outcome).toBe('unbound_device')
  })

  it('converts unavailable physical input to a traceable simulated event', async () => {
    bridge.setAvailable(false, 'Demo device disconnected')

    const result = await bridge.trigger({
      deviceId: 'device-a',
      recipientId: 'recipient-a',
      eventType: 'gesture',
      payload: { direction: 'forward' },
      allowFallback: true,
    })

    expect(result).toMatchObject({ outcome: 'accepted', fallbackUsed: true })
    expect(result.event).toMatchObject({
      eventType: 'simulated',
      verificationStatus: 'verified',
      payload: {
        direction: 'forward',
        originalEventType: 'gesture',
        fallback: true,
      },
    })
  })
})
