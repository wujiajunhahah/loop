import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StrictMode } from 'react'
import { OfflineDemoService } from '../../../data/offlineDemo'
import { EchoMapJourneyExperience } from './EchoMapJourneyExperience'

const now = '2026-08-02T10:00:00.000Z'

class FlakyJourneyData extends OfflineDemoService {
  memoryFailures = 0
  postcardFailures = 0
  nodeFailures = 0

  override async loadJourneyMemory(sessionId: string) {
    if (this.memoryFailures > 0) {
      this.memoryFailures -= 1
      throw new Error('Agent unavailable')
    }
    return super.loadJourneyMemory(sessionId)
  }

  override async createJourneyPostcard(sessionId: string) {
    if (this.postcardFailures > 0) {
      this.postcardFailures -= 1
      throw new Error('Artifact store unavailable')
    }
    return super.createJourneyPostcard(sessionId)
  }

  override async lightJourneyNode(sessionId: string) {
    if (this.nodeFailures > 0) {
      this.nodeFailures -= 1
      throw new Error('Node store unavailable')
    }
    return super.lightJourneyNode(sessionId)
  }
}

class DeferredMemoryData extends OfflineDemoService {
  private release!: () => void
  private readonly gate = new Promise<void>((resolve) => {
    this.release = resolve
  })

  continueMemory() {
    this.release()
  }

  override async loadJourneyMemory(sessionId: string) {
    await this.gate
    return super.loadJourneyMemory(sessionId)
  }
}

function renderJourney(data = new OfflineDemoService(() => now)) {
  window.location.hash = '#/recipient/echo-map'
  render(<EchoMapJourneyExperience data={data} />)
  return data
}

async function reachMemory(intensity: 'quiet' | 'glimmer' = 'quiet') {
  if (intensity !== 'quiet') {
    fireEvent.click(screen.getByRole('radio', { name: '微光' }))
  }
  fireEvent.click(screen.getByRole('button', { name: '查看这段旅程' }))
  fireEvent.click(await screen.findByRole('button', { name: '采用中立动作' }))
  fireEvent.click(await screen.findByRole('button', { name: '我已经做了' }))
  await screen.findByRole('heading', { name: '那次雨中回家。' })
}

