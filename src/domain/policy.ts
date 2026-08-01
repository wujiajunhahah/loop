import type {
  AgentPolicy,
  Memory,
  RecipientChoice,
  RecipientSession,
} from './models'

export function canAgentUseMemory(
  memory: Memory,
  relationshipId: string,
  recipientId: string,
  policy: AgentPolicy,
): boolean {
  if (memory.visibility === 'private') return false
  if (policy.relationshipId !== relationshipId) return false
  if (!policy.allowedMemoryIds.includes(memory.id)) return false

  if (memory.visibility === 'relationship_specific') {
    return (
      memory.relationshipId === relationshipId && memory.recipientId === recipientId
    )
  }

  return memory.ownerId !== recipientId
}

export function applyRecipientChoice(
  session: RecipientSession,
  choice: RecipientChoice,
): RecipientSession {
  if (session.status === 'closed') return session

  const statusByChoice = {
    accept: 'active',
    postpone: 'postponed',
    skip: 'skipped',
    close: 'closed',
  } as const

  return { ...session, status: statusByChoice[choice], lastChoice: choice }
}
