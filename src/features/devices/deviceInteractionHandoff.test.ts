import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDeviceInteractionHandoff,
  readDeviceInteractionHandoff,
  writeDeviceInteractionHandoff,
} from './deviceInteractionHandoff'

const handoff = {
  version: 1 as const,
  purpose: 'creator_capture' as const,
  eventId: 'event-1',
  interaction: 'mark_moment' as const,
  deviceId: 'device-1',
  deviceName: 'Alloop Ring',
  source: 'simulated' as const,
  occurredAt: '2026-08-03T00:00:00.000Z',
  verification: 'binding_verified' as const,
}

describe('device interaction handoff', () => {
  beforeEach(() => {
    clearDeviceInteractionHandoff()
    sessionStorage.clear()
  })

  it('round-trips verified provenance for the matching purpose', () => {
    writeDeviceInteractionHandoff(handoff)

    expect(readDeviceInteractionHandoff('creator_capture')).toEqual(handoff)
    expect(readDeviceInteractionHandoff('recipient_entry')).toBeUndefined()
  })

  it('clears only the expected event', () => {
    writeDeviceInteractionHandoff(handoff)
    clearDeviceInteractionHandoff('different-event')
    expect(readDeviceInteractionHandoff()).toEqual(handoff)

    clearDeviceInteractionHandoff('event-1')
    expect(readDeviceInteractionHandoff()).toBeUndefined()
  })
})
