import { describe, expect, it } from 'vitest'
import { chooseRecipientAction, createRecipientSession } from './session'

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
})
