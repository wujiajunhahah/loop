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
    fireEvent.click(screen.getByRole('radio', { name: intensity }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Inspect journey' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use neutral action' }))
  fireEvent.click(await screen.findByRole('button', { name: 'I did this' }))
  await screen.findByRole('heading', { name: 'The rainy walk home' })
}

describe('Echo Map journey UI', () => {
  beforeEach(() => {
    window.location.hash = '#/recipient/echo-map'
  })

  afterEach(() => cleanup())

  it('completes the glimmer path with separate source layers and one lit node', async () => {
    const data = renderJourney()
    await reachMemory('glimmer')

    expect(screen.getByText('Approved source composition')).toBeInTheDocument()
    expect(screen.getAllByText('AI-generated').length).toBeGreaterThan(0)
    expect(screen.queryByText(/你从小就总忘带伞/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open original' }))
    expect(screen.getByText(/你从小就总忘带伞/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.change(await screen.findByLabelText("Lin's response today"), {
      target: { value: 'I heard rain against my window today.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and make postcard' }))
    await screen.findByRole('heading', { name: 'Rain, carried forward.' })
    expect(screen.getByText(/I heard rain against my window today/)).toBeInTheDocument()
    expect(screen.getAllByText(/context-rainy-day/).length).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByRole('button', { name: 'Keep postcard and light node' }))
    await screen.findByText('Node lit / journey complete')
    expect(data.getJourneySnapshot().session).toMatchObject({
      state: 'node_lit',
      completedAt: now,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open postcard' }))
    await screen.findByRole('button', { name: 'Return to lit node' })
    expect(screen.queryByRole('button', { name: 'Keep postcard and light node' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop without lighting' })).not.toBeInTheDocument()
  })

  it('keeps quiet source-only and supports explicit response omission', async () => {
    const data = renderJourney()
    await reachMemory()
    expect(screen.queryByText('Approved source composition')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue without a note' }))
    await screen.findByRole('heading', { name: 'Rain, carried forward.' })
    expect(data.getJourneySnapshot().response).toMatchObject({
      kind: 'omitted',
      eligibleAsRecorderContext: false,
    })
    expect(data.getJourneySnapshot().artifact?.recipientResponse).toBeUndefined()
  })

  it('keeps skip and current-Demo hide visibly incomplete', async () => {
    const data = renderJourney()
    fireEvent.click(screen.getByRole('button', { name: 'Inspect journey' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Skip this time' }))
    await screen.findByRole('heading', { name: 'Rain Under One Umbrella' })
    expect(data.getJourneySnapshot().session?.state).toBe('skipped')
    expect(data.getJourneySnapshot().node.status).toBe('available')
    const skippedId = data.getJourneySnapshot().session?.id
    fireEvent.click(screen.getByRole('button', { name: 'Inspect journey' }))
    await screen.findByRole('button', { name: 'Use neutral action' })
    expect(data.getJourneySnapshot().session?.id).not.toBe(skippedId)

    cleanup()
    const hiddenData = renderJourney()
    fireEvent.click(screen.getByRole('button', { name: 'Hide for this Demo' }))
    expect(screen.getByRole('dialog', { name: 'Hide this journey?' })).toBeInTheDocument()
    expect(screen.getByText(/until the in-memory Demo is reset/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm hide' }))
    await screen.findByText('This proposal is hidden for the current in-memory Demo.')
    expect(hiddenData.getJourneySnapshot().node.status).toBe('hidden')
    expect(hiddenData.getJourneySnapshot().session?.completedAt).toBeUndefined()
  })

  it('requires restart when a mid-journey URL has no in-memory session', () => {
    window.location.hash = '#/recipient/echo-map/memory'
    render(<EchoMapJourneyExperience data={new OfflineDemoService(() => now)} />)
    expect(screen.getByRole('heading', { name: 'This journey needs a fresh entry.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Return to Echo Map' }))
    expect(window.location.hash).toBe('#/recipient/echo-map')
  })

  it('recovers from Agent and postcard failures without false completion', async () => {
    const data = new FlakyJourneyData(() => now)
    data.memoryFailures = 1
    renderJourney(data)
    fireEvent.click(screen.getByRole('button', { name: 'Inspect journey' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Use neutral action' }))
    fireEvent.click(await screen.findByRole('button', { name: 'I did this' }))
    await screen.findByRole('alert')
    expect(screen.getByText('Agent unavailable')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(data.getJourneySnapshot().session?.state).toBe('action_completed')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('heading', { name: 'The rainy walk home' })

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue without a note' }))
    data.postcardFailures = 1
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Artifact store unavailable'))
    expect(data.getJourneySnapshot().session?.state).toBe('response_recorded')
    expect(data.getJourneySnapshot().node.status).toBe('available')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('heading', { name: 'Rain, carried forward.' })
  })

  it('resumes an accepted action after returning to the map', async () => {
    const data = renderJourney()
    fireEvent.click(screen.getByRole('button', { name: 'Inspect journey' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Use neutral action' }))
    expect(data.getJourneySnapshot().session?.state).toBe('action_accepted')

    window.location.hash = '#/recipient/echo-map'
    fireEvent(window, new HashChangeEvent('hashchange'))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue journey' }))
    expect(await screen.findByRole('heading', { name: 'Pause by a window.' })).toBeInTheDocument()
  })

  it('contains hide confirmation focus and restores it on Escape', async () => {
    renderJourney()
    const trigger = screen.getByRole('button', { name: 'Hide for this Demo' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Hide this journey?' })
    expect(screen.getByRole('button', { name: 'Confirm hide' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('retries node lighting without losing a valid postcard', async () => {
    const data = new FlakyJourneyData(() => now)
    renderJourney(data)
    await reachMemory()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue without a note' }))
    await screen.findByRole('heading', { name: 'Rain, carried forward.' })
    data.nodeFailures = 1
    fireEvent.click(screen.getByRole('button', { name: 'Keep postcard and light node' }))
    await screen.findByRole('alert')
    expect(screen.getByText('Node store unavailable')).toHaveFocus()
    expect(data.getJourneySnapshot().session?.state).toBe('postcard_created')
    expect(data.getJourneySnapshot().artifact).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Retry lighting node' }))
    await screen.findByText('Node lit / journey complete')
  })

  it('completes async loading under application StrictMode', async () => {
    const data = new OfflineDemoService(() => now)
    window.location.hash = '#/recipient/echo-map'
    render(<StrictMode><EchoMapJourneyExperience data={data} /></StrictMode>)
    await reachMemory('glimmer')
    expect(screen.getByText('Approved source composition')).toBeInTheDocument()
  })

  it('reattaches to one in-flight memory request after component remount', async () => {
    const data = new DeferredMemoryData(() => now)
    window.location.hash = '#/recipient/echo-map'
    render(<EchoMapJourneyExperience data={data} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inspect journey' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Use neutral action' }))
    fireEvent.click(await screen.findByRole('button', { name: 'I did this' }))
    await screen.findByRole('heading', { name: 'Preparing the approved source' })
    cleanup()
    render(<EchoMapJourneyExperience data={data} />)
    data.continueMemory()
    await screen.findByRole('heading', { name: 'The rainy walk home' })
    expect(data.getJourneySnapshot().session?.state).toBe('memory_opened')
  })
})
