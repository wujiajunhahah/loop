export type AgentErrorCode =
  | 'RELATIONSHIP_NOT_FOUND'
  | 'RELATIONSHIP_NOT_AVAILABLE'
  | 'RECIPIENT_MISMATCH'
  | 'POLICY_NOT_FOUND'
  | 'POLICY_RELATIONSHIP_MISMATCH'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_RELATIONSHIP_MISMATCH'
  | 'RECIPIENT_ENTRY_REQUIRED'
  | 'PROACTIVE_TRIGGER_NOT_ALLOWED'
  | 'INSUFFICIENT_CONTEXT'
  | 'INTERACTION_NOT_FOUND'
  | 'INVALID_INTERACTION_TRANSITION'

export class AgentError extends Error {
  constructor(
    readonly code: AgentErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AgentError'
  }
}
