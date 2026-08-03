import { describe, expect, it } from 'vitest'
import {
  chooseRecipientAction,
  createRecipientSession,
  isRecipientEntryPermanentlyClosed,
  permanentlyCloseRecipientEntry,
  resetRecipientEntryForTests,
} from './session'

describe('recipient session', () => {
  it('starts as a recipient-initiated active session', () => {
    const session = createRecipientSession()

    expect(session).toMatchObject({
      initiatedByRecipient: true,
      status: 'active',
      recipientId: 'person-lin',
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
