import type {
  DeviceCharacteristicRef,
  DeviceCommand,
  DeviceTransportReceiveSource,
} from '../../contracts'
import type { RingFrameParser } from './parser'

export const ringRoles = [
  'identity',
  'battery',
  'wear',
  'heart_rate',
  'rr_hrv',
  'spo2',
  'temperature',
  'steps_activity',
  'ppg',
  'accelerometer',
  'history_sync',
  'commands',
] as const

export type RingRole = (typeof ringRoles)[number]

export const ringCapabilityStatuses = [
  'implemented',
  'requires_real_device',
  'requires_vendor_profile',
] as const

export type RingCapabilityStatus = (typeof ringCapabilityStatuses)[number]

export interface RingCapabilityState {
  status: RingCapabilityStatus
  reason?: string
}

export type RingCapabilityReport = {
  readonly [Role in RingRole]: RingCapabilityState
}

export interface RingProfileProvenance {
  sourceReference: string
  sourceUrl?: string
  validation: 'fixture_only' | 'physical_device'
}

export interface RingExactConstraint {
  exact: string
}

export interface RingProfileConstraints {
  model?: RingExactConstraint
  firmware?: RingExactConstraint
}

export interface RingDiscoveryHints {
  serviceIds?: readonly string[]
  names?: readonly string[]
  namePrefixes?: readonly string[]
}

export interface RingCommandDefinition {
  commandKind: DeviceCommand['kind']
  characteristic: DeviceCharacteristicRef
  mode?: 'with_response' | 'without_response'
  encode(command: DeviceCommand): Uint8Array
}

export interface RingRoleDefinition {
  capability: RingCapabilityState
  gatt?: DeviceCharacteristicRef
  source?: DeviceTransportReceiveSource
  parser?: RingFrameParser
  commands?: readonly RingCommandDefinition[]
}

export interface RingProfileInput {
  profileId: string
  provenance: RingProfileProvenance
  constraints?: RingProfileConstraints
  discovery?: RingDiscoveryHints
  roles?: Partial<Record<RingRole, RingRoleDefinition>>
  capabilities?: Partial<
    Record<RingRole, RingCapabilityStatus | RingCapabilityState>
  >
}

export interface RingProfile {
  profileId: string
  provenance: RingProfileProvenance
  constraints: RingProfileConstraints
  discovery: RingDiscoveryHints
  roles: Partial<Record<RingRole, RingRoleDefinition>>
  capabilities: RingCapabilityReport
}

const defaultCapabilityReasons: Record<
  Exclude<RingCapabilityStatus, 'implemented'>,
  string
> = {
  requires_real_device: 'Physical ring validation is required.',
  requires_vendor_profile: 'No reviewed ring role is configured.',
}

export function capabilityState(
  status: RingCapabilityStatus,
): RingCapabilityState {
  return status === 'implemented'
    ? { status }
    : { status, reason: defaultCapabilityReasons[status] }
}

export function createRingCapabilityReport(
  roles: Partial<Record<RingRole, RingRoleDefinition>> = {},
  overrides: Partial<
    Record<RingRole, RingCapabilityStatus | RingCapabilityState>
  > = {},
): RingCapabilityReport {
  const report = {} as Record<RingRole, RingCapabilityState>
  for (const role of ringRoles) {
    const override = overrides[role]
    const status =
      (typeof override === 'string' ? override : override?.status) ??
      roles[role]?.capability.status ??
      'requires_vendor_profile'
    report[role] = capabilityState(status)
  }
  return report
}

export function createRingProfile(input: RingProfileInput): RingProfile {
  const roles = { ...(input.roles ?? {}) }
  return {
    profileId: input.profileId,
    provenance: { ...input.provenance },
    constraints: {
      ...(input.constraints?.model === undefined
        ? {}
        : { model: { ...input.constraints.model } }),
      ...(input.constraints?.firmware === undefined
        ? {}
        : { firmware: { ...input.constraints.firmware } }),
    },
    discovery: {
      ...(input.discovery?.serviceIds === undefined
        ? {}
        : { serviceIds: [...input.discovery.serviceIds] }),
      ...(input.discovery?.names === undefined
        ? {}
        : { names: [...input.discovery.names] }),
      ...(input.discovery?.namePrefixes === undefined
        ? {}
        : { namePrefixes: [...input.discovery.namePrefixes] }),
    },
    roles,
    capabilities: createRingCapabilityReport(roles, input.capabilities),
  }
}

export function createEmptyRingProfile(): RingProfile {
  return createRingProfile({
    profileId: 'ring-empty',
    provenance: {
      sourceReference: 'unconfigured',
      validation: 'fixture_only',
    },
  })
}
