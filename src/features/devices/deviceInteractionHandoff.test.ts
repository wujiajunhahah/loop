import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDeviceInteractionHandoff,
  clearProcessedDeviceInteractions,
  isDeviceInteractionProcessed,
  markDeviceInteractionProcessed,
  readDeviceInteractionHandoff,
  writeDeviceInteractionHandoff,
} from './deviceInteractionHandoff'

const handoffStorageKey = 'loop:verified-device-interaction:v2'
const processedStorageKey = 'loop:processed-device-interactions:v1'
const now = Date.parse('2026-08-03T00:05:00.000Z')

const handoff = {
  version: 2 as const,
  purpose: 'creator_capture' as const,
  eventId: 'event-1',
  interaction: 'mark_moment' as const,
  deviceId: 'device-1',
  deviceName: 'Alloop Ring',
  source: 'simulated' as const,
  occurredAt: '2026-08-03T00:00:00.000Z',
  verification: 'binding_verified' as const,
  ownerId: 'person-mei',
  sessionId: 'ring-session-1',
  sessionSequence: 7,
  profile: {
    profileId: 'ring-reviewed-v1',
    sourceReference: 'reviewed:ring:v1',
    validation: 'fixture_only' as const,
  },
}

describe('device interaction handoff', () => {
  beforeEach(() => {
    clearDeviceInteractionHandoff()
    clearProcessedDeviceInteractions()
    sessionStorage.clear()
  })

  it('round-trips verified provenance for the matching purpose', () => {
    writeDeviceInteractionHandoff(handoff, now)

    expect(readDeviceInteractionHandoff('creator_capture', { now })).toEqual(handoff)
    expect(readDeviceInteractionHandoff('recipient_entry', { now })).toBeUndefined()
  })

  it('clears only the expected event', () => {
    writeDeviceInteractionHandoff(handoff, now)
    clearDeviceInteractionHandoff('different-event')
    expect(readDeviceInteractionHandoff(undefined, { now })).toEqual(handoff)

    clearDeviceInteractionHandoff('event-1')
    expect(readDeviceInteractionHandoff(undefined, { now })).toBeUndefined()
  })

  it('does not clear a different storage-only handoff', async () => {
    writeDeviceInteractionHandoff(handoff, now)
    vi.resetModules()
    const freshModule = await import('./deviceInteractionHandoff')

    freshModule.clearDeviceInteractionHandoff('different-event')

    expect(sessionStorage.getItem(handoffStorageKey)).not.toBeNull()
    expect(freshModule.readDeviceInteractionHandoff(undefined, { now })).toEqual(handoff)
  })

  it('rejects purpose, interaction, verification, and identity mismatches', async () => {
    sessionStorage.setItem(handoffStorageKey, JSON.stringify({
      ...handoff,
      purpose: 'recipient_entry',
      interaction: 'touch',
      verification: 'binding_verified',
      recipientId: undefined,
    }))
    vi.resetModules()
    const freshModule = await import('./deviceInteractionHandoff')

    expect(freshModule.readDeviceInteractionHandoff('recipient_entry', { now })).toBeUndefined()
    expect(sessionStorage.getItem(handoffStorageKey)).toBeNull()
  })

  it('requires the expected owner and recipient identities', async () => {
    const recipientHandoff = {
      ...handoff,
      purpose: 'recipient_entry',
      interaction: 'touch',
      verification: 'entrustment_verified',
      recipientId: 'person-lin',
    } as const
    expect(writeDeviceInteractionHandoff(recipientHandoff, now)).toBe(true)

    expect(readDeviceInteractionHandoff('recipient_entry', {
      now,
      ownerId: 'person-other',
      recipientId: 'person-lin',
    })).toBeUndefined()
    expect(readDeviceInteractionHandoff('recipient_entry', {
      now,
      ownerId: 'person-mei',
      recipientId: 'person-other',
    })).toBeUndefined()
    expect(readDeviceInteractionHandoff('recipient_entry', {
      now,
      ownerId: 'person-mei',
      recipientId: 'person-lin',
    })).toEqual(recipientHandoff)
  })

  it('rejects expired and implausibly future handoffs', () => {
    expect(writeDeviceInteractionHandoff({
      ...handoff,
      occurredAt: '2026-08-02T23:00:00.000Z',
    }, now)).toBe(false)
    expect(writeDeviceInteractionHandoff({
      ...handoff,
      occurredAt: '2026-08-03T00:06:00.000Z',
    }, now)).toBe(false)
  })
})

