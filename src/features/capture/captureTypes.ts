import type {
  ContextItem,
  DerivedContent,
  GenerationPolicy,
  OriginalAsset,
  TriggerPolicy,
  User,
  V2Relationship,
} from '../../domain'

export interface CaptureRelationship {
  relationship: V2Relationship
  subject: User
  recorders: readonly User[]
  recipient: User
  buyer?: User
}

export interface ReviewedContextCapture {
  context: ContextItem
  originalAsset: OriginalAsset
  derivedContent: readonly DerivedContent[]
  generationPolicy: GenerationPolicy
  triggerPolicy: TriggerPolicy
}

export interface GuidedCapturePort {
  listRelationships(): Promise<readonly CaptureRelationship[]>
  saveReviewedCapture(input: ReviewedContextCapture): Promise<ContextItem>
}
