import { describe, expect, it } from 'vitest'
import { createDeviceRuntime } from '../runtime'
import {
  createDeterministicClock,
  createOmiSimulator,
  createRingSimulator,
} from './index'

describe('deterministic device simulators', () => {
  it('replays OMI metadata with simulated source and reproducible time/sequence', async () => {
    const firstClock = createDeterministicClock('2026-08-03T00:00:00.000Z')
    const first = createOmiSimulator({ clock: firstClock })
    const runtime = createDeviceRuntime({
      transports: [first.transport],
      adapters: [first.adapter],
      clock: firstClock,
      consent: { audioCapture: true },
    })
    await runtime.ready()
    await runtime.scan()
    const connected = await runtime.connect(first.device.discoveryId)
    expect(connected.ok).toBe(true)

    const event = first.next()
    expect(event).toMatchObject({
      kind: 'audio_chunk',
      source: 'simulated',
      occurredAt: '2026-08-03T00:00:00.000Z',
      metadata: { sessionSequence: 1, source: 'notification' },
    })
    expect(event).not.toHaveProperty('payload')
    expect(event).not.toHaveProperty('transportFrame')

    const secondClock = createDeterministicClock('2026-08-03T00:00:00.000Z')
    const second = createOmiSimulator({ clock: secondClock })
    expect(second.next()).toEqual(event)
    firstClock.advance(1_000)
    expect(first.next()).toMatchObject({
      source: 'simulated',
      occurredAt: '2026-08-03T00:00:01.000Z',
      metadata: { sessionSequence: 2 },
    })
  })

  it('replays ring values through an independent session and labels local streams', async () => {
    const simulator = createRingSimulator({
      events: [
        { role: 'heart_rate', value: 72, unit: 'bpm' },
        { role: 'heart_rate', value: 73, unit: 'bpm' },
        { role: 'ppg', value: 127 },
      ],
    })
    const runtime = createDeviceRuntime({
      transports: [simulator.transport],
      adapters: [simulator.adapter],
    })
    await runtime.ready()
    await runtime.scan()
    const connected = await runtime.connect(simulator.device.discoveryId)
    expect(connected.ok).toBe(true)

    expect(simulator.next()).toMatchObject({
      kind: 'metric',
      source: 'simulated',
      metric: { role: 'heart_rate', value: 72, privacy: 'normalized' },
    })
    expect(simulator.next()).toMatchObject({
      kind: 'metric',
      metric: { role: 'heart_rate', value: 73 },
    })
    const localEvent = simulator.next()
    expect(localEvent).toMatchObject({
      kind: 'metric',
      source: 'simulated',
      metric: { role: 'ppg', privacy: 'local_only', exportConsentRequired: true },
    })
    expect(localEvent).not.toHaveProperty('metric.value')
    const sensitiveHistory = simulator.emit({
      role: 'ppg',
      kind: 'history',
      record: { rawSample: 127 },
    })
    expect(sensitiveHistory).toMatchObject({
      kind: 'metric',
      source: 'simulated',
      metric: { role: 'ppg', privacy: 'local_only', exportConsentRequired: true },
    })
    expect(sensitiveHistory).not.toHaveProperty('history')
    expect(sensitiveHistory).not.toHaveProperty('metric.value')
    expect(runtime.getSnapshot().sessions[0]?.latestValues.heart_rate).toMatchObject({
      value: 73,
      source: 'simulated',
    })
    expect(runtime.getSnapshot().sessions[0]?.history).toHaveLength(4)

    const boundedRuntime = createDeviceRuntime({
      transports: [simulator.transport],
      adapters: [simulator.adapter],
      historyLimit: 2,
    })
    await boundedRuntime.ready()
    await boundedRuntime.scan()
    await boundedRuntime.connect(simulator.device.discoveryId)
    simulator.reset()
    simulator.next()
    simulator.next()
    simulator.next()
    expect(boundedRuntime.getSnapshot().sessions[0]?.history).toHaveLength(2)
  })
})
