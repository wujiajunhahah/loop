import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { CaptureFlow } from './CaptureFlow'
import { contextCaptureService } from '../../data/services'
import {
  clearDeviceInteractionHandoff,
  writeDeviceInteractionHandoff,
} from '../devices/deviceInteractionHandoff'

describe('CaptureFlow', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    window.location.hash = '#/capture/new'
    vi.restoreAllMocks()
    clearDeviceInteractionHandoff()
    sessionStorage.clear()
  })

  it('starts with AI organization disabled and reports missing fields', async () => {
    const view = render(<CaptureFlow route="/capture/new" />)

    await waitFor(() => expect(screen.getByText(/Lin · Mother and daughter/)).toBeInTheDocument())
    expect(screen.queryByLabelText('允许 AI 整理这条记录')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '查看审核内容' }))

    expect(screen.getByRole('alert')).toHaveTextContent('请先写下内容')
    expect(screen.getByRole('alert')).toHaveTextContent('请给这条记录一个主题')
    expect(screen.getByRole('alert')).toHaveTextContent('请说明为什么要留给这个人')
  })

  it('keeps original-only records outside AI organization', async () => {
    const view = render(<CaptureFlow route="/capture/new" />)
    await waitFor(() => expect(screen.getByText(/Lin · Mother and daughter/)).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('写下想留给对方的内容...'), { target: { value: '只播放这一段话' } })
    fireEvent.change(screen.getByPlaceholderText('例如：五道家庭菜的第一道'), { target: { value: '厨房里的晚上' } })
    fireEvent.change(screen.getByPlaceholderText('这段内容和你们的关系有什么特别之处？'), { target: { value: '因为这是只想留给 Lin 的记忆。' } })
    fireEvent.click(screen.getByLabelText('只允许原样播放'))
    fireEvent.click(screen.getByRole('button', { name: '查看审核内容' }))
    view.rerender(<CaptureFlow route="/capture/review" />)

    expect(window.location.hash).toBe('#/capture/review')
    expect(screen.getByText('这条记录不会被 AI 整理。启用后才会生成整理预览。')).toBeInTheDocument()
    expect(screen.getByLabelText('允许 AI 整理这条记录')).toBeDisabled()
  })

  it('requires boundary confirmation before saving', async () => {
    const capture = vi.spyOn(contextCaptureService, 'capture').mockResolvedValue({
      id: 'memory-test', ownerId: 'person-mei', relationshipId: 'relationship-mei-lin', recipientId: 'person-lin',
      topic: '[真实回忆] 一段记忆', meaning: '留给 Lin', visibility: 'relationship_specific',
      original: { kind: 'original', modality: 'text', uri: 'memory://text/test', capturedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
    })
    render(<CaptureFlow route="/capture/review" />)
    fireEvent.click(screen.getByRole('button', { name: '确认并保存' }))

    expect(screen.getByRole('alert')).toHaveTextContent('请确认 AI 使用边界')
    expect(capture).not.toHaveBeenCalled()
  })

  it('reviews and saves verified device provenance without automatic capture', async () => {
    writeDeviceInteractionHandoff({
      version: 1,
      purpose: 'creator_capture',
      eventId: 'mark-verified-1',
      interaction: 'mark_moment',
      deviceId: 'ring-verified-1',
      deviceName: 'Alloop Ring',
      source: 'simulated',
      occurredAt: '2026-08-03T00:00:00.000Z',
      verification: 'binding_verified',
    })
    const capture = vi.spyOn(contextCaptureService, 'capture').mockResolvedValue({
      id: 'memory-device-mark', ownerId: 'person-mei', relationshipId: 'relationship-mei-lin', recipientId: 'person-lin',
      topic: '[真实回忆] 厨房里的晚上', meaning: '这是想留给 Lin 的一刻。', visibility: 'relationship_specific',
      original: { kind: 'original', modality: 'text', uri: 'memory://text/device-mark', capturedAt: '2026-08-03T00:01:00.000Z' },
      createdAt: '2026-08-03T00:01:00.000Z',
    })
    const view = render(<CaptureFlow route="/capture/new" />)

    expect(screen.getByRole('region', { name: '设备标记来源' })).toHaveTextContent('Alloop Ring')
    expect(screen.getByText(/不会启动麦克风、相机、播放或分享/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Lin · Mother and daughter/)).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('写下想留给对方的内容...'), { target: { value: '今天一起做了第一道菜。' } })
    fireEvent.change(screen.getByPlaceholderText('例如：五道家庭菜的第一道'), { target: { value: '厨房里的晚上' } })
    fireEvent.change(screen.getByPlaceholderText('这段内容和你们的关系有什么特别之处？'), { target: { value: '这是想留给 Lin 的一刻。' } })
    fireEvent.click(screen.getByRole('button', { name: '查看审核内容' }))
    view.rerender(<CaptureFlow route="/capture/review" />)
    fireEvent.click(screen.getByLabelText('我已审核原始内容、整理预览和使用边界'))
    fireEvent.click(screen.getByRole('button', { name: '确认并保存' }))

    await waitFor(() => expect(capture).toHaveBeenCalledWith(expect.objectContaining({
      trigger: expect.objectContaining({
        eventId: 'mark-verified-1',
        deviceName: 'Alloop Ring',
        verification: 'binding_verified',
      }),
    })))
  })
})
