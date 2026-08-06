import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'

describe('App device route', () => {
  afterEach(() => cleanup())

  it('renders the device center route and marks its parent navigation current', () => {
    window.location.hash = '#/devices'

    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: '设备' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.queryByRole('link', { name: 'Hardware' })).not.toBeInTheDocument()
    expect(document.title).toBe('设备 | Loop')
    expect(screen.getByRole('heading', { level: 1, name: '设备' })).toHaveFocus()
  })
})
