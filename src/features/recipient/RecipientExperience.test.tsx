import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playbackService } from '../../data/services'
import { RecipientExperience } from './RecipientExperience'
import { standaloneRecipientData } from './session'

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

  it.each([
    ['/recipient/memory/context-tomato-eggs', '这次查看需要重新确认。'],
    ['/recipient/complete', '这次明信片尚未生成。'],
  ])('recovers an in-memory route after refresh: %s', (route, message) => {
    window.location.hash = route
    render(<RecipientExperience />)

    expect(screen.getByRole('heading', { name: message })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '回到接收者入口' }))
    expect(window.location.hash).toBe('#/recipient')
  })

  it('shows a recoverable Agent loading error without completing the interaction', async () => {
    const loadPresentation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Agent unavailable'))
      .mockResolvedValueOnce(await standaloneRecipientData.loadPresentation(standaloneRecipientData.createInteraction(standaloneRecipientData.createSession())))
    const data = { ...standaloneRecipientData, loadPresentation }
    render(<RecipientExperience data={data} />)

    fireEvent.click(screen.getByRole('button', { name: /主动进入/ }))
    fireEvent.click(await screen.findByRole('button', { name: /是我的，打开看看/ }))
    await screen.findByRole('alert')
    expect(screen.getByText('Agent unavailable')).toBeInTheDocument()
    expect(screen.queryByText('这张远行明信片已经为你留存。')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重试加载' }))
    await screen.findByText('AI-generated')
    expect(loadPresentation).toHaveBeenCalledTimes(2)
  })

  it('keeps the recipient in memory when postcard creation fails and allows retry', async () => {
    const createArtifact = vi
      .fn()
      .mockRejectedValueOnce(new Error('Artifact store unavailable'))
      .mockResolvedValueOnce(await standaloneRecipientData.createArtifact(
        standaloneRecipientData.createInteraction(standaloneRecipientData.createSession()),
        (await standaloneRecipientData.loadPresentation(
          standaloneRecipientData.createInteraction(standaloneRecipientData.createSession()),
        )).derived!,
      ))
    const data = { ...standaloneRecipientData, createArtifact }
    render(<RecipientExperience data={data} />)

    fireEvent.click(screen.getByRole('button', { name: /主动进入/ }))
    fireEvent.click(await screen.findByRole('button', { name: /是我的，打开看看/ }))
    await screen.findByText('AI-generated')
    fireEvent.click(screen.getByRole('button', { name: /接受并保存明信片/ }))
    await screen.findByRole('alert')
    expect(screen.getByText('Artifact store unavailable')).toBeInTheDocument()
    expect(window.location.hash).toContain('/recipient/memory/')

    fireEvent.click(screen.getByRole('button', { name: /接受并保存明信片/ }))
    await screen.findByText('这张远行明信片已经为你留存。')
    expect(createArtifact).toHaveBeenCalledTimes(2)
  })
})
