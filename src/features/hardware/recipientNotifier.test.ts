import { describe, expect, it, vi } from 'vitest'
import type { EntryEvent } from '../../domain'
import {
  BrowserRecipientFlowNotifier,
  RECIPIENT_ENTRY_EVENT,
} from './recipientNotifier'

const entryEvent: EntryEvent = {
  id: 'event-a',
  source: 'device',
  type: 'open',
  recipientId: 'recipient-a',
  occurredAt: '2026-08-01T09:00:00.000Z',
  payload: {},
}

describe('BrowserRecipientFlowNotifier', () => {
  it('notifies the App boundary with a hardware-neutral EntryEvent', () => {
    const listener = vi.fn()
    window.addEventListener(RECIPIENT_ENTRY_EVENT, listener)

    new BrowserRecipientFlowNotifier().enterRecipientFlow(entryEvent)

    expect(listener).toHaveBeenCalledOnce()
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual(entryEvent)
    expect(window.location.hash).toBe('#/recipient')
    window.removeEventListener(RECIPIENT_ENTRY_EVENT, listener)
  })
})