describe('Echo Map journey UI', () => {
  beforeEach(() => {
    window.location.hash = '#/recipient/echo-map'
  })

  afterEach(() => cleanup())

  it('completes the glimmer path with separate source layers and one lit node', async () => {
    const data = renderJourney()
    await reachMemory('glimmer')

    expect(screen.getByText('基于授权来源的整理')).toBeInTheDocument()
    expect(screen.getAllByText(/AI 生成/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/你从小就总忘带伞/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '打开原始内容' }))
    expect(screen.getByText(/你从小就总忘带伞/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    fireEvent.change(await screen.findByLabelText('Lin 今天的回应'), {
      target: { value: 'I heard rain against my window today.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存并生成明信片' }))
    await screen.findByRole('heading', { name: '雨，被带到了今天。' })
    expect(screen.getByText(/I heard rain against my window today/)).toBeInTheDocument()
    expect(screen.getAllByText(/context-rainy-day/).length).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByRole('button', { name: '收藏明信片并点亮节点' }))
    await screen.findByText('记忆节点已点亮 · 旅程完成')
    expect(data.getJourneySnapshot().session).toMatchObject({
      state: 'node_lit',
      completedAt: now,
    })
    fireEvent.click(screen.getByRole('button', { name: '打开明信片' }))
    await screen.findByRole('button', { name: '返回已点亮的节点' })
    expect(screen.queryByRole('button', { name: '收藏明信片并点亮节点' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保留明信片，不点亮' })).not.toBeInTheDocument()
  })

  it('keeps quiet source-only and supports explicit response omission', async () => {
    const data = renderJourney()
    await reachMemory()
    expect(screen.queryByText('基于授权来源的整理')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    fireEvent.click(await screen.findByRole('button', { name: '不写回应，继续' }))
    await screen.findByRole('heading', { name: '雨，被带到了今天。' })
    expect(data.getJourneySnapshot().response).toMatchObject({
      kind: 'omitted',
      eligibleAsRecorderContext: false,
    })
    expect(data.getJourneySnapshot().artifact?.recipientResponse).toBeUndefined()
  })

  it('keeps skip and current-Demo hide visibly incomplete', async () => {
    const data = renderJourney()
    fireEvent.click(screen.getByRole('button', { name: '查看这段旅程' }))
    fireEvent.click(await screen.findByRole('button', { name: '这次跳过' }))
    await screen.findByRole('heading', { name: '同一把伞下的雨' })
    expect(data.getJourneySnapshot().session?.state).toBe('skipped')
    expect(data.getJourneySnapshot().node.status).toBe('available')
    const skippedId = data.getJourneySnapshot().session?.id
    fireEvent.click(screen.getByRole('button', { name: '查看这段旅程' }))
    await screen.findByRole('button', { name: '采用中立动作' })
    expect(data.getJourneySnapshot().session?.id).not.toBe(skippedId)

    cleanup()
    const hiddenData = renderJourney()
    fireEvent.click(screen.getByRole('button', { name: '在本次 Demo 中隐藏' }))
    expect(screen.getByRole('dialog', { name: '隐藏这段旅程？' })).toBeInTheDocument()
    expect(screen.getByText(/本次 Demo 重置前/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认隐藏' }))
    await screen.findByText('这段旅程在当前 Demo 中已被隐藏。')
    expect(hiddenData.getJourneySnapshot().node.status).toBe('hidden')
    expect(hiddenData.getJourneySnapshot().session?.completedAt).toBeUndefined()
  })

  it('requires restart when a mid-journey URL has no in-memory session', () => {
    window.location.hash = '#/recipient/echo-map/memory'
    render(<EchoMapJourneyExperience data={new OfflineDemoService(() => now)} />)
    expect(screen.getByRole('heading', { name: '这段旅程需要重新确认。' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回 Echo Map' }))
    expect(window.location.hash).toBe('#/recipient/echo-map')
  })

  it('recovers from Agent and postcard failures without false completion', async () => {
    const data = new FlakyJourneyData(() => now)
    data.memoryFailures = 1
    renderJourney(data)
    fireEvent.click(screen.getByRole('button', { name: '查看这段旅程' }))
    fireEvent.click(await screen.findByRole('button', { name: '采用中立动作' }))
    fireEvent.click(await screen.findByRole('button', { name: '我已经做了' }))
    await screen.findByRole('alert')
    expect(screen.getByText('Agent unavailable')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(data.getJourneySnapshot().session?.state).toBe('action_completed')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByRole('heading', { name: '那次雨中回家。' })

    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    fireEvent.click(await screen.findByRole('button', { name: '不写回应，继续' }))
    data.postcardFailures = 1
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Artifact store unavailable'))
    expect(data.getJourneySnapshot().session?.state).toBe('response_recorded')
    expect(data.getJourneySnapshot().node.status).toBe('available')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByRole('heading', { name: '雨，被带到了今天。' })
  })

  it('resumes an accepted action after returning to the map', async () => {
    const data = renderJourney()
    fireEvent.click(screen.getByRole('button', { name: '查看这段旅程' }))
    fireEvent.click(await screen.findByRole('button', { name: '采用中立动作' }))
    expect(data.getJourneySnapshot().session?.state).toBe('action_accepted')

    window.location.hash = '#/recipient/echo-map'
    fireEvent(window, new HashChangeEvent('hashchange'))
    fireEvent.click(await screen.findByRole('button', { name: '继续旅程' }))
    expect(await screen.findByRole('heading', { name: '在窗边停一会儿。' })).toBeInTheDocument()
  })

  it('contains hide confirmation focus and restores it on Escape', async () => {
    renderJourney()
    const trigger = screen.getByRole('button', { name: '在本次 Demo 中隐藏' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: '隐藏这段旅程？' })
    expect(screen.getByRole('button', { name: '确认隐藏' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('retries node lighting without losing a valid postcard', async () => {
    const data = new FlakyJourneyData(() => now)
    renderJourney(data)
    await reachMemory()
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    fireEvent.click(await screen.findByRole('button', { name: '不写回应，继续' }))
    await screen.findByRole('heading', { name: '雨，被带到了今天。' })
    data.nodeFailures = 1
    fireEvent.click(screen.getByRole('button', { name: '收藏明信片并点亮节点' }))
    await screen.findByRole('alert')
    expect(screen.getByText('Node store unavailable')).toHaveFocus()
    expect(data.getJourneySnapshot().session?.state).toBe('postcard_created')
    expect(data.getJourneySnapshot().artifact).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '重试点亮节点' }))
    await screen.findByText('记忆节点已点亮 · 旅程完成')
  })

  it('completes async loading under application StrictMode', async () => {
    const data = new OfflineDemoService(() => now)
    window.location.hash = '#/recipient/echo-map'
    render(<StrictMode><EchoMapJourneyExperience data={data} /></StrictMode>)
    await reachMemory('glimmer')
    expect(screen.getByText('基于授权来源的整理')).toBeInTheDocument()
  })

  it('reattaches to one in-flight memory request after component remount', async () => {
    const data = new DeferredMemoryData(() => now)
    window.location.hash = '#/recipient/echo-map'
    render(<EchoMapJourneyExperience data={data} />)
    fireEvent.click(screen.getByRole('button', { name: '查看这段旅程' }))
    fireEvent.click(await screen.findByRole('button', { name: '采用中立动作' }))
    fireEvent.click(await screen.findByRole('button', { name: '我已经做了' }))
    await screen.findByRole('heading', { name: '正在准备经过确认的来源' })
    cleanup()
    render(<EchoMapJourneyExperience data={data} />)
    data.continueMemory()
    await screen.findByRole('heading', { name: '那次雨中回家。' })
    expect(data.getJourneySnapshot().session?.state).toBe('memory_opened')
  })
})
