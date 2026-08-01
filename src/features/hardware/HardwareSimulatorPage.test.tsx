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
    expect(screen.getByText(/LED:/)).toBeInTheDocument()
    expect(screen.getByText(/Vibration:/)).toBeInTheDocument()
    expect(screen.getByText(/Confirmation:/)).toBeInTheDocument()
  })

  it('provides separate verified binding and entrustment actions', () => {
    render(<HardwareBindPage />)

    expect(screen.getByRole('button', { name: 'Verify and bind' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify and entrust' })).toBeInTheDocument()
    expect(screen.getByLabelText('Device type')).toHaveValue('keepsake-token')
  })

  it('offers every trigger source and explicit trigger reason', () => {
    render(<HardwareTriggerPage />)

    const sourceOptions = screen
      .getAllByLabelText('Trigger source')[0]
      .querySelectorAll('option')
    expect([...sourceOptions].map((option) => option.textContent)).toEqual([
      'touch',
      'tap',
      'gesture',
      'nfc',
      'ble',
      'software',
    ])
    expect(screen.getByLabelText('Trigger reason')).toHaveValue('user_opened')
    expect(screen.getByRole('list', { name: 'Event lifecycle' })).toBeInTheDocument()
  })

  it('marks simulator actions as busy while an async operation is in flight', () => {
    render(<HardwareBindPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Verify and bind' }))

    expect(screen.getByRole('button', { name: 'Binding...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Verify and entrust' })).toBeDisabled()
  })
})
