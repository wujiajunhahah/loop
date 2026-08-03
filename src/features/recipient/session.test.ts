import { describe, expect, it } from 'vitest'
import {
  chooseRecipientAction,
  confirmRecipientSession,
  createRecipientSession,
  isRecipientEntryPermanentlyClosed,
  permanentlyCloseRecipientEntry,
  resetRecipientEntryForTests,
} from './session'

describe('recipient session', () => {
  it('starts as a recipient-initiated active session', () => {
    const session = createRecipientSession(undefined, () => 'session-manual-1')

    expect(session).toMatchObject({
      initiatedByRecipient: true,
      status: 'active',
      recipientId: 'person-lin',
      id: 'session-manual-1',
    })
  })

  it('creates unique sessions and preserves verified device provenance', () => {
    const first = createRecipientSession()
    const second = createRecipientSession()
    const fromDevice = createRecipientSession({
      version: 2,
      purpose: 'recipient_entry',
      eventId: 'touch-1',
      interaction: 'touch',
      deviceId: 'ring-1',
      deviceName: 'Alloop Ring',
      source: 'simulated',
      occurredAt: '2026-08-03T00:00:00.000Z',
      verification: 'entrustment_verified',
      ownerId: 'person-mei',
      recipientId: 'person-lin',
      sessionId: 'ring-session-1',
      sessionSequence: 4,
      profile: {
        profileId: 'ring-demo-v1',
        sourceReference: 'simulator:ring:v1',
        validation: 'fixture_only',
      },
    }, () => 'session-device-1')

    expect(first.id).not.toBe(second.id)
    expect(fromDevice).toMatchObject({
      id: 'session-device-1',
      initiatedByRecipient: false,
      trigger: {
        eventId: 'touch-1',
        ownerId: 'person-mei',
        recipientId: 'person-lin',
        sessionId: 'ring-session-1',
        sessionSequence: 4,
        profile: { validation: 'fixture_only' },
      },
    })
    expect(confirmRecipientSession(fromDevice)).toMatchObject({
      initiatedByRecipient: true,
      status: 'active',
      trigger: { eventId: 'touch-1' },
    })
  })

  it('keeps all recipient exit choices explicit', () => {
    const session = createRecipientSession()

    expect(chooseRecipientAction(session, 'postpone')).toMatchObject({
      status: 'postponed',
      lastChoice: 'postpone',
    })
    expect(chooseRecipientAction(session, 'skip')).toMatchObject({
      status: 'skipped',
      lastChoice: 'skip',
    })
    expect(chooseRecipientAction(session, 'close')).toMatchObject({
      status: 'closed',
      lastChoice: 'close',
    })
  })

  it('persists an explicit permanent-close choice', () => {
    resetRecipientEntryForTests()
    expect(isRecipientEntryPermanentlyClosed()).toBe(false)

    permanentlyCloseRecipientEntry()

    expect(isRecipientEntryPermanentlyClosed()).toBe(true)
    resetRecipientEntryForTests()
  })
})
