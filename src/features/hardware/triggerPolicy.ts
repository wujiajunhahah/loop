import {
  createDefaultTriggerPolicy,
  type TriggerPolicy,
  type TriggerReason,
} from '../../domain'

export const triggerReasons = [
  'user_opened',
  'scheduled_date',
  'milestone',
  'weather_context',
  'location_context',
  'plan_progress',
] as const satisfies readonly TriggerReason[]

export type TriggerPolicyOutcome =
  | 'allowed'
  | 'rejected_reason'
  | 'rejected_opt_in'
  | 'rejected_proactive'

export type TriggerPolicyResolver = (relationshipId: string) => TriggerPolicy

export const defaultTriggerPolicyResolver: TriggerPolicyResolver = (relationshipId) =>
  createDefaultTriggerPolicy(relationshipId)

export function evaluateTriggerPolicy(
  policy: TriggerPolicy,
  reason: TriggerReason,
): TriggerPolicyOutcome {
  if (!policy.allowedReasons.includes(reason)) return 'rejected_reason'
  if (policy.mode === 'pull_only') {
    return reason === 'user_opened' ? 'allowed' : 'rejected_reason'
  }
  if (!policy.optedIn) return 'rejected_opt_in'
  if (policy.mode === 'proactive_allowed') return 'rejected_proactive'
  return 'allowed'
}
