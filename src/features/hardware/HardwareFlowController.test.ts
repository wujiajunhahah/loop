import { describe, expect, it, vi } from 'vitest'
import { MockHardwareBridge, triggerSources } from '../../adapters/hardware'
import { HardwareFlowController } from './HardwareFlowController'
import type { RecipientFlowNotifier } from './recipientNotifier'

async function configuredBridge() {
  const bridge = new MockHardwareBridge()
  const ownerProof = {
    identityId: 'owner-a',
    method: 'mock_code' as const,
    value: 'LOOP-DEMO',
  }
  await bridge.bindDevice({
    deviceId: 'device-a',
    deviceType: 'wearable-or-object',
    ownerProof,
  })
  await bridge.entrustDevice({
    deviceId: 'device-a',
    ownerProof,
    recipientProof: {
      identityId: 'recipient-a',
      method: 'mock_confirmation',
      value: 'LOOP-DEMO',
    },
  })
  return bridge
}

describe('HardwareFlowController', () => {
  it.each(triggerSources)(
    'sends a verified %s event through the same EntryEvent recipient boundary',
    async (source) => {
      const bridge = await configuredBridge()
      const enterRecipientFlow = vi.fn()
      const notifier: RecipientFlowNotifier = { enterRecipientFlow }
      const controller = new HardwareFlowController(bridge, notifier)
      const stages: string[] = []
      bridge.subscribeLifecycle(({ stage }) => stages.push(stage))

      const result = await controller.triggerAndEnterRecipient({
        deviceId: 'device-a',
        recipientId: 'recipient-a',
        relationshipId: 'relationship-a',
        source,
      })

      expect(result).toMatchObject({
        outcome: 'accepted',
        triggerReason: 'user_opened',
        triggerMode: 'pull_only',
        policyOutcome: 'allowed',
      })
      expect(enterRecipientFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          type: 'open',
          recipientId: 'recipient-a',
        }),
      )
      expect(stages).toEqual(['produced', 'verified', 'consumed'])
    },
  )

  it('does not notify the recipient flow for an identity rejection', async () => {
    const bridge = await configuredBridge()
    const enterRecipientFlow = vi.fn()
    const controller = new HardwareFlowController(bridge, { enterRecipientFlow })

    const result = await controller.triggerAndEnterRecipient({
      deviceId: 'device-a',
      recipientId: 'someone-else',
      source: 'touch',
    })

    expect(result.outcome).toBe('invalid_identity')
    expect(enterRecipientFlow).not.toHaveBeenCalled()
  })

  it('defaults to pull_only and explicitly rejects a proactive trigger reason', async () => {
    const bridge = await configuredBridge()
    const listener = vi.fn()
    const enterRecipientFlow = vi.fn()
    bridge.subscribe(listener)
    const controller = new HardwareFlowController(bridge, { enterRecipientFlow })

    const result = await controller.triggerAndEnterRecipient({
      deviceId: 'device-a',
      recipientId: 'recipient-a',
      relationshipId: 'relationship-a',
      source: 'software',
      triggerReason: 'weather_context',
    })

    expect(result).toEqual({
      outcome: 'policy_rejected',
      triggerReason: 'weather_context',
      triggerMode: 'pull_only',
      policyOutcome: 'rejected_reason',
      fallbackUsed: false,
    })
    expect(listener).not.toHaveBeenCalled()
    expect(enterRecipientFlow).not.toHaveBeenCalled()
  })

  it('rejects strong proactive mode even when the relationship opted in', async () => {
    const bridge = await configuredBridge()
    const enterRecipientFlow = vi.fn()
    const controller = new HardwareFlowController(
      bridge,
      { enterRecipientFlow },
      (relationshipId) => ({
        relationshipId,
        mode: 'proactive_allowed',
        allowedReasons: ['milestone'],
        optedIn: true,
      }),
    )

    const result = await controller.triggerAndEnterRecipient({
      deviceId: 'device-a',
      recipientId: 'recipient-a',
      source: 'software',
      triggerReason: 'milestone',
    })

    expect(result).toMatchObject({
      outcome: 'policy_rejected',
      triggerMode: 'proactive_allowed',
      policyOutcome: 'rejected_proactive',
    })
    expect(enterRecipientFlow).not.toHaveBeenCalled()
  })
})
