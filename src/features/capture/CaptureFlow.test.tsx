import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CaptureRelationship, GuidedCapturePort, ReviewedContextCapture } from './captureTypes'
import { CaptureFlow } from './CaptureFlow'

const directory: readonly CaptureRelationship[] = [
  {
    relationship: {
      contractVersion: 2,
      id: 'relationship-one',
      subjectId: 'subject-one',
      ownerId: 'subject-one',
      recorderIds: ['recorder-one'],
      recipientId: 'recipient-one',
      buyerId: 'buyer-one',
      label: 'First relationship',
      kind: 'friends',
      status: 'active',
    },
    subject: { id: 'subject-one', displayName: 'Subject One', roles: ['subject'] },
    recorders: [{ id: 'recorder-one', displayName: 'Recorder One', roles: ['recorder'] }],
    recipient: { id: 'recipient-one', displayName: 'Recipient One', roles: ['recipient'] },
    buyer: { id: 'buyer-one', displayName: 'Buyer One', roles: ['buyer'] },
  },
  {
    relationship: {
      contractVersion: 2,
      id: 'relationship-two',
      subjectId: 'subject-two',
      ownerId: 'subject-two',
      recorderIds: ['recorder-two'],
      recipientId: 'recipient-two',
      buyerId: 'buyer-two',
      label: 'Second relationship',
      kind: 'parent_child',
      status: 'active',
    },
    subject: { id: 'subject-two', displayName: 'Subject Two', roles: ['subject'] },
    recorders: [{ id: 'recorder-two', displayName: 'Recorder Two', roles: ['recorder'] }],
    recipient: { id: 'recipient-two', displayName: 'Recipient Two', roles: ['recipient'] },
    buyer: { id: 'buyer-two', displayName: 'Buyer Two', roles: ['buyer'] },
  },
]

function createService() {
  const save = vi.fn(async (input: ReviewedContextCapture) => input.context)
  const service: GuidedCapturePort = {
    listRelationships: vi.fn(async () => directory),
    saveReviewedCapture: save,
  }
  return { service, save }
}

async function fillRequiredDraft(options: { relationshipId?: string; allowAi?: boolean } = {}) {
  await screen.findByRole('option', { name: 'Recipient Two · Second relationship' })
  if (options.relationshipId) {
    fireEvent.change(screen.getByLabelText('关系 / 接收者'), { target: { value: options.relationshipId } })
  }
  fireEvent.change(screen.getByLabelText('原始内容'), { target: { value: '这是必须完整保留的原始素材。' } })
  fireEvent.change(screen.getByLabelText('主题'), { target: { value: '一段真实记忆' } })
  fireEvent.change(screen.getByLabelText('为什么重要'), { target: { value: '因为接收者以后会需要这段家庭故事。' } })
  fireEvent.click(screen.getByLabelText('想念时'))
  if (options.allowAi) fireEvent.click(screen.getByLabelText('生成一条可逐项审核的 AI 摘要建议'))
}

