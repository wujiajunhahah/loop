import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MockHardwareBridge } from '../../adapters/hardware'
import { createDeviceRuntime } from '../../devices/runtime'
import { createRingSimulator } from '../../devices/simulators'
import { DeviceCenterPage } from './DeviceCenterPage'
import {
  clearDeviceInteractionHandoff,
  readDeviceInteractionHandoff,
} from './deviceInteractionHandoff'

describe('device center simulator integration', () => {
  beforeEach(() => {
    window.location.hash = '#/devices'
    clearDeviceInteractionHandoff()
    sessionStorage.clear()
  })

  afterEach(() => cleanup())

  it('runs scan, connect, metric, consent, mark, verification, and handoff end to end', async () => {
    const ring = createRingSimulator({ deviceName: '集成测试戒指' })
    const demoRuntime = createDeviceRuntime({
      transports: [ring.transport],
      adapters: [ring.adapter],
    })
    const physicalRuntime = createDeviceRuntime({ transports: [], adapters: [] })
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: 'simulator-ring-normalized-device',
      deviceType: 'ring',
      ownerProof: {
        identityId: 'person-mei',
        method: 'mock_code',
        value: 'LOOP-DEMO',
      },
    })

    render(
      <DeviceCenterPage
        environment={{ physicalSupported: false, permission: 'unsupported' }}
        hardwareBridge={hardwareBridge}
        runtime={physicalRuntime}
        simulator={{
          runtime: demoRuntime,
          advance: () => {
            ring.next()
          },
        }}
      />,
    )

    fireEvent.click(screen.getByRole('switch', { name: '使用演示数据' }))
    expect(await screen.findByRole('button', { name: '连接 集成测试戒指' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: '允许设备触碰事件' }))
    fireEvent.click(screen.getByRole('button', { name: '连接 集成测试戒指' }))

    expect(await screen.findByText('72 bpm')).toBeInTheDocument()
    expect(screen.getByText('弱情境 · 不用于判断情绪、悲伤或健康')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '发送下一个演示事件' }))

    expect(await screen.findByRole('dialog', { name: '为这一刻留个位置' })).toBeInTheDocument()
    expect(screen.getByText(/源自 集成测试戒指 · 演示数据/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '进入记录引导' }))

    await waitFor(() => expect(window.location.hash).toBe('#/capture/new'))
    expect(readDeviceInteractionHandoff('creator_capture')).toMatchObject({
      eventId: 'ring-simulated-session-1-event-2',
      deviceName: '集成测试戒指',
      source: 'simulated',
      verification: 'binding_verified',
    })

    await demoRuntime.close()
    await physicalRuntime.close()
  })

  it('requires entrusted recipient identity before a simulated touch handoff', async () => {
    const ring = createRingSimulator({ deviceName: '接收者测试戒指' })
    const demoRuntime = createDeviceRuntime({
      transports: [ring.transport],
      adapters: [ring.adapter],
    })
    const physicalRuntime = createDeviceRuntime({ transports: [], adapters: [] })
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: 'simulator-ring-normalized-device',
      deviceType: 'ring',
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
    })
    await hardwareBridge.entrustDevice({
      deviceId: 'simulator-ring-normalized-device',
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
      recipientProof: { identityId: 'person-lin', method: 'mock_confirmation', value: 'LOOP-DEMO' },
    })
    render(
      <DeviceCenterPage
        environment={{ physicalSupported: false, permission: 'unsupported' }}
        hardwareBridge={hardwareBridge}
        runtime={physicalRuntime}
        simulator={{ runtime: demoRuntime, advance: () => { ring.next() } }}
      />,
    )

    fireEvent.click(screen.getByRole('switch', { name: '使用演示数据' }))
    await screen.findByRole('button', { name: '连接 接收者测试戒指' })
    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '允许设备触碰事件' }))
    fireEvent.click(screen.getByRole('button', { name: '连接 接收者测试戒指' }))
    await screen.findByText('72 bpm')

    fireEvent.click(screen.getByRole('button', { name: '发送下一个演示事件' }))
    await screen.findByRole('dialog', { name: '为一段陪伴留出入口' })
    fireEvent.click(screen.getByRole('button', { name: '忽略' }))
    fireEvent.click(screen.getByRole('button', { name: '发送下一个演示事件' }))
    await screen.findByRole('dialog', { name: '为一段陪伴留出入口' })
    fireEvent.click(screen.getByRole('button', { name: '确认这是给我的' }))

    await waitFor(() => expect(window.location.hash).toBe('#/recipient/verify'))
    expect(readDeviceInteractionHandoff('recipient_entry')).toMatchObject({
      interaction: 'touch',
      deviceName: '接收者测试戒指',
      verification: 'entrustment_verified',
      recipientId: 'person-lin',
    })

    await demoRuntime.close()
    await physicalRuntime.close()
  })
})
