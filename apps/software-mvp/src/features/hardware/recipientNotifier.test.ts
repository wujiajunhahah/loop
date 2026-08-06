import { describe, expect, it, vi } from 'vitest'
import type { HardwareEvent } from '../../adapters/hardware'
import {
  BrowserRecipientFlowNotifier,
  HARDWARE_RECIPIENT_EVENT,
} from './recipientNotifier'

const verifiedEvent: HardwareEvent = {
  eventId: 'event-a',
  deviceId: 'device-a',
  deviceType: 'object',
  recipientId: 'recipient-a',
  eventType: 'touch',
  occurredAt: '2026-08-01T09:00:00.000Z',
  verificationStatus: 'verified',
  payload: {},
}

describe('BrowserRecipientFlowNotifier', () => {
  it('notifies the App boundary and enters the recipient route', () => {
    const listener = vi.fn()
    window.addEventListener(HARDWARE_RECIPIENT_EVENT, listener)

    new BrowserRecipientFlowNotifier().enterRecipientFlow(verifiedEvent)

    expect(listener).toHaveBeenCalledOnce()
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual(verifiedEvent)
    expect(window.location.hash).toBe('#/recipient')
    window.removeEventListener(HARDWARE_RECIPIENT_EVENT, listener)
  })

  it('ignores events that have not passed verification', () => {
    window.location.hash = '/hardware-simulator/trigger'
    const listener = vi.fn()
    window.addEventListener(HARDWARE_RECIPIENT_EVENT, listener)

    new BrowserRecipientFlowNotifier().enterRecipientFlow({
      ...verifiedEvent,
      verificationStatus: 'rejected',
    })

    expect(listener).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/hardware-simulator/trigger')
    window.removeEventListener(HARDWARE_RECIPIENT_EVENT, listener)
  })
})
