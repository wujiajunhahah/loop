import type { HardwareEvent, HardwareEventType } from './models'
import type { EntryEvent, EntryEventSource, EntryEventType } from './contracts'

export function createEntryEvent(input: {
  id: string
  source: EntryEventSource
  type: EntryEventType
  occurredAt?: string
  recipientId?: string
  relationshipId?: string
  payload?: Readonly<Record<string, unknown>>
}): EntryEvent {
  return {
    ...input,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload ?? {},
  }
}

const supportedEvents = new Set<HardwareEventType>([
  'mark_moment',
  'touch',
  'wear',
  'confirm',
  'dismiss',
])

/** @deprecated Use the hardware-neutral createEntryEvent contract. */
export function createHardwareEvent(input: {
  id: string
  bridgeId: string
  type: HardwareEventType
  actorId?: string
  context?: HardwareEvent['context']
  occurredAt?: string
}): HardwareEvent {
  if (!supportedEvents.has(input.type)) {
    throw new Error(`Unsupported hardware event: ${input.type}`)
  }

  return {
    ...input,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  }
}
