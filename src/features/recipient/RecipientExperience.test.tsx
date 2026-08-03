import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { playbackService } from '../../data/services'
import { RecipientExperience } from './RecipientExperience'
import { resetRecipientEntryForTests } from './session'
import {
  clearDeviceInteractionHandoff,
  writeDeviceInteractionHandoff,
} from '../devices/deviceInteractionHandoff'

describe('recipient experience demo', () => {
  beforeEach(async () => {
    window.location.hash = '/recipient'
    await playbackService.stop()
    resetRecipientEntryForTests()
    clearDeviceInteractionHandoff()
    sessionStorage.clear()
  })

  it('lets Lin actively enter, continue the recipe plan, and leave a response', async () => {
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
  })

  it('does not let a direct deep link bypass recipient confirmation', () => {
    window.location.hash = '/recipient/memory/memory-tomato-eggs'

    render(<RecipientExperience />)

    expect(screen.getByText('先从你的入口确认身份。')).toBeInTheDocument()
    expect(screen.queryByText('The first family recipe')).not.toBeInTheDocument()
  })

  it('shows verified device provenance before identity confirmation', async () => {
    writeDeviceInteractionHandoff({
      version: 1,
      purpose: 'recipient_entry',
      eventId: 'touch-verified-1',
      interaction: 'touch',
      deviceId: 'ring-verified-1',
      deviceName: 'Alloop Ring',
      source: 'simulated',
      occurredAt: '2026-08-03T00:00:00.000Z',
      verification: 'entrustment_verified',
      recipientId: 'person-lin',
    })
    window.location.hash = '/recipient/verify'

    render(<RecipientExperience />)

    expect(screen.getByText('设备入口已验证')).toBeInTheDocument()
    expect(screen.getByText(/Alloop Ring · 演示数据/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /是我的，打开看看/ }))
    await screen.findByText('The first family recipe')
  })

  it('persists the recipient permanent-close choice', () => {
    const view = render(<RecipientExperience />)
    fireEvent.click(screen.getByRole('button', { name: '永久关闭这段入口' }))
    view.unmount()
    window.location.hash = '/recipient'

    render(<RecipientExperience />)

    expect(screen.getByText('这段入口已按你的选择关闭。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /主动进入/ })).not.toBeInTheDocument()
  })
})
