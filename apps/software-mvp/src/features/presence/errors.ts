export type PresenceErrorCode =
  | 'PRESENCE_NOT_FOUND'
  | 'BRANCH_NOT_FOUND'
  | 'ASSET_NOT_FOUND'
  | 'DERIVED_NOT_FOUND'
  | 'NOT_EDITABLE'
  | 'NOT_RELEASED'
  | 'BRANCH_NOT_RELEASED'
  | 'WRONG_RECIPIENT'
  | 'POLICY_NOT_APPROVED'
  | 'POLICY_UNSAFE'
  | 'CONSENT_MISSING'
  | 'UNREVIEWED_ASSET'
  | 'PENDING_REVIEW_AT_RELEASE'
  | 'EMOTION_INFERENCE_REJECTED'

export class PresenceError extends Error {
  constructor(
    public readonly code: PresenceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PresenceError'
  }
}
