import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { offlineDemoService } from '../data/offlineDemo'

describe('offline V2 Demo integration', () => {
  beforeEach(() => {
    offlineDemoService.reset()
    window.location.hash = '#/capture/new'
  })

  afterEach(() => cleanup())

  it('carries an owner-reviewed Context through Agent provenance to a postcard and response', async () => {
    render(<App />)

    await screen.findByRole('option', { name: 'Lin · Mother and daughter' })
    fireEvent.change(screen.getByLabelText('原始内容'), {
      target: { value: '雨天一起回家的真实记录。' },
    })
    fireEvent.change(screen.getByLabelText('主题'), {
      target: { value: 'Rainy day walk' },
    })
    fireEvent.change(screen.getByLabelText('为什么重要'), {
      target: { value: '这是一段可以原样保留的母女记忆。' },
    })
    fireEvent.click(screen.getByLabelText('想念时'))
    fireEvent.click(screen.getByLabelText('生成一条可逐项审核的 AI 摘要建议'))
    fireEvent.click(screen.getByRole('button', { name: '进入所有者审核' }))

    await screen.findByRole('button', { name: '批准' })
    fireEvent.click(screen.getByRole('button', { name: '批准' }))
    fireEvent.click(screen.getByLabelText('我已审核原始素材、每条 AI 建议、情绪权重和关系范围'))
    fireEvent.click(screen.getByRole('button', { name: '保存已审核 Context' }))
    await screen.findByText('This moment has a place.')

    window.location.hash = '#/recipient'
    await screen.findByRole('button', { name: /主动进入/ })
    fireEvent.click(screen.getByRole('button', { name: /主动进入/ }))
    fireEvent.click(await screen.findByRole('button', { name: /是我的，打开看看/ }))
    await screen.findByText('Rainy day walk')
    expect(screen.getByText('雨天一起回家的真实记录。')).toBeInTheDocument()
    expect(screen.getAllByText(/来源 Context ID/)).toHaveLength(2)
    expect(screen.getByText('AI-generated')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /接受并保存明信片/ }))
    await screen.findByText('这张远行明信片已经为你留存。')
    expect(screen.getByText(/Artifact ID · artifact:interaction:session-demo/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('留下一个接收者回应'), {
      target: { value: '我也记得那场雨。' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保存回应/ }))
    await screen.findByText('已保存为 recipient-authored response。')
    expect(offlineDemoService.getSnapshot().context.topic).toBe('Rainy day walk')
  })

  it('keeps unavailable hardware optional through the software fallback', async () => {
    const { HardwareFlowController } = await import('../features/hardware/HardwareFlowController')
    const { MockHardwareBridge } = await import('../adapters/hardware/MockHardwareBridge')
    const bridge = new MockHardwareBridge({ available: false, createId: () => 'fallback-event' })
    await bridge.bindDevice({
      deviceId: 'loop-demo-device',
      deviceType: 'simulator',
      ownerProof: { identityId: 'person-mei', method: 'mock_confirmation', value: 'LOOP-DEMO' },
    })
    await bridge.entrustDevice({
      deviceId: 'loop-demo-device',
      ownerProof: { identityId: 'person-mei', method: 'mock_confirmation', value: 'LOOP-DEMO' },
      recipientProof: { identityId: 'person-lin', method: 'mock_confirmation', value: 'LOOP-DEMO' },
    })
    const controller = new HardwareFlowController(bridge, { enterRecipientFlow: () => {} })
    const result = await controller.triggerAndEnterRecipient({
      deviceId: 'loop-demo-device',
      recipientId: 'person-lin',
      relationshipId: 'relationship-mei-lin',
      source: 'touch',
      triggerReason: 'user_opened',
      allowFallback: true,
    })
    expect(result.outcome).toBe('accepted')
    if (result.outcome === 'accepted') {
      expect(result.event.payload).toMatchObject({ fallback: true, originalSource: 'touch' })
      await waitFor(() => expect(result.event.recipientId).toBe('person-lin'))
    }
  })
})
