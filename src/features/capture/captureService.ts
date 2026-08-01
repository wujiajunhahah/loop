import type {
  ContextItem,
  DerivedContent,
  GenerationPolicy,
  OriginalAsset,
  TriggerPolicy,
} from '../../domain'
import type {
  CaptureRelationship,
  GuidedCapturePort,
  ReviewedContextCapture,
} from './captureTypes'

const relationships: readonly CaptureRelationship[] = [
  {
    relationship: {
      contractVersion: 2,
      id: 'relationship-mei-lin',
      subjectId: 'person-mei',
      ownerId: 'person-mei',
      recorderIds: ['person-mei'],
      recipientId: 'person-lin',
      buyerId: 'person-mei',
      label: 'Mother and daughter',
      kind: 'parent_child',
      status: 'active',
    },
    subject: { id: 'person-mei', displayName: 'Mei', roles: ['subject', 'recorder', 'buyer'] },
    recorders: [{ id: 'person-mei', displayName: 'Mei', roles: ['subject', 'recorder', 'buyer'] }],
    recipient: { id: 'person-lin', displayName: 'Lin', roles: ['recipient'] },
    buyer: { id: 'person-mei', displayName: 'Mei', roles: ['subject', 'recorder', 'buyer'] },
  },
  {
    relationship: {
      contractVersion: 2,
      id: 'relationship-jian-ning',
      subjectId: 'person-jian',
      ownerId: 'person-jian',
      recorderIds: ['person-jian'],
      recipientId: 'person-ning',
      buyerId: 'person-yao',
      label: 'Grandfather and granddaughter',
      kind: 'grandparent_descendant',
      status: 'active',
    },
    subject: { id: 'person-jian', displayName: 'Jian', roles: ['subject', 'recorder'] },
    recorders: [{ id: 'person-jian', displayName: 'Jian', roles: ['subject', 'recorder'] }],
    recipient: { id: 'person-ning', displayName: 'Ning', roles: ['recipient'] },
    buyer: { id: 'person-yao', displayName: 'Yao', roles: ['buyer'] },
  },
]

class InMemoryGuidedCaptureService implements GuidedCapturePort {
  private readonly contexts = new Map<string, ContextItem>()
  private readonly assets = new Map<string, OriginalAsset>()
  private readonly derived = new Map<string, DerivedContent>()
  private readonly generationPolicies = new Map<string, GenerationPolicy>()
  private readonly triggerPolicies = new Map<string, TriggerPolicy>()

  async listRelationships() {
    return relationships
  }

  async saveReviewedCapture(input: ReviewedContextCapture) {
    const selected = relationships.find(
      ({ relationship }) => relationship.id === input.context.relationshipId,
    )
    if (
      !selected ||
      input.context.subjectId !== selected.relationship.subjectId ||
      input.context.recipientId !== selected.relationship.recipientId ||
      !selected.relationship.recorderIds.includes(input.context.recorderId)
    ) {
      throw new Error('Context relationship and recipient scope do not match.')
    }
    if (
      input.originalAsset.contextId !== input.context.id ||
      input.originalAsset.id !== input.context.originalAssetId
    ) {
      throw new Error('Original asset does not match its Context.')
    }
    if (
      input.generationPolicy.relationshipId !== selected.relationship.id ||
      input.triggerPolicy.relationshipId !== selected.relationship.id ||
      !input.generationPolicy.allowedContextIds.includes(input.context.id)
    ) {
      throw new Error('Capture policies do not match their Context relationship.')
    }
    const reviewedIds = input.derivedContent.map((item) => {
      if (
        item.contextId !== input.context.id ||
        !item.reviewedByUserId ||
        !item.reviewedAt ||
        !item.provenance.sourceContextIds.includes(input.context.id) ||
        !item.provenance.sourceAssetIds.includes(input.originalAsset.id)
      ) {
        throw new Error('AI suggestions require explicit owner review and provenance.')
      }
      return item.id
    })
    if (
      reviewedIds.length !== input.context.derivedContentIds.length ||
      reviewedIds.some((id) => !input.context.derivedContentIds.includes(id))
    ) {
      throw new Error('Only reviewed AI suggestions may be attached to a Context.')
    }

    const savedContext = structuredClone(input.context)
    this.contexts.set(savedContext.id, savedContext)
    this.assets.set(input.originalAsset.id, structuredClone(input.originalAsset))
    input.derivedContent.forEach((item) => this.derived.set(item.id, structuredClone(item)))
    this.generationPolicies.set(
      input.generationPolicy.relationshipId,
      structuredClone(input.generationPolicy),
    )
    this.triggerPolicies.set(
      input.triggerPolicy.relationshipId,
      structuredClone(input.triggerPolicy),
    )
    return structuredClone(savedContext)
  }
}

export const guidedCaptureService: GuidedCapturePort = new InMemoryGuidedCaptureService()
