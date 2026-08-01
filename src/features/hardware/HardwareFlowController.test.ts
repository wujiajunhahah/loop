import { describe, expect, it, vi } from 'vitest'
import { MockHardwareBridge, hardwareEventTypes } from '../../adapters/hardware'
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
  it.each(hardwareEventTypes)(
    'sends a verified %s event through the same recipient entry flow',
    async (eventType) => {
      const bridge = await configuredBridge()
      const enterRecipientFlow = vi.fn()
      const notifier: RecipientFlowNotifier = { enterRecipientFlow }
      const controller = new HardwareFlowController(bridge, notifier)
      const stages: string[] = []
      bridge.subscribeLifecycle(({ stage }) => stages.push(stage))

      const result = await controller.triggerAndEnterRecipient({
        deviceId: 'device-a',
        recipientId: 'recipient-a',
        eventType,
      })

      expect(result.outcome).toBe('accepted')
      expect(enterRecipientFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType,
          recipientId: 'recipient-a',
          verificationStatus: 'verified',
        }),
      )
      expect(stages).toEqual(['produced', 'verified', 'consumed'])
    },
  )

  it('does not notify the recipient flow for a rejected event', async () => {
    const bridge = await configuredBridge()
    const enterRecipientFlow = vi.fn()
    const controller = new HardwareFlowController(bridge, {
      enterRecipientFlow,
    })

    const result = await controller.triggerAndEnterRecipient({
      deviceId: 'device-a',
      recipientId: 'someone-else',
      eventType: 'touch',
    })

    expect(result.outcome).toBe('invalid_identity')
    expect(enterRecipientFlow).not.toHaveBeenCalled()
  })
})
