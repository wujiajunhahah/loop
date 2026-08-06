import type {
  AgentPolicy,
  Memory,
  OriginalContent,
  PlannedInteraction,
  RecipientSession,
  Relationship,
} from '../../domain'

export type AgentContextSection =
  | 'public_persona'
  | 'relationship_specific'
  | 'private'
  | 'planned_interactions'
  | 'policy'

export type PlaybackDecision =
  | {
      allowed: true
      provenance: 'original' | 'ai_organized'
    }
  | {
      allowed: false
      provenance: 'original' | 'ai_organized'
      reason:
        | 'memory_not_allowed'
        | 'private_content'
        | 'wrong_owner'
        | 'wrong_relationship'
        | 'wrong_recipient'
        | 'blocked_topic'
        | 'ai_organization_disabled'
        | 'owner_review_required'
        | 'source_not_allowed'
    }

export type PlaybackDenialReason = Extract<
  PlaybackDecision,
  { allowed: false }
>['reason']

export interface AgentPolicyCapabilities {
  allowOriginalPlayback: boolean
  allowAiOrganization: boolean
  allowGeneratedText: boolean
  allowProactiveTrigger: boolean
}

export interface AssembledMemory {
  memory: Memory
  original: PlaybackDecision
  organized: PlaybackDecision
}

export type PlannedInteractionState =
  | 'planned'
  | 'invited'
  | 'accepted'
  | 'completed'
  | 'skipped'

export interface ManagedPlannedInteraction {
  interaction: PlannedInteraction
  state: PlannedInteractionState
}

export interface RelationshipContext {
  relationship: Relationship
  session: RecipientSession
  sections: {
    public_persona: readonly AssembledMemory[]
    relationship_specific: readonly AssembledMemory[]
    private: { exposed: false }
    planned_interactions: readonly ManagedPlannedInteraction[]
    policy: AgentPolicyCapabilities
  }
  policy: AgentPolicy
}

export interface AgentContextRepository {
  getRelationship(id: string): Promise<Relationship | undefined>
  getMemories(): Promise<readonly Memory[]>
  getPolicy(relationshipId: string): Promise<AgentPolicy | undefined>
  getRecipientSession(id: string): Promise<RecipientSession | undefined>
  getPlannedInteractions(
    relationshipId: string,
  ): Promise<readonly PlannedInteraction[]>
}

export type PresentedContent =
  | {
      provenance: 'original'
      memoryId: string
      topic: string
      meaning: string
      content: OriginalContent
    }
  | {
      provenance: 'ai_organized'
      memoryId: string
      topic: string
      text: string
      sourceMemoryIds: readonly string[]
      reviewedByOwner: true
    }

export interface AgentInvitation {
  kind: 'invitation'
  interactionId: string
  title: string
  invitation: string
  state: 'invited' | 'accepted'
}

export interface RecipientAgentView {
  relationshipId: string
  recipientId: string
  content: PresentedContent
  invitation?: AgentInvitation
  policy: AgentPolicyCapabilities
}

export interface RelationshipAgentInput {
  relationshipId: string
  sessionId: string
  delivery?: 'recipient_request' | 'designed_encounter'
}

export interface RelationshipAgentPort {
  enter(input: RelationshipAgentInput): Promise<RecipientAgentView>
}
