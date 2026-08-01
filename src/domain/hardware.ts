import type { HardwareEvent, HardwareEventType } from './models'

const supportedEvents = new Set<HardwareEventType>([
  'mark_moment',
  'touch',
  'wear',
  'confirm',
  'dismiss',
])

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
