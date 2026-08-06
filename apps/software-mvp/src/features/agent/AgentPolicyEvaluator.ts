import {
  canAgentUseMemory,
  type AgentPolicy,
  type Memory,
  type Relationship,
} from '../../domain'
import type {
  AgentPolicyCapabilities,
  PlaybackDecision,
  PlaybackDenialReason,
} from './types'

export class AgentPolicyEvaluator {
  originalPlayback(
    memory: Memory,
    relationship: Relationship,
    recipientId: string,
    policy: AgentPolicy,
  ): PlaybackDecision {
    const denial = this.memoryDenialReason(
      memory,
      relationship,
      recipientId,
      policy,
    )

    return denial
      ? { allowed: false, provenance: 'original', reason: denial }
      : { allowed: true, provenance: 'original' }
  }

  organizedPlayback(
    memory: Memory,
    relationship: Relationship,
    recipientId: string,
    policy: AgentPolicy,
    allMemories: readonly Memory[],
  ): PlaybackDecision {
    const denial = this.memoryDenialReason(
      memory,
      relationship,
      recipientId,
      policy,
    )
    if (denial) {
      return { allowed: false, provenance: 'ai_organized', reason: denial }
    }
    if (!policy.allowAiOrganization) {
      return {
        allowed: false,
        provenance: 'ai_organized',
        reason: 'ai_organization_disabled',
      }
    }
    if (!memory.organized?.reviewedByOwner) {
      return {
        allowed: false,
        provenance: 'ai_organized',
        reason: 'owner_review_required',
      }
    }
    const sources = memory.organized.sourceMemoryIds.map((sourceId) =>
      allMemories.find((candidate) => candidate.id === sourceId),
    )
    if (
      sources.length === 0 ||
      sources.some(
        (source) =>
          !source ||
          this.memoryDenialReason(
            source,
            relationship,
            recipientId,
            policy,
          ) !== undefined,
      )
    ) {
      return {
        allowed: false,
        provenance: 'ai_organized',
        reason: 'source_not_allowed',
      }
    }

    return { allowed: true, provenance: 'ai_organized' }
  }

  capabilities(
    policy: AgentPolicy,
    recipientEntered: boolean,
  ): AgentPolicyCapabilities {
    return {
      allowOriginalPlayback: policy.allowedMemoryIds.length > 0,
      allowAiOrganization: policy.allowAiOrganization,
      allowGeneratedText: policy.allowNewMemoryGeneration,
      allowProactiveTrigger:
        recipientEntered && policy.proactiveDelivery === 'after_recipient_entry',
    }
  }

  private memoryDenialReason(
    memory: Memory,
    relationship: Relationship,
    recipientId: string,
    policy: AgentPolicy,
  ): PlaybackDenialReason | undefined {
    if (memory.visibility === 'private') return 'private_content'
    if (memory.ownerId !== relationship.ownerId) return 'wrong_owner'
    if (policy.relationshipId !== relationship.id) return 'wrong_relationship'
    if (
      memory.visibility === 'relationship_specific' &&
      memory.relationshipId !== relationship.id
    ) {
      return 'wrong_relationship'
    }
    if (
      memory.visibility === 'relationship_specific' &&
      memory.recipientId !== recipientId
    ) {
      return 'wrong_recipient'
    }
    if (
      policy.blockedTopics.some(
        (topic) => topic.trim().toLowerCase() === memory.topic.trim().toLowerCase(),
      )
    ) {
      return 'blocked_topic'
    }
    if (!canAgentUseMemory(memory, relationship.id, recipientId, policy)) {
      return 'memory_not_allowed'
    }

    return undefined
  }
}
