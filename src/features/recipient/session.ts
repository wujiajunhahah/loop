import { applyRecipientChoice } from '../../domain'
import type { RecipientChoice, RecipientSession } from '../../domain'

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

export function createRecipientSession(): RecipientSession {
  return {
    id: 'recipient-session-demo',
    relationshipId: demoRecipient.relationshipId,
    recipientId: demoRecipient.id,
    initiatedByRecipient: true,
    status: 'active',
    startedAt: new Date().toISOString(),
  }
}

export function chooseRecipientAction(
  session: RecipientSession,
  choice: RecipientChoice,
) {
  return applyRecipientChoice(session, choice)
}
