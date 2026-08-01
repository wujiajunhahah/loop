export type ArtifactErrorCode =
  | 'INTERACTION_INCOMPLETE'
  | 'INTERACTION_OUTPUT_REQUIRED'
  | 'RELATIONSHIP_MISMATCH'
  | 'POLICY_MISMATCH'
  | 'NO_APPROVED_SOURCE'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_NOT_VISIBLE'
  | 'SOURCE_PROVENANCE_INVALID'
  | 'GENERATION_MODE_NOT_APPROVED'
  | 'SOURCE_TOPIC_NOT_APPROVED'
  | 'RECIPIENT_RESPONSE_AUTHOR_INVALID'

export class ArtifactError extends Error {
  constructor(
    readonly code: ArtifactErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ArtifactError'
  }
}
