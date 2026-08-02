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

  async function enterWithPresentMoment(content = '今天下雨，我又忘记带伞了。') {
    fireEvent.click(screen.getByRole('button', { name: /主动进入/ }))
    fireEvent.click(await screen.findByRole('button', { name: /是留给我的，继续/ }))
    fireEvent.change(await screen.findByLabelText('今天发生了什么？'), {
      target: { value: content },
    })
    fireEvent.click(screen.getByRole('button', { name: /让过去的记忆回应现在/ }))
  }

  it('requires explicit entry and keeps original playback user initiated', async () => {
    render(<RecipientExperience />)

    expect(screen.getByText(/W·HERE · pull_only/)).toBeInTheDocument()
    expect(playbackService.current).toBeUndefined()

    await enterWithPresentMoment()
    await screen.findByText('一份给今天的回应。')

    expect(screen.getByText('真实原始来源')).toBeInTheDocument()
    expect(screen.getByText(/AI 生成/)).toBeInTheDocument()
    expect(screen.getAllByText('context-tomato-eggs')).toHaveLength(2)
    expect(screen.getAllByText(/今天下雨，我又忘记带伞了/).length).toBeGreaterThanOrEqual(2)
    expect(playbackService.current).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: /播放原声/ }))
    await waitFor(() => expect(playbackService.current?.uri).toBe('/demo/mei-tomato-eggs.mp3'))
  })

  it('stores recipient choice, creates one postcard artifact, and attributes response to recipient', async () => {
    render(<RecipientExperience />)
    await enterWithPresentMoment()
    await screen.findByText(/AI 生成/)

    fireEvent.click(screen.getByRole('button', { name: /收藏这封远方回信/ }))
    await screen.findByText('今天与过去，都被好好放在这里。')
    expect(screen.getByText(/artifact:interaction:session-demo/)).toBeInTheDocument()
    expect(screen.getByText(/今天 · 今天下雨，我又忘记带伞了/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('为今天再留一句话'), {
      target: { value: '今天我也做了这道菜。' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保存我的话/ }))
    await screen.findByText('已独立保存为接收者内容，不会成为记录者生前事实。')
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

    await enterWithPresentMoment()
    await screen.findByRole('alert')
    expect(screen.getByText('Agent unavailable')).toBeInTheDocument()
    expect(screen.queryByText('今天与过去，都被好好放在这里。')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重试加载' }))
    await screen.findByText(/AI 生成/)
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

    await enterWithPresentMoment()
    await screen.findByText(/AI 生成/)
    fireEvent.click(screen.getByRole('button', { name: /收藏这封远方回信/ }))
    await screen.findByRole('alert')
    expect(screen.getByText('Artifact store unavailable')).toBeInTheDocument()
    expect(window.location.hash).toContain('/recipient/memory/')

    fireEvent.click(screen.getByRole('button', { name: /收藏这封远方回信/ }))
    await screen.findByText('今天与过去，都被好好放在这里。')
    expect(createArtifact).toHaveBeenCalledTimes(2)
  })
})
