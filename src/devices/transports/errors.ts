import type {
  DeviceOperationError,
  DeviceOperationErrorCode,
} from '../contracts'

export interface BleErrorFallback {
  fallbackCode: DeviceOperationErrorCode
  fallbackMessage: string
  retryable?: boolean
}

function failureText(failure: unknown): string {
  if (typeof failure === 'string') return failure.toLowerCase()
  if (failure === null || typeof failure !== 'object') return ''

  const candidate = failure as {
    code?: unknown
    message?: unknown
    name?: unknown
  }
  return [candidate.code, candidate.name, candidate.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
}

export function normalizeBleError(
  failure: unknown,
  fallback: BleErrorFallback,
): DeviceOperationError {
  const text = failureText(failure)

  if (/permission|unauthori[sz]ed|not authorized|access denied/.test(text)) {
    return {
      code: 'permission_denied',
      message: 'Bluetooth permission was denied.',
      retryable: false,
    }
  }
  if (/powered? off|disabled|not enabled|bluetooth[^a-z]+off/.test(text)) {
    return {
      code: 'powered_off',
      message: 'Bluetooth is powered off.',
      retryable: true,
    }
  }
  if (/time.?out|timed out|deadline/.test(text)) {
    return {
      code: 'timeout',
      message: 'The Bluetooth operation timed out.',
      retryable: true,
    }
  }
  if (/disconnect|not connected|connection lost/.test(text)) {
    return {
      code: 'disconnected',
      message: 'The Bluetooth device disconnected.',
      retryable: true,
    }
  }
  if (/unsupported|not supported|unavailable|unimplemented/.test(text)) {
    return {
      code: 'unsupported_platform',
      message: 'Bluetooth is unsupported on this platform.',
      retryable: false,
    }
  }

  return {
    code: fallback.fallbackCode,
    message: fallback.fallbackMessage,
    retryable: fallback.retryable ?? true,
  }
}
