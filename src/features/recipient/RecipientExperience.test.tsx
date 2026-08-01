import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { playbackService } from '../../data/services'
import { RecipientExperience } from './RecipientExperience'

describe('recipient experience demo', () => {
  beforeEach(async () => {
    window.location.hash = '/recipient'
    await playbackService.stop()
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
})
