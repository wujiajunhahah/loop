import type { HardwareEvent } from '../../adapters/hardware'

export const HARDWARE_RECIPIENT_EVENT = 'loop:hardware-recipient-entry'

export interface RecipientFlowNotifier {
  enterRecipientFlow(event: HardwareEvent): void
}

export class BrowserRecipientFlowNotifier implements RecipientFlowNotifier {
  enterRecipientFlow(event: HardwareEvent): void {
    if (event.verificationStatus !== 'verified') return
    window.dispatchEvent(
      new CustomEvent(HARDWARE_RECIPIENT_EVENT, { detail: event }),
    )
    window.location.hash = '/recipient'
  }
}
