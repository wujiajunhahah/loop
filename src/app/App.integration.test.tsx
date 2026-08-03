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

    await screen.findByRole('option', { name: 'Lin · 母女' })
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
    await screen.findByText('这一刻，有了安放的地方。')

    window.location.hash = '#/recipient'
    await screen.findByRole('button', { name: /主动进入/ })
    fireEvent.click(screen.getByRole('button', { name: /主动进入/ }))
    fireEvent.click(await screen.findByRole('button', { name: /继续到今天的回应/ }))
    fireEvent.change(await screen.findByLabelText('今天发生了什么？'), {
      target: { value: '今天下雨，我又忘记带伞了。' },
    })
    fireEvent.click(screen.getByRole('button', { name: /让过去的记忆回应现在/ }))
    await screen.findByText('一份给今天的回应。')
    expect(screen.getByText('雨天一起回家的真实记录。')).toBeInTheDocument()
    expect(screen.getAllByText(/来源 Context ID/)).toHaveLength(2)
    expect(screen.getByText(/这让 W·HERE 找到一段经过本人确认的记忆/)).toHaveTextContent('今天下雨，我又忘记带伞了。')

    fireEvent.click(screen.getByRole('button', { name: /收藏这封远方回信/ }))
    await screen.findByText('今天与过去，都被好好放在这里。')
    expect(screen.getByText(/Artifact ID · artifact:interaction:session-demo/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('为今天再留一句话'), {
      target: { value: '我也记得那场雨。' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保存我的话/ }))
    await screen.findByText('已独立保存为接收者内容，不会成为记录者生前事实。')
    expect(offlineDemoService.getSnapshot().context.topic).toBe('Rainy day walk')
    expect(offlineDemoService.getSnapshot().context.meaning).toBe('这是一段可以原样保留的母女记忆。')
    expect(offlineDemoService.getSnapshot().context.meaning).not.toContain('我又忘记带伞')
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

  it('enters Echo Map after identity confirmation and completes one sourced glimmer journey', async () => {
    window.location.hash = '#/recipient'
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /主动进入/ }))
    fireEvent.click(await screen.findByRole('button', { name: '进入 Echo Map 旅程' }))
    await screen.findByRole('heading', { name: '同一把伞下的雨' })

    fireEvent.click(screen.getByRole('radio', { name: '微光' }))
    fireEvent.click(screen.getByRole('button', { name: '查看这段旅程' }))
    fireEvent.click(await screen.findByRole('button', { name: '采用中立动作' }))
    fireEvent.click(await screen.findByRole('button', { name: '我已经做了' }))
    await screen.findByRole('heading', { name: '那次雨中回家。' })
    fireEvent.click(screen.getByRole('button', { name: '打开原始内容' }))
    expect(screen.getByText(/你从小就总忘带伞/)).toBeInTheDocument()
    expect(screen.getAllByText(/AI 生成/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('context-rainy-day').length).toBeGreaterThan(0)
    expect(screen.getAllByText('asset-rainy-day').length).toBeGreaterThan(0)
    expect(screen.getByText('source_replay')).toBeInTheDocument()
    expect(screen.getByText('source_composition')).toBeInTheDocument()
    expect(offlineDemoService.getJourneySnapshot().presentation).toMatchObject({
      original: {
        aiLabel: 'Original source',
        provenance: {
          sourceContextIds: ['context-rainy-day'],
          sourceAssetIds: ['asset-rainy-day'],
          aiGenerated: false,
        },
      },
      composition: {
        aiLabel: 'AI-generated',
        provenance: {
          sourceContextIds: ['context-rainy-day'],
          sourceAssetIds: ['asset-rainy-day'],
          aiGenerated: true,
        },
      },
    })

    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    fireEvent.change(await screen.findByLabelText('Lin 今天的回应'), {
      target: { value: '今天我也听见了雨。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存并生成明信片' }))
    await screen.findByRole('heading', { name: '雨，被带到了今天。' })
    expect(screen.getByText(/今天我也听见了雨/)).toBeInTheDocument()
    expect(screen.getAllByText('asset-rainy-day').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '收藏明信片并点亮节点' }))
    await screen.findByText('记忆节点已点亮 · 旅程完成')
    expect(offlineDemoService.getJourneySnapshot().session).toMatchObject({
      state: 'node_lit',
      artifactId: 'artifact:interaction:journey:journey-rainy-day-1',
    })
    expect(offlineDemoService.getJourneySnapshot().response).toMatchObject({
      authorRole: 'recipient',
      eligibleAsRecorderContext: false,
    })
  })

  it('does not create a journey from a direct Echo Map URL without confirmation', async () => {
    window.location.hash = '#/recipient'
    render(<App />)
    await screen.findByRole('button', { name: /主动进入/ })
    window.location.hash = '#/recipient/echo-map'
    await screen.findByRole('heading', { name: '请先确认这是留给你的。' })
    expect(offlineDemoService.getJourneySnapshot().session).toBeUndefined()
  })

  it('revokes Echo Map entry after leaving the authorized route', async () => {
    window.location.hash = '#/recipient'
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /主动进入/ }))
    fireEvent.click(await screen.findByRole('button', { name: '进入 Echo Map 旅程' }))
    await screen.findByRole('heading', { name: '同一把伞下的雨' })

    window.location.hash = '#/'
    await screen.findByRole('heading', { name: /过去的记忆/ })
    window.location.hash = '#/recipient/echo-map'

    await screen.findByRole('heading', { name: '请先确认这是留给你的。' })
  })
})
