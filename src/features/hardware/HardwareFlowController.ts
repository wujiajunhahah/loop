import type {
  HardwareBridge,
  HardwareEvent,
  HardwareTriggerResult,
  TriggerHardwareEventInput,
} from '../../adapters/hardware'
import type { RecipientFlowNotifier } from './recipientNotifier'

export class HardwareFlowController {
  constructor(
    private readonly bridge: HardwareBridge,
    private readonly recipientNotifier: RecipientFlowNotifier,
  ) {}

  async triggerAndEnterRecipient(
    input: TriggerHardwareEventInput,
  ): Promise<HardwareTriggerResult> {
    const result = await this.bridge.trigger(input)
    if (result.outcome !== 'accepted') return result

    this.assertVerified(result.event)
    this.recipientNotifier.enterRecipientFlow(result.event)
    await this.bridge.consume(result.event.eventId)
    return result
  }

  private assertVerified(
    event: HardwareEvent,
  ): asserts event is HardwareEvent & { verificationStatus: 'verified' } {
    if (event.verificationStatus !== 'verified') {
      throw new Error('Recipient flow requires a verified hardware event')
    }
  }
}
