import type { TriggerMode, TriggerReason } from '../../domain'
import type {
  EntryTriggerResult,
  HardwareBridge,
  TriggerEntryEventInput,
} from '../../adapters/hardware'
import type { RecipientFlowNotifier } from './recipientNotifier'
import {
  defaultTriggerPolicyResolver,
  evaluateTriggerPolicy,
  type TriggerPolicyOutcome,
  type TriggerPolicyResolver,
} from './triggerPolicy'

export type HardwareFlowResult =
  | (EntryTriggerResult & {
      triggerReason: TriggerReason
      triggerMode: TriggerMode
      policyOutcome: 'allowed'
    })
  | {
      outcome: 'policy_rejected'
      triggerReason: TriggerReason
      triggerMode: TriggerMode
      policyOutcome: Exclude<TriggerPolicyOutcome, 'allowed'>
      fallbackUsed: false
    }

export class HardwareFlowController {
  constructor(
    private readonly bridge: HardwareBridge,
    private readonly recipientNotifier: RecipientFlowNotifier,
    private readonly resolvePolicy: TriggerPolicyResolver = defaultTriggerPolicyResolver,
  ) {}

  async triggerAndEnterRecipient(
    input: TriggerEntryEventInput & { triggerReason?: TriggerReason },
  ): Promise<HardwareFlowResult> {
    const triggerReason = input.triggerReason ?? 'user_opened'
    const policy = this.resolvePolicy(input.relationshipId ?? 'unscoped')
    const policyOutcome = evaluateTriggerPolicy(policy, triggerReason)
    if (policyOutcome !== 'allowed') {
      return {
        outcome: 'policy_rejected',
        triggerReason,
        triggerMode: policy.mode,
        policyOutcome,
        fallbackUsed: false,
      }
    }

    const result = await this.bridge.trigger(input)
    if (result.outcome !== 'accepted') {
      return { ...result, triggerReason, triggerMode: policy.mode, policyOutcome }
    }

    this.recipientNotifier.enterRecipientFlow(result.event)
    await this.bridge.consume(result.event.id)
    return { ...result, triggerReason, triggerMode: policy.mode, policyOutcome }
  }
}
