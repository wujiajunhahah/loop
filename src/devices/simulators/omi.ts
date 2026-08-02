import {
  OFFICIAL_OMI_AUDIO_PROFILE,
  type OmiAudioChunkEvent,
} from '../adapters/omi'
import type { DeviceCapabilityReport } from '../contracts'
import { createSimulatorAdapter } from './adapter'
import { createDeterministicClock } from './clock'
import { createSimulatorTransport } from './transport'
import type {
  DeterministicClock,
  OmiSimulatorEventInput,
  OmiSimulatorOptions,
  SimulatorRuntime,
} from './types'

const DEFAULT_CAPABILITIES: DeviceCapabilityReport = {
  interaction_events: {
    status: 'requires_vendor_profile',
    reason: 'The OMI simulator only emits configured audio metadata.',
  },
  telemetry: {
    status: 'requires_vendor_profile',
    reason: 'The OMI simulator has no configured sensor profile.',
  },
  haptic_feedback: {
    status: 'requires_vendor_profile',
    reason: 'Simulators do not encode hardware commands.',
  },
  light_feedback: {
    status: 'requires_vendor_profile',
    reason: 'Simulators do not encode hardware commands.',
  },
  status_reporting: {
    status: 'requires_vendor_profile',
    reason: 'The OMI simulator has no configured status profile.',
  },
  audio_capture: {
    status: 'requires_real_device',
    reason: 'The simulator emits metadata only; physical audio requires a real device.',
  },
}

const DEFAULT_EVENTS: readonly OmiSimulatorEventInput[] = [
  { metadata: { packetSequence: 0, fragmentIndex: 0 } },
  { metadata: { packetSequence: 1, fragmentIndex: 0 } },
]

export function createOmiSimulator(
  options: OmiSimulatorOptions = {},
): SimulatorRuntime<OmiAudioChunkEvent> & {
  next(): OmiAudioChunkEvent | undefined
} {
  const clock = options.clock ?? createDeterministicClock()
  const device = {
    discoveryId: 'simulator-omi-device',
    transportId: 'simulator-omi-transport',
    transportKind: 'simulated' as const,
    displayName: options.deviceName ?? 'Simulated OMI',
    advertisedServiceIds: ['simulator:omi'],
    connectable: true,
    discoveredAt: clock.now(),
  }
  const transport = createSimulatorTransport(device)
  const events = [...(options.events ?? DEFAULT_EVENTS)]
  let index = 0
  const controller = createSimulatorAdapter<OmiAudioChunkEvent, OmiSimulatorEventInput>({
    adapterId: 'omi-audio-simulated',
    device,
    normalizedDevice: {
      deviceId: 'simulator-omi-normalized-device',
      displayName: device.displayName,
      category: 'wearable',
      adapterId: 'omi-audio-simulated',
    },
    capabilities: options.capabilities ?? DEFAULT_CAPABILITIES,
    fallbackSession: {
      sessionId: 'omi-audio-simulated-session-1',
      deviceId: 'simulator-omi-normalized-device',
    },
    now: () => clock.now(),
    createEvent(input, context, sequence, occurredAt) {
      const metadata = input.metadata ?? {}
      return {
        eventId: `${context.sessionId}-event-${sequence}`,
        deviceId: context.deviceId,
        sessionId: context.sessionId,
        kind: 'audio_chunk',
        occurredAt,
        source: 'simulated',
        metadata: {
          codec: metadata.codec ?? OFFICIAL_OMI_AUDIO_PROFILE.codecs[20]!.codec,
          sampleRateHz:
            metadata.sampleRateHz ?? OFFICIAL_OMI_AUDIO_PROFILE.codecs[20]!.sampleRateHz,
          bitDepth: metadata.bitDepth ?? OFFICIAL_OMI_AUDIO_PROFILE.codecs[20]!.bitDepth,
          channelCount:
            metadata.channelCount ?? OFFICIAL_OMI_AUDIO_PROFILE.codecs[20]!.channels,
          transportSequence: sequence,
          sessionSequence: sequence,
          packetSequence: metadata.packetSequence ?? sequence - 1,
          fragmentIndex: metadata.fragmentIndex ?? 0,
          receivedAt: occurredAt,
          source: 'notification',
          provenance: {
            profileId: OFFICIAL_OMI_AUDIO_PROFILE.profileId,
            sourceUrl: OFFICIAL_OMI_AUDIO_PROFILE.provenance.sourceUrl,
            sourceReference: OFFICIAL_OMI_AUDIO_PROFILE.provenance.sourceReference,
            firmwareCaveat: OFFICIAL_OMI_AUDIO_PROFILE.provenance.firmwareCaveat,
            firmware: {
              model: 'OMI deterministic simulator',
              version: 'simulated',
              validation: 'fixture_only',
            },
          },
        },
      }
    },
  })

  const next = () => {
    const input = events[index++]
    return input === undefined ? undefined : controller.emit(input)
  }
  const reset = () => {
    index = 0
    controller.reset()
    clock.reset()
  }
  return {
    kind: 'omi',
    device,
    transport,
    adapter: controller.adapter,
    clock,
    next,
    emit: (input = {}) => controller.emit(input as OmiSimulatorEventInput),
    reset,
    getSequence: controller.getSequence,
  }
}

export const createDeterministicOmiSimulator = createOmiSimulator

export type { DeterministicClock }
