import type {
  RingHistoryEvent,
  RingMetricEvent,
  RingStatusEvent,
} from '../adapters/ring'
import type { DeviceCapabilityReport } from '../contracts'
import { createSimulatorAdapter } from './adapter'
import { createDeterministicClock } from './clock'
import { createSimulatorTransport } from './transport'
import type {
  RingSimulatorEventInput,
  RingSimulatorOptions,
  SimulatorRuntime,
} from './types'

type RingSimulatorEvent = RingMetricEvent | RingStatusEvent | RingHistoryEvent

const DEFAULT_CAPABILITIES: DeviceCapabilityReport = {
  interaction_events: {
    status: 'requires_vendor_profile',
    reason: 'The ring simulator emits configured metric scenarios only.',
  },
  telemetry: { status: 'implemented' },
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
    reason: 'The ring simulator has no configured wear profile.',
  },
  audio_capture: {
    status: 'requires_vendor_profile',
    reason: 'The ring simulator does not capture audio.',
  },
}

const DEFAULT_EVENTS: readonly RingSimulatorEventInput[] = [
  { role: 'heart_rate', value: 72, unit: 'bpm' },
  { role: 'heart_rate', value: 73, unit: 'bpm' },
]

export function createRingSimulator(
  options: RingSimulatorOptions = {},
): SimulatorRuntime<RingSimulatorEvent> & {
  next(): RingSimulatorEvent | undefined
} {
  const clock = options.clock ?? createDeterministicClock()
  const device = {
    discoveryId: 'simulator-ring-device',
    transportId: 'simulator-ring-transport',
    transportKind: 'simulated' as const,
    displayName: options.deviceName ?? 'Simulated Ring',
    advertisedServiceIds: ['simulator:ring'],
    connectable: true,
    discoveredAt: clock.now(),
  }
  const transport = createSimulatorTransport(device)
  const events = [...(options.events ?? DEFAULT_EVENTS)]
  let index = 0
  const controller = createSimulatorAdapter<RingSimulatorEvent, RingSimulatorEventInput>({
    adapterId: 'ring-simulated',
    device,
    normalizedDevice: {
      deviceId: 'simulator-ring-normalized-device',
      displayName: device.displayName,
      category: 'ring',
      adapterId: 'ring-simulated',
    },
    capabilities: options.capabilities ?? DEFAULT_CAPABILITIES,
    fallbackSession: {
      sessionId: 'ring-simulated-session-1',
      deviceId: 'simulator-ring-normalized-device',
    },
    now: () => clock.now(),
    createEvent(input, context, sequence, occurredAt) {
      const kind = input.kind ?? 'metric'
      const provenance = {
        profileId: 'simulator:ring:scenario:v1',
        sourceReference: 'simulator:ring:scenario:v1',
        validation: 'fixture_only' as const,
      }
      const contextMetadata = {
        contextStrength: 'weak' as const,
        interpretationPolicy: 'no_emotion_grief_or_health_inference' as const,
        provenance,
      }
      const localOnly =
        input.role === 'ppg' ||
        input.role === 'accelerometer' ||
        input.privacy === 'local_only'
      if (localOnly) {
        return {
          eventId: `${context.sessionId}-event-${sequence}`,
          deviceId: context.deviceId,
          sessionId: context.sessionId,
          occurredAt,
          source: 'simulated',
          kind: 'metric',
          sessionSequence: sequence,
          metric: {
            ...contextMetadata,
            role: input.role,
            name: input.name ?? input.role,
            privacy: 'local_only',
            exportConsentRequired: true,
          },
        }
      }
      if (kind === 'status') {
        return {
          eventId: `${context.sessionId}-event-${sequence}`,
          deviceId: context.deviceId,
          sessionId: context.sessionId,
          occurredAt,
          source: 'simulated',
          kind: 'status',
          sessionSequence: sequence,
          status: {
            ...contextMetadata,
            role: input.role,
            value: input.status ?? 'simulated',
          },
        }
      }
      if (kind === 'history') {
        return {
          eventId: `${context.sessionId}-event-${sequence}`,
          deviceId: context.deviceId,
          sessionId: context.sessionId,
          occurredAt,
          source: 'simulated',
          kind: 'history',
          sessionSequence: sequence,
          history: {
            ...contextMetadata,
            role: input.role,
            record: input.record ?? {},
          },
        }
      }
      return {
        eventId: `${context.sessionId}-event-${sequence}`,
        deviceId: context.deviceId,
        sessionId: context.sessionId,
        occurredAt,
        source: 'simulated',
        kind: 'metric',
        sessionSequence: sequence,
        metric: {
          ...contextMetadata,
          role: input.role,
          name: input.name ?? input.role,
          ...(input.value === undefined ? {} : { value: input.value }),
          ...(input.unit === undefined ? {} : { unit: input.unit }),
          privacy: 'normalized',
          exportConsentRequired: false,
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
    kind: 'ring',
    device,
    transport,
    adapter: controller.adapter,
    clock,
    next,
    emit: (input = DEFAULT_EVENTS[0]) =>
      input === undefined ? undefined : controller.emit(input as RingSimulatorEventInput),
    reset,
    getSequence: controller.getSequence,
  }
}

export const createDeterministicRingSimulator = createRingSimulator

export type { RingSimulatorEvent }
