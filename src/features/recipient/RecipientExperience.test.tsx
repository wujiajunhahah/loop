import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contextCaptureService,
  demoPlans,
  demoRecipientSessions,
  playbackService,
} from '../../data/services'
import { plannedInteractions, recipientSessions } from '../../data/seed'
import { RecipientExperience } from './RecipientExperience'
import { resetRecipientEntryForTests } from './session'
import {
  clearDeviceInteractionHandoff,
  readDeviceInteractionHandoff,
  writeDeviceInteractionHandoff,
} from '../devices/deviceInteractionHandoff'

function recipientHandoff(eventId = 'touch-verified-1') {
  return {
    version: 2 as const,
    purpose: 'recipient_entry' as const,
    eventId,
    interaction: 'touch' as const,
    deviceId: 'ring-verified-1',
    deviceName: 'Alloop Ring',
    source: 'simulated' as const,
    occurredAt: new Date().toISOString(),
    verification: 'entrustment_verified' as const,
    ownerId: 'person-mei',
    recipientId: 'person-lin',
    sessionId: 'ring-session-verified-1',
    sessionSequence: 3,
    profile: {
      profileId: 'ring-demo-v1',
      sourceReference: 'simulator:ring:v1',
      validation: 'fixture_only' as const,
    },
  }
}

describe('recipient experience demo', () => {
  afterEach(() => cleanup())

  beforeEach(async () => {
    window.location.hash = '/recipient'
    await playbackService.stop()
    resetRecipientEntryForTests()
    clearDeviceInteractionHandoff()
    sessionStorage.clear()
    vi.restoreAllMocks()
    demoRecipientSessions.splice(
      0,
      demoRecipientSessions.length,
      ...recipientSessions.map((session) => ({ ...session })),
    )
    demoPlans.splice(
      0,
      demoPlans.length,
      ...plannedInteractions.map((plan) => ({
        ...plan,
        memoryIds: [...plan.memoryIds],
      })),
    )
  })

  it('lets Lin actively enter, continue the recipe plan, and leave a response', async () => {
    const capture = vi.spyOn(contextCaptureService, 'capture')
    render(<RecipientExperience />)

    expect(screen.getByText('这里有一段只留给你的东西。')).toBeInTheDocument()
    expect(playbackService.current).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: /主动进入/ }))
    await screen.findByText('这是给你的吗？')
    fireEvent.click(screen.getByRole('button', { name: /是我的，打开看看/ }))

    await screen.findByText('The first family recipe')
    expect(screen.getByText('原始内容')).toBeInTheDocument()
    expect(screen.getByText('AI 整理内容')).toBeInTheDocument()
    expect(playbackService.current).toBeUndefined()

    fireEvent.click(screen.getByRole('radio', { name: '音频' }))
    fireEvent.click(screen.getByRole('button', { name: /播放原声/ }))
    await waitFor(() => {
      expect(playbackService.current?.uri).toBe('/demo/mei-tomato-eggs.mp3')
    })

    fireEvent.click(screen.getByRole('button', { name: /接受这段邀请/ }))
    await screen.findByText('五道家常菜')
    fireEvent.click(screen.getByRole('button', { name: /继续这项计划/ }))
    await screen.findByText('你们的下一步，已经留出位置。')

    fireEvent.change(screen.getByLabelText('留下一个回应或记录'), {
      target: { value: '今天我也做了这道菜。' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保存回应/ }))
    await screen.findByText('已保存到你们的关系记录。')
    expect(capture).toHaveBeenLastCalledWith(expect.objectContaining({
      original: expect.objectContaining({ text: '今天我也做了这道菜。' }),
    }))
  })

  it('does not let a direct deep link bypass recipient confirmation', () => {
    window.location.hash = '/recipient/memory/memory-tomato-eggs'

    render(<RecipientExperience />)

    expect(screen.getByText('先从你的入口确认身份。')).toBeInTheDocument()
    expect(screen.queryByText('The first family recipe')).not.toBeInTheDocument()
  })

  it('shows verified device provenance before identity confirmation', async () => {
    writeDeviceInteractionHandoff(recipientHandoff())
    window.location.hash = '/recipient/verify'

    render(<RecipientExperience />)

    expect(screen.getByText('设备入口已验证')).toBeInTheDocument()
    expect(screen.getByText(/Alloop Ring · 演示数据/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /是我的，打开看看/ }))
    await screen.findByText('The first family recipe')
    const currentSession = demoRecipientSessions.find(
      (session) => session.trigger?.eventId === 'touch-verified-1',
    )
    expect(currentSession).toMatchObject({
      initiatedByRecipient: true,
      trigger: {
        ownerId: 'person-mei',
        recipientId: 'person-lin',
        sessionId: 'ring-session-verified-1',
        sessionSequence: 3,
        profile: { validation: 'fixture_only' },
      },
    })
    expect(currentSession?.id).not.toBe('session-demo')
    expect(readDeviceInteractionHandoff('recipient_entry')).toBeUndefined()
  })

  it('persists permanent close across every recipient path and clears new handoffs', async () => {
    const view = render(<RecipientExperience />)
    fireEvent.click(screen.getByRole('button', { name: '永久关闭这段入口' }))
    view.unmount()

    for (const path of [
      '/recipient',
      '/recipient/verify',
      '/recipient/memory/memory-tomato-eggs',
      '/recipient/plan/plan-five-recipes',
      '/recipient/complete',
    ]) {
      window.location.hash = path
      const closedView = render(<RecipientExperience />)
      expect(screen.getByText('这段入口已按你的选择关闭。')).toBeInTheDocument()
      expect(screen.queryByText('The first family recipe')).not.toBeInTheDocument()
      closedView.unmount()
    }

    writeDeviceInteractionHandoff(recipientHandoff('touch-after-close'))
    window.location.hash = '/recipient/verify'
    render(<RecipientExperience />)
    expect(screen.getByText('这段入口已按你的选择关闭。')).toBeInTheDocument()
    await waitFor(() => {
      expect(readDeviceInteractionHandoff('recipient_entry')).toBeUndefined()
    })
  })

  it.each([
    ['postpone', /现在还不想看/],
    ['skip', /跳过这次/],
  ])('consumes the handoff when the recipient chooses %s', async (_choice, buttonName) => {
    writeDeviceInteractionHandoff(recipientHandoff(`touch-${_choice}`))
    window.location.hash = '/recipient/verify'
    const view = render(<RecipientExperience />)

    fireEvent.click(screen.getByRole('button', { name: buttonName }))
    expect(readDeviceInteractionHandoff('recipient_entry')).toBeUndefined()
    view.unmount()
    window.location.hash = '/recipient/verify'
    render(<RecipientExperience />)
    expect(screen.getByText('先从你的入口确认身份。')).toBeInTheDocument()
  })
})
