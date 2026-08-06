import type { RingProfile, RingRole } from './profile'
import { createRingFrameParser } from './parser'
import { createRingProfile } from './profile'

export const RING_FIXTURE_PROVENANCE = {
  sourceReference: 'fixture:ring-reviewed-profile:heart-rate:v1',
  sourceUrl: 'https://example.test/ring-profile/heart-rate-v1',
  validation: 'fixture_only' as const,
} satisfies RingProfile['provenance']

export function createRingFrame(bytes: readonly number[]): Uint8Array {
  return new Uint8Array(bytes)
}

export function createRingFixtureProfile(
  options: { role?: RingRole } = {},
): RingProfile {
  const role = options.role ?? 'heart_rate'
  if (role !== 'heart_rate' && role !== 'ppg') {
    throw new Error('This fixture only configures heart-rate or PPG.')
  }

  const metricName = role === 'heart_rate' ? 'heart_rate' : 'ppg'
  const field = {
    name: metricName,
    offset: 0,
    byteLength: 1,
    signed: false,
    endianness: 'little_endian' as const,
    min: role === 'heart_rate' ? 30 : 0,
    max: role === 'heart_rate' ? 220 : 255,
    ...(role === 'heart_rate' ? { unit: 'bpm' } : {}),
  }

  return createRingProfile({
    profileId: 'fixture-ring-heart-rate-v1',
    provenance: RING_FIXTURE_PROVENANCE,
    constraints: {
      model: { exact: 'Fixture Ring' },
      firmware: { exact: 'fixture-1.0.0' },
    },
    discovery: {
      serviceIds: ['fixture-service'],
      names: ['Fixture Ring'],
    },
    roles: {
      [role]: {
        capability: { status: 'implemented' },
        gatt: {
          serviceId: 'fixture-service',
          characteristicId: `fixture-${metricName}`,
        },
        source: 'notification',
        parser: createRingFrameParser({
          role,
          rules: {
            fields: [field],
          },
          output: {
            kind: 'metric',
            name: metricName,
            valueField: metricName,
            ...(role === 'ppg' ? { privacy: 'local_only' as const } : {}),
          },
        }),
      },
    },
  })
}
