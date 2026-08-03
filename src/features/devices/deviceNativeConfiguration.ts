import {
  capabilityUnavailable,
  commandCapability,
  type DeviceAdapter,
  type DeviceCapabilityReport,
  type DeviceResult,
  type DeviceSession,
  type DeviceSessionState,
  type DeviceSubscription,
  type DeviceTransportSession,
  type DiscoveredDevice,
  type NormalizedDeviceEventBase,
} from '../../devices/contracts'
import {
  createOmiAudioAdapter,
  OFFICIAL_OMI_AUDIO_PROFILE,
  type OmiAudioAdapterOptions,
} from '../../devices/adapters/omi'
import {
  createRingAdapter,
  createRingProfile,
  type RingProfile,
} from '../../devices/adapters/ring'

export interface DeviceNativeEnvironment {
  VITE_OMI_FRAGMENT_LAYOUT?: string
  VITE_OMI_FIRMWARE_MODEL?: string
  VITE_OMI_FIRMWARE_VERSION?: string
  VITE_RING_DISCOVERY_NAMES?: string
  VITE_RING_DISCOVERY_SERVICE_IDS?: string
}

export interface DeviceNativeConfiguration {
  omi?: OmiAudioAdapterOptions
  ring?: RingProfile
}

const unavailableCapabilities: DeviceCapabilityReport = {
  interaction_events: {
    status: 'requires_vendor_profile',
    reason: 'No reviewed interaction profile is configured.',
  },
  telemetry: {
    status: 'requires_vendor_profile',
    reason: 'No reviewed telemetry profile is configured.',
  },
  haptic_feedback: {
    status: 'requires_vendor_profile',
    reason: 'No reviewed haptic command is configured.',
  },
  light_feedback: {
    status: 'requires_vendor_profile',
    reason: 'No reviewed light command is configured.',
  },
  status_reporting: {
    status: 'requires_vendor_profile',
    reason: 'No reviewed status profile is configured.',
  },
  audio_capture: {
    status: 'requires_real_device',
    reason: 'OMI audio needs reviewed framing and named-firmware validation.',
  },
}

function list(value: string | undefined) {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseFragmentLayout(value: string | undefined) {
  if (value === undefined) return undefined
  try {
    const candidate = JSON.parse(value) as unknown
    if (candidate === null || Array.isArray(candidate) || typeof candidate !== 'object') {
      return undefined
    }
    const layout: Record<number, number> = {}
    for (const [key, size] of Object.entries(candidate)) {
      const fragment = Number(key)
      if (
        !Number.isInteger(fragment) ||
        fragment < 0 ||
        fragment > 255 ||
        typeof size !== 'number' ||
        !Number.isInteger(size) ||
        size <= 0
      ) {
        return undefined
      }
      layout[fragment] = size
    }
    return Object.keys(layout).length === 0 ? undefined : layout
  } catch {
    return undefined
  }
}

export function readDeviceNativeConfiguration(
  environment: DeviceNativeEnvironment,
): DeviceNativeConfiguration {
  const fragmentLayout = parseFragmentLayout(
    environment.VITE_OMI_FRAGMENT_LAYOUT,
  )
  const firmwareModel = environment.VITE_OMI_FIRMWARE_MODEL?.trim()
  const firmwareVersion = environment.VITE_OMI_FIRMWARE_VERSION?.trim()
  const ringNames = list(environment.VITE_RING_DISCOVERY_NAMES)
  const ringServiceIds = list(environment.VITE_RING_DISCOVERY_SERVICE_IDS)

  return {
    ...(fragmentLayout !== undefined && firmwareModel && firmwareVersion
      ? {
          omi: {
            framing: { payloadBytesByFragmentIndex: fragmentLayout },
            firmware: {
              model: firmwareModel,
              version: firmwareVersion,
              validation: 'fixture_only' as const,
            },
          },
        }
      : {}),
    ...(ringNames?.length || ringServiceIds?.length
      ? {
          ring: createRingProfile({
            profileId: 'ring-runtime-discovery-only',
            provenance: {
              sourceReference: 'local-reviewed-discovery-configuration',
              validation: 'fixture_only',
            },
            discovery: {
              ...(ringNames?.length ? { names: ringNames } : {}),
              ...(ringServiceIds?.length ? { serviceIds: ringServiceIds } : {}),
            },
          }),
        }
      : {}),
  }
}

function matchesOfficialOmi(device: DiscoveredDevice) {
  if (!device.connectable || device.transportKind !== 'bluetooth_low_energy') {
    return false
  }
  const expectedService = OFFICIAL_OMI_AUDIO_PROFILE.gatt.serviceId.toLowerCase()
  return (
    device.displayName === 'Omi' ||
    (device.advertisedServiceIds?.some(
      (serviceId) => serviceId.toLowerCase() === expectedService,
    ) ?? false)
  )
}

function createOmiDiscoveryOnlyAdapter(): DeviceAdapter {
  let sessionSequence = 0
  return {
    adapterId: 'omi-audio-unconfigured',
    matches: matchesOfficialOmi,
    async openSession(
      transportSession: DeviceTransportSession,
    ): Promise<DeviceResult<DeviceSession>> {
      if (transportSession.getState() !== 'connected') {
        return {
          ok: false,
          error: {
            code: 'disconnected',
            message: 'The OMI transport session is disconnected.',
            retryable: true,
          },
        }
      }
      const sessionId = `omi-unconfigured-session-${++sessionSequence}`
      let state: DeviceSessionState = 'open'
      let closePromise: Promise<DeviceResult<void>> | undefined
      return {
        ok: true,
        value: {
          sessionId,
          device: {
            deviceId: `omi-unconfigured-device-${sessionSequence}`,
            displayName: transportSession.device.displayName,
            category: 'wearable',
            adapterId: 'omi-audio-unconfigured',
          },
          capabilities: unavailableCapabilities,
          getState: () => state,
          subscribe(): DeviceResult<DeviceSubscription> {
            return {
              ok: true,
              value: {
                subscriptionId: `${sessionId}-idle`,
                unsubscribe() {},
              },
            }
          },
          execute(command) {
            return Promise.resolve(
              capabilityUnavailable(commandCapability(command), {
                status: 'requires_vendor_profile',
                reason: 'The physical protocol is not configured.',
              }),
            )
          },
          close() {
            if (closePromise !== undefined) return closePromise
            state = 'closing'
            closePromise = transportSession.close().then((result) => {
              state = result.ok ? 'closed' : 'failed'
              return result
            })
            return closePromise
          },
        },
      }
    },
  } satisfies DeviceAdapter<NormalizedDeviceEventBase>
}

export function createConfiguredPhysicalAdapters(
  configuration: DeviceNativeConfiguration,
): readonly DeviceAdapter<any>[] {
  return [
    configuration.omi === undefined
      ? createOmiDiscoveryOnlyAdapter()
      : createOmiAudioAdapter(configuration.omi),
    ...(configuration.ring === undefined
      ? []
      : [createRingAdapter(configuration.ring)]),
  ]
}
