import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { playbackService } from '../../data/services'
import { RecipientExperience } from './RecipientExperience'

describe('recipient experience demo', () => {
  afterEach(() => cleanup())

  beforeEach(async () => {
    window.location.hash = '/recipient'
    await playbackService.stop()
  })

  it('requires explicit entry and keeps original playback user initiated', async () => {
    render(<RecipientExperience />)

    expect(screen.getByText(/Recipient request · pull_only/)).toBeInTheDocument()
    expect(playbackService.current).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: /主动进入/ }))
    fireEvent.click(await screen.findByRole('button', { name: /是我的，打开看看/ }))
    await screen.findByText('The first family recipe')

    expect(screen.getByText('Original source')).toBeInTheDocument()
    expect(screen.getByText('AI-generated')).toBeInTheDocument()
    expect(screen.getAllByText('context-tomato-eggs')).toHaveLength(2)
    expect(playbackService.current).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: /播放原声/ }))
    await waitFor(() => expect(playbackService.current?.uri).toBe('/demo/mei-tomato-eggs.mp3'))
  })

  it('stores recipient choice, creates one postcard artifact, and attributes response to recipient', async () => {
    render(<RecipientExperience />)
    fireEvent.click(screen.getByRole('button', { name: /主动进入/ }))
    fireEvent.click(await screen.findByRole('button', { name: /是我的，打开看看/ }))
    await screen.findByText('AI-generated')

    fireEvent.click(screen.getByRole('button', { name: /接受并保存明信片/ }))
    await screen.findByText('这张远行明信片已经为你留存。')
    expect(screen.getByText(/artifact:interaction:session-demo/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('留下一个接收者回应'), {
      target: { value: '今天我也做了这道菜。' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保存回应/ }))
    await screen.findByText('已保存为 recipient-authored response。')
  })
})
