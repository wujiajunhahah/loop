import type { EntryEvent } from '../../domain'

export const RECIPIENT_ENTRY_EVENT = 'loop:recipient-entry'

export interface RecipientFlowNotifier {
  enterRecipientFlow(event: EntryEvent): void
}

export class BrowserRecipientFlowNotifier implements RecipientFlowNotifier {
  enterRecipientFlow(event: EntryEvent): void {
    window.dispatchEvent(new CustomEvent(RECIPIENT_ENTRY_EVENT, { detail: event }))
    window.location.hash = '/recipient'
  }
}