describe('processed device interaction ledger', () => {
  beforeEach(() => {
    clearDeviceInteractionHandoff()
    clearProcessedDeviceInteractions()
    sessionStorage.clear()
  })

  it('round-trips a processed event', () => {
    markDeviceInteractionProcessed({
      version: 1,
      eventId: 'event-1',
      disposition: 'dismissed',
      processedAt: '2026-08-03T00:01:00.000Z',
    })

    expect(isDeviceInteractionProcessed('event-1')).toBe(true)
    expect(isDeviceInteractionProcessed('event-2')).toBe(false)
  })

  it('keeps the processed ledger when only the handoff is cleared', () => {
    markDeviceInteractionProcessed({
      version: 1,
      eventId: 'event-1',
      disposition: 'dismissed',
      processedAt: '2026-08-03T00:01:00.000Z',
    })

    clearDeviceInteractionHandoff()

    expect(isDeviceInteractionProcessed('event-1')).toBe(true)
    expect(sessionStorage.getItem(processedStorageKey)).not.toBeNull()
  })

  it('reloads processed events from session storage with a fresh cache', async () => {
    markDeviceInteractionProcessed({
      version: 1,
      eventId: 'event-1',
      disposition: 'entered_creator',
      processedAt: '2026-08-03T00:01:00.000Z',
    })
    vi.resetModules()
    const freshModule = await import('./deviceInteractionHandoff')

    expect(freshModule.isDeviceInteractionProcessed('event-1')).toBe(true)
  })

  it('updates the same event id once and moves it to the newest position', () => {
    markDeviceInteractionProcessed({
      version: 1,
      eventId: 'event-1',
      disposition: 'dismissed',
      processedAt: '2026-08-03T00:01:00.000Z',
    })
    markDeviceInteractionProcessed({
      version: 1,
      eventId: 'event-2',
      disposition: 'dismissed',
      processedAt: '2026-08-03T00:02:00.000Z',
    })
    markDeviceInteractionProcessed({
      version: 1,
      eventId: 'event-1',
      disposition: 'consent_revoked',
      processedAt: '2026-08-03T00:03:00.000Z',
    })

    expect(JSON.parse(sessionStorage.getItem(processedStorageKey) ?? '[]')).toEqual([
      expect.objectContaining({ eventId: 'event-2' }),
      expect.objectContaining({
        eventId: 'event-1',
        disposition: 'consent_revoked',
      }),
    ])
  })

  it('keeps only the newest 64 event ids', () => {
    for (let index = 0; index < 65; index += 1) {
      markDeviceInteractionProcessed({
        version: 1,
        eventId: `event-${index}`,
        disposition: 'dismissed',
        processedAt: new Date(index * 1_000).toISOString(),
      })
    }

    const stored = JSON.parse(sessionStorage.getItem(processedStorageKey) ?? '[]')
    expect(stored).toHaveLength(64)
    expect(isDeviceInteractionProcessed('event-0')).toBe(false)
    expect(isDeviceInteractionProcessed('event-1')).toBe(true)
    expect(isDeviceInteractionProcessed('event-64')).toBe(true)
  })

  it.each([
    ['invalid JSON', '{'],
    ['an invalid record', JSON.stringify([{ version: 1, eventId: 'event-1' }])],
  ])('clears malformed ledger data: %s', async (_label, raw) => {
    sessionStorage.setItem(processedStorageKey, raw)
    vi.resetModules()
    const freshModule = await import('./deviceInteractionHandoff')

    expect(freshModule.isDeviceInteractionProcessed('event-1')).toBe(false)
    expect(sessionStorage.getItem(processedStorageKey)).toBeNull()
  })
})
