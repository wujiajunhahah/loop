import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockHardwareBridge } from './MockHardwareBridge'
import { triggerSources, type VerificationProof } from './types'

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

  it('publishes every supported source as the same verified EntryEvent shape', async () => {
    const listener = vi.fn()
    bridge.subscribe(listener)

    for (const source of triggerSources) {
      const result = await bridge.trigger({
        deviceId: 'device-a',
        recipientId: 'recipient-a',
        relationshipId: 'relationship-a',
        source,
        payload: { sequence: source },
      })

      expect(result.verificationStatus).toBe('verified')
      expect(result.event).toEqual({
        id: expect.any(String),
        source:
          source === 'nfc' || source === 'ble' || source === 'software'
            ? source
            : 'device',
        type: 'open',
        recipientId: 'recipient-a',
        relationshipId: 'relationship-a',
        occurredAt: '2026-08-01T09:00:00.000Z',
        payload: { sequence: source },
      })
    }

    expect(listener).toHaveBeenCalledTimes(triggerSources.length)
  })

  it('rejects invalid recipient identity before publishing to consumers', async () => {
    const listener = vi.fn()
    bridge.subscribe(listener)

    const result = await bridge.trigger({
      eventId: 'invalid-recipient-event',
      deviceId: 'device-a',
      recipientId: 'recipient-b',
      source: 'nfc',
    })

    expect(result.outcome).toBe('invalid_identity')
    expect(result.verificationStatus).toBe('rejected')
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
      source: 'tap' as const,
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
      source: 'ble',
    })
    expect(result.outcome).toBe('unbound_device')
  })

  it('converts unavailable physical input to a traceable software event', async () => {
    bridge.setAvailable(false, 'Demo device disconnected')

    const result = await bridge.trigger({
      deviceId: 'device-a',
      recipientId: 'recipient-a',
      source: 'gesture',
      payload: { direction: 'forward' },
      allowFallback: true,
    })

    expect(result).toMatchObject({
      outcome: 'accepted',
      triggerSource: 'software',
      fallbackUsed: true,
    })
    expect(result.event).toMatchObject({
      source: 'software',
      payload: {
        direction: 'forward',
        originalSource: 'gesture',
        fallback: true,
      },
    })
  })

  it('rejects unavailable hardware when software fallback is disabled', async () => {
    bridge.setAvailable(false)

    const result = await bridge.trigger({
      deviceId: 'device-a',
      recipientId: 'recipient-a',
      source: 'touch',
      allowFallback: false,
    })

    expect(result).toMatchObject({
      outcome: 'unavailable_hardware',
      verificationStatus: 'rejected',
      fallbackUsed: false,
    })
  })
})
