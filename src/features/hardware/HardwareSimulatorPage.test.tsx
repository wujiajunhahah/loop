import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  HardwareBindPage,
  HardwareSimulatorPage,
  HardwareTriggerPage,
  hardwareSimulatorRoutes,
} from './HardwareSimulatorPage'

describe('hardware simulator pages', () => {
  afterEach(() => cleanup())

  it('exposes the requested simulator routes and abstract feedback', () => {
    render(<HardwareSimulatorPage />)

    expect(hardwareSimulatorRoutes).toEqual({
      overview: '/hardware-simulator',
      bind: '/hardware-simulator/bind',
      trigger: '/hardware-simulator/trigger',
    })
    expect(screen.getByText(/灯光 ·/)).toBeInTheDocument()
    expect(screen.getByText(/震动 ·/)).toBeInTheDocument()
    expect(screen.getByText(/确认 ·/)).toBeInTheDocument()
  })

  it('provides separate verified binding and entrustment actions', () => {
    render(<HardwareBindPage />)

    expect(screen.getByRole('button', { name: '验证并绑定' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '验证并托付' })).toBeInTheDocument()
    expect(screen.getByLabelText('设备类型')).toHaveValue('keepsake-token')
  })

  it('offers every trigger source and explicit trigger reason', () => {
    render(<HardwareTriggerPage />)

    const sourceOptions = screen
      .getAllByLabelText('触发来源')[0]
      .querySelectorAll('option')
    expect([...sourceOptions].map((option) => option.textContent)).toEqual([
      '触碰',
      '轻点',
      '手势',
      'NFC',
      '蓝牙按钮',
      '软件模拟',
    ])
    expect(screen.getByLabelText('触发原因')).toHaveValue('user_opened')
    expect(screen.getByRole('list', { name: '入口事件生命周期' })).toBeInTheDocument()
  })

  it('marks simulator actions as busy while an async operation is in flight', () => {
    render(<HardwareBindPage />)
    fireEvent.click(screen.getByRole('button', { name: '验证并绑定' }))

    expect(screen.getByRole('button', { name: '正在绑定...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '验证并托付' })).toBeDisabled()
  })
})
