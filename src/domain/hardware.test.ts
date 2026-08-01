import { describe, expect, it, vi } from 'vitest'
import { MockHardwareBridge } from '../data/mockServices'
import { createEntryEvent, createHardwareEvent } from './hardware'

describe('hardware events', () => {
  it('uses one entry shape for software and interchangeable physical sources', () => {
    const event = createEntryEvent({
      id: 'entry-1',
      source: 'software',
      type: 'open',
      recipientId: 'recipient-a',
      occurredAt: '2026-08-01T00:00:00.000Z',
    })

    expect(event).toMatchObject({ source: 'software', type: 'open', payload: {} })
    expect(event).not.toHaveProperty('deviceId')
  })

  it('represents a generic bridge event without device-specific fields', () => {
    const event = createHardwareEvent({
      id: 'event-1',
      bridgeId: 'bridge-1',
      type: 'touch',
      occurredAt: '2026-08-01T00:00:00.000Z',
    })

    expect(event).toMatchObject({ bridgeId: 'bridge-1', type: 'touch' })
    expect(event).not.toHaveProperty('ring')
  })

  it('publishes simulator events through HardwareBridge', () => {
    const bridge = new MockHardwareBridge()
    const listener = vi.fn()
    const unsubscribe = bridge.subscribe(listener)

    bridge.simulate('confirm', 'recipient-a')
    unsubscribe()
    bridge.simulate('dismiss', 'recipient-a')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toMatchObject({
      type: 'confirm',
      actorId: 'recipient-a',
    })
  })
})
