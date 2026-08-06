import {
  commandCapability,
  type DeviceCapabilityReport,
  DeviceCapabilityId,
  type DeviceCommand,
  UnavailableCapabilityState,
} from './types'

export const deviceOperationErrorCodes = [
  'transport_unavailable',
  'discovery_failed',
  'device_not_found',
  'connection_failed',
  'session_closed',
  'permission_denied',
  'operation_cancelled',
  'command_rejected',
  'protocol_error',
  'invalid_data',
  'powered_off',
  'unsupported_platform',
  'timeout',
  'disconnected',
  'services_discovery_failed',
  'read_failed',
  'write_failed',
  'notification_failed',
] as const

export type DeviceOperationErrorCode =
  (typeof deviceOperationErrorCodes)[number]

export interface DeviceOperationError {
  code: DeviceOperationErrorCode
  message: string
  retryable: boolean
}

export interface CapabilityUnavailableError {
  code: 'capability_unavailable'
  message: string
  retryable: false
  capabilityId: DeviceCapabilityId
  capabilityState: UnavailableCapabilityState['status']
  reason: string
}

export type DeviceError = DeviceOperationError | CapabilityUnavailableError

export type DeviceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DeviceError }

export function capabilityUnavailable(
  capabilityId: DeviceCapabilityId,
  state: UnavailableCapabilityState,
): DeviceResult<never> {
  const requirement =
    state.status === 'requires_real_device'
      ? 'a real device'
      : 'a vendor profile'

  return {
    ok: false,
    error: {
      code: 'capability_unavailable',
      message: `${capabilityId} requires ${requirement}`,
      retryable: false,
      capabilityId,
      capabilityState: state.status,
      reason: state.reason,
    },
  }
}

export function requireCommandCapability(
  command: DeviceCommand,
  capabilities: DeviceCapabilityReport,
): DeviceResult<DeviceCapabilityId> {
  const capabilityId = commandCapability(command)
  const state = capabilities[capabilityId]

  if (state.status !== 'implemented') {
    return capabilityUnavailable(capabilityId, state)
  }

  return { ok: true, value: capabilityId }
}
