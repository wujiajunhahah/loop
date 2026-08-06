import { describe, expect, it } from 'vitest'
import { normalizeBleError } from './errors'

describe('BLE error normalization', () => {
  it.each([
    [{ code: 'PERMISSION_DENIED' }, 'permission_denied', false],
    [new Error('Bluetooth is disabled'), 'powered_off', true],
    [{ code: 'TIMEOUT' }, 'timeout', true],
    [new Error('Device is not connected'), 'disconnected', true],
    [{ code: 'UNAVAILABLE' }, 'unsupported_platform', false],
  ] as const)(
    'maps a plugin failure to %s without exposing its original details',
    (failure, code, retryable) => {
      const error = normalizeBleError(failure, {
        fallbackCode: 'read_failed',
        fallbackMessage: 'The characteristic read failed.',
      })

      expect(error).toMatchObject({ code, retryable })
      expect(error.message).not.toContain('device-secret-42')
    },
  )

  it('uses an operation-specific generic failure with a redacted message', () => {
    const error = normalizeBleError(
      new Error('device-secret-42 returned packet deadbeef'),
      {
        fallbackCode: 'write_failed',
        fallbackMessage: 'The characteristic write failed.',
      },
    )

    expect(error).toEqual({
      code: 'write_failed',
      message: 'The characteristic write failed.',
      retryable: true,
    })
    expect(JSON.stringify(error)).not.toContain('device-secret-42')
    expect(JSON.stringify(error)).not.toContain('deadbeef')
  })
})
