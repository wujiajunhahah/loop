import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  HardwareBindPage,
  HardwareSimulatorPage,
  HardwareTriggerPage,
  hardwareSimulatorRoutes,
} from './HardwareSimulatorPage'

describe('hardware simulator pages', () => {
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

  it('offers every standard event type in the trigger lab', () => {
    render(<HardwareTriggerPage />)

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['touch', 'tap', 'gesture', 'nfc', 'ble', 'simulated'])
    expect(screen.getByRole('list', { name: 'Event lifecycle' })).toBeInTheDocument()
  })
})