describe('CaptureFlow', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    window.location.hash = '#/capture/new'
    vi.restoreAllMocks()
  })

  it('shows a relationship list and distinguishes all four actor roles', async () => {
    const { service } = createService()
    render(<CaptureFlow route="/capture/new" service={service} />)

    await screen.findByRole('option', { name: 'Recipient Two · Second relationship' })
    expect(screen.getByText('Subject One')).toBeInTheDocument()
    expect(screen.getByText('Recorder One')).toBeInTheDocument()
    expect(screen.getByText('Recipient One')).toBeInTheDocument()
    expect(screen.getByText('Buyer One')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('关系 / 接收者'), { target: { value: 'relationship-two' } })
    expect(screen.getByText('Subject Two')).toBeInTheDocument()
    expect(screen.getByText('Recipient Two')).toBeInTheDocument()
  })

  it('persists exact relationship and recipient scoping through the capture port', async () => {
    const { service, save } = createService()
    const view = render(<CaptureFlow route="/capture/new" service={service} />)
    await fillRequiredDraft({ relationshipId: 'relationship-two' })

    fireEvent.click(screen.getByRole('button', { name: '进入所有者审核' }))
    view.rerender(<CaptureFlow route="/capture/review" service={service} />)
    expect(screen.getByText('这是必须完整保留的原始素材。')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('我已审核原始素材、每条 AI 建议、情绪权重和关系范围'))
    fireEvent.click(screen.getByRole('button', { name: '保存已审核 Context' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const saved = save.mock.calls[0][0]
    expect(saved.context).toMatchObject({
      subjectId: 'subject-two',
      recorderId: 'recorder-two',
      recipientId: 'recipient-two',
      relationshipId: 'relationship-two',
      visibility: 'relationship_specific',
      intendedScenarios: ['想念时'],
    })
    expect(saved.generationPolicy.relationshipId).toBe('relationship-two')
    expect(saved.triggerPolicy.relationshipId).toBe('relationship-two')
    expect(saved.originalAsset.contextId).toBe(saved.context.id)
    expect(decodeURIComponent(saved.originalAsset.uri)).toContain('这是必须完整保留的原始素材。')
  })

  it('keeps original material separate and blocks unreviewed AI suggestions', async () => {
    const { service, save } = createService()
    const view = render(<CaptureFlow route="/capture/new" service={service} />)
    await fillRequiredDraft({ allowAi: true })

    fireEvent.click(screen.getByRole('button', { name: '进入所有者审核' }))
    view.rerender(<CaptureFlow route="/capture/review" service={service} />)
    expect(screen.getByText('这是必须完整保留的原始素材。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '批准' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '移除' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拒绝' })).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('我已审核原始素材、每条 AI 建议、情绪权重和关系范围'))
    fireEvent.click(screen.getByRole('button', { name: '保存已审核 Context' }))
    expect(screen.getByRole('alert')).toHaveTextContent('请逐条批准、编辑、移除或拒绝 AI 建议')
    expect(save).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    fireEvent.change(screen.getByLabelText('编辑 AI 建议'), { target: { value: '所有者修改后的摘要。' } })
    fireEvent.click(screen.getByRole('button', { name: '保存修改并批准' }))
    fireEvent.click(screen.getByRole('button', { name: '保存已审核 Context' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const saved = save.mock.calls[0][0]
    expect(saved.derivedContent).toHaveLength(1)
    expect(saved.derivedContent[0]).toMatchObject({
      content: '所有者修改后的摘要。',
      reviewedByUserId: 'subject-one',
      provenance: {
        aiGenerated: true,
        generationMode: 'source_composition',
      },
    })
    expect(saved.context.derivedContentIds).toEqual([saved.derivedContent[0].id])
    expect(saved.originalAsset.uri).not.toContain('所有者修改后的摘要')
  })

  it('treats model emotion labels as reviewable weights rather than detection', async () => {
    const { service, save } = createService()
    const view = render(<CaptureFlow route="/capture/new" service={service} />)
    await fillRequiredDraft()
    fireEvent.click(screen.getByLabelText('使用可编辑的模型建议'))
    expect(screen.getByText('情绪标签只用于调整呈现权重，不代表可靠的情绪检测。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '进入所有者审核' }))
    view.rerender(<CaptureFlow route="/capture/review" service={service} />)
    fireEvent.click(screen.getByLabelText('我已审核原始素材、每条 AI 建议、情绪权重和关系范围'))
    fireEvent.click(screen.getByRole('button', { name: '保存已审核 Context' }))
    expect(screen.getByRole('alert')).toHaveTextContent('它不是可靠的情绪检测')
    expect(save).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('我确认这只是可编辑的模型建议权重，不是情绪检测结果'))
    fireEvent.click(screen.getByRole('button', { name: '保存已审核 Context' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][0].context).toMatchObject({ emotionLabel: '温暖', emotionIntensity: 0.5 })
  })

  it.each([
    ['/capture/review', '记录草稿需要重新开始。', '返回记忆编辑器'],
    ['/capture/success', '没有可恢复的保存结果。', '重新录入记忆'],
  ])('does not fabricate capture state after refreshing %s', async (route, message, action) => {
    const { service, save } = createService()
    window.location.hash = route
    render(<CaptureFlow route={route} service={service} />)

    expect(await screen.findByRole('heading', { name: message })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: action }))
    await waitFor(() => expect(window.location.hash).toBe('#/capture/new'))
    expect(save).not.toHaveBeenCalled()
  })

  it('recovers when the relationship directory fails to load', async () => {
    const listRelationships = vi
      .fn()
      .mockRejectedValueOnce(new Error('Relationship directory unavailable'))
      .mockResolvedValueOnce(directory)
    const service: GuidedCapturePort = {
      listRelationships,
      saveReviewedCapture: vi.fn(async (input) => input.context),
    }
    render(<CaptureFlow route="/capture/new" service={service} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Relationship directory unavailable')
    fireEvent.click(screen.getByRole('button', { name: '重试加载关系' }))
    await screen.findByRole('option', { name: 'Recipient Two · Second relationship' })
    expect(listRelationships).toHaveBeenCalledTimes(2)
  })
})
