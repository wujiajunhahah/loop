import { applyRecipientChoice } from '../../domain'
import type { RecipientChoice, RecipientSession } from '../../domain'
import type { RecipientDeviceInteractionHandoff } from '../devices/deviceInteractionHandoff'

export const demoRecipient = {
  id: 'person-lin',
  name: 'Lin',
  relationshipId: 'relationship-mei-lin',
  relationshipLabel: '母亲和女儿',
}

export const demoPlan = {
  id: 'plan-five-recipes',
  title: '五道家常菜',
  invitation: '等你准备好时，和我一起把这五道菜做下去。',
  totalSteps: 5,
}

const PERMANENT_CLOSE_KEY = 'loop:recipient-entry-closed:relationship-mei-lin'

export function createRecipientSession(
  handoff?: RecipientDeviceInteractionHandoff,
  createId: () => string = () => crypto.randomUUID(),
): RecipientSession {
  return {
    id: createId(),
    relationshipId: demoRecipient.relationshipId,
    recipientId: demoRecipient.id,
    initiatedByRecipient: handoff === undefined,
    status: 'active',
    startedAt: new Date().toISOString(),
    ...(handoff === undefined
      ? {}
      : {
          trigger: {
            kind: 'device_interaction' as const,
            eventId: handoff.eventId,
            interaction: handoff.interaction,
            deviceId: handoff.deviceId,
            deviceName: handoff.deviceName,
            source: handoff.source,
            occurredAt: handoff.occurredAt,
            verification: handoff.verification,
            ownerId: handoff.ownerId,
            recipientId: handoff.recipientId,
            sessionId: handoff.sessionId,
            ...(handoff.sessionSequence === undefined
              ? {}
              : { sessionSequence: handoff.sessionSequence }),
            ...(handoff.profile === undefined
              ? {}
              : { profile: { ...handoff.profile } }),
          },
        }),
  }
}

export function confirmRecipientSession(session: RecipientSession): RecipientSession {
  return {
    ...session,
    initiatedByRecipient: true,
    status: 'active',
  }
}

export function isRecipientEntryPermanentlyClosed() {
  try {
    return localStorage.getItem(PERMANENT_CLOSE_KEY) === 'closed'
  } catch {
    return false
  }
}

export function permanentlyCloseRecipientEntry() {
  try {
    localStorage.setItem(PERMANENT_CLOSE_KEY, 'closed')
  } catch {
    // The in-memory session still transitions to closed for this visit.
  }
}

export function resetRecipientEntryForTests() {
  try {
    localStorage.removeItem(PERMANENT_CLOSE_KEY)
  } catch {
    // Test environments without storage have nothing to reset.
  }
}

export function chooseRecipientAction(
  session: RecipientSession,
  choice: RecipientChoice,
) {
  return applyRecipientChoice(session, choice)
}
