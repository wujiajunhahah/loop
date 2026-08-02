import {
  capabilityUnavailable,
  requireCommandCapability,
  type DeviceAdapter,
  type DeviceCapabilityReport,
  type DeviceError,
  type DeviceResult,
  type DeviceSession,
  type DeviceSessionState,
  type DeviceSubscription,
  type DeviceTransportNotificationSubscription,
  type DeviceTransportSession,
  type NormalizedDeviceEventBase,
} from '../../contracts'
import {
  createOmiAudioStreamParser,
  type OmiAudioChunkMetadata,
  type OmiAudioFramingConfiguration,
  type OmiAudioParseFailure,
  type OmiFirmwareProvenance,
} from './parser'
import {
  OFFICIAL_OMI_AUDIO_PROFILE,
  type OmiAudioProfile,
} from './profile'

export interface OmiAudioChunkEvent extends NormalizedDeviceEventBase {
  kind: 'audio_chunk'
  metadata: OmiAudioChunkMetadata
}

export interface OmiParseFailureEvent extends NormalizedDeviceEventBase {
  kind: 'parse_failure'
  errorCode: 'invalid_data'
  failure: OmiAudioParseFailure
}

export type OmiAdapterEvent = OmiAudioChunkEvent | OmiParseFailureEvent

export interface OmiAudioAdapterOptions {
  framing: OmiAudioFramingConfiguration
  firmware: OmiFirmwareProvenance
  profile?: OmiAudioProfile
}

const capabilities: DeviceCapabilityReport = {
  interaction_events: {
    status: 'requires_vendor_profile',
    reason: 'No official OMI touch or gesture profile is configured.',
  },
  telemetry: {
    status: 'requires_vendor_profile',
    reason: 'No official OMI sensor profile is configured.',
  },
  haptic_feedback: {
    status: 'requires_vendor_profile',
    reason: 'No official OMI command or acknowledgement profile is configured.',
  },
  light_feedback: {
    status: 'requires_vendor_profile',
    reason: 'No official OMI command or acknowledgement profile is configured.',
  },
  status_reporting: {
    status: 'requires_vendor_profile',
    reason: 'This audio-only profile does not configure status operations.',
  },
  audio_capture: {
    status: 'requires_real_device',
    reason:
      'OMI audio requires named-firmware physical-device and consent validation.',
  },
}

function operationFailure(
  code: Extract<
    DeviceError['code'],
    'disconnected' | 'invalid_data' | 'protocol_error' | 'session_closed'
  >,
  message: string,
  retryable: boolean,
): DeviceResult<never> {
  return { ok: false, error: { code, message, retryable } }
}

function matchesName(name: string | undefined, profile: OmiAudioProfile) {
  if (name === undefined) return false
  return (
    profile.discovery.names.includes(name) ||
    (profile.discovery.namePrefixes?.some((prefix) =>
      name.startsWith(prefix),
    ) ?? false)
  )
}

export function createOmiAudioAdapter(
  options: OmiAudioAdapterOptions,
): DeviceAdapter<OmiAdapterEvent> {
  const profile = options.profile ?? OFFICIAL_OMI_AUDIO_PROFILE
  const activeTransportSessions = new WeakSet<DeviceTransportSession>()
  let sessionSequence = 0

  return {
    adapterId: 'omi-audio',
    matches(device) {
      if (
        !device.connectable ||
        device.transportKind !== 'bluetooth_low_energy'
      ) {
        return false
      }
      const expectedService = profile.gatt.serviceId.toLowerCase()
      const serviceMatches =
        device.advertisedServiceIds?.some(
          (serviceId) => serviceId.toLowerCase() === expectedService,
        ) ?? false
      return serviceMatches || matchesName(device.displayName, profile)
    },
    async openSession(transportSession) {
      if (transportSession.getState() !== 'connected') {
        return operationFailure(
          'disconnected',
          'The OMI transport session is not connected.',
          true,
        )
      }
      if (activeTransportSessions.has(transportSession)) {
        return operationFailure(
          'protocol_error',
          'The OMI transport session already has an active adapter session.',
          false,
        )
      }
      activeTransportSessions.add(transportSession)

      const codecCharacteristic = {
        serviceId: profile.gatt.serviceId,
        characteristicId: profile.gatt.audioCodecId,
      }
      const codecRead = await transportSession.read(codecCharacteristic)
      if (!codecRead.ok) {
        activeTransportSessions.delete(transportSession)
        return codecRead
      }
      if (
        codecRead.value.payload.byteLength !== 1 ||
        codecRead.value.source !== 'read' ||
        codecRead.value.characteristic.serviceId.toLowerCase() !==
          profile.gatt.serviceId.toLowerCase() ||
        codecRead.value.characteristic.characteristicId.toLowerCase() !==
          profile.gatt.audioCodecId.toLowerCase()
      ) {
        activeTransportSessions.delete(transportSession)
        return operationFailure(
          'invalid_data',
          'The OMI codec characteristic returned invalid data.',
          false,
        )
      }

      const codecId = codecRead.value.payload[0]
      if (profile.codecs[codecId] === undefined) {
        activeTransportSessions.delete(transportSession)
        return operationFailure(
          'invalid_data',
          'The OMI codec is not supported by the configured profile.',
          false,
        )
      }

      const localSessionSequence = ++sessionSequence
      const normalizedSessionId = `omi-audio-session-${localSessionSequence}`
      const normalizedDevice = {
        deviceId: `omi-device-${localSessionSequence}`,
        displayName: transportSession.device.displayName,
        category: 'wearable' as const,
        adapterId: 'omi-audio',
      }
      const parser = createOmiAudioStreamParser({
        codecId,
        framing: options.framing,
        profile,
        firmware: options.firmware,
      })
      let state: DeviceSessionState = 'opening'
      let acceptingFrames = true
      let eventSequence = 0
      let listenerSequence = 0
      const listeners = new Map<
        number,
        (event: OmiAdapterEvent) => void
      >()
      let transportSubscription:
        | DeviceTransportNotificationSubscription
        | undefined
      let closePromise: Promise<DeviceResult<void>> | undefined

      const emit = (event: OmiAdapterEvent) => {
        for (const listener of [...listeners.values()]) {
          try {
            listener(event)
          } catch {
            // One consumer cannot block parser recovery or another listener.
          }
        }
      }
      const emitParserOutcomes = (
        outcomes: ReturnType<typeof parser.push>,
      ) => {
        for (const outcome of outcomes) {
          eventSequence += 1
          if (outcome.ok) {
            emit({
              eventId: `${normalizedSessionId}-event-${eventSequence}`,
              deviceId: normalizedDevice.deviceId,
              sessionId: normalizedSessionId,
              kind: 'audio_chunk',
              occurredAt: outcome.metadata.receivedAt,
              source: 'physical',
              metadata: outcome.metadata,
            })
          } else {
            emit({
              eventId: `${normalizedSessionId}-event-${eventSequence}`,
              deviceId: normalizedDevice.deviceId,
              sessionId: normalizedSessionId,
              kind: 'parse_failure',
              occurredAt: outcome.failure.receivedAt ?? codecRead.value.receivedAt,
              source: 'physical',
              errorCode: 'invalid_data',
              failure: outcome.failure,
            })
          }
        }
      }

      const subscribed = await transportSession.subscribe(
        {
          serviceId: profile.gatt.serviceId,
          characteristicId: profile.gatt.audioDataId,
        },
        (frame) => {
          if (!acceptingFrames) return
          emitParserOutcomes(
            parser.push({
              bytes: frame.payload,
              transportSequence: frame.sequence,
              receivedAt: frame.receivedAt,
              source: frame.source,
            }),
          )
        },
      )
      if (!subscribed.ok) {
        acceptingFrames = false
        activeTransportSessions.delete(transportSession)
        return subscribed
      }
      transportSubscription = subscribed.value
      state = 'open'

      const session: DeviceSession<OmiAdapterEvent> = {
        sessionId: normalizedSessionId,
        device: normalizedDevice,
        capabilities,
        getState: () => state,
        subscribe(listener): DeviceResult<DeviceSubscription> {
          if (state !== 'open') {
            return operationFailure(
              'session_closed',
              'The OMI adapter session is not open.',
              false,
            )
          }
          const listenerId = ++listenerSequence
          listeners.set(listenerId, listener)
          let unsubscribed = false
          return ok({
            subscriptionId: `${normalizedSessionId}-listener-${listenerId}`,
            unsubscribe() {
              if (unsubscribed) return
              unsubscribed = true
              listeners.delete(listenerId)
            },
          })
        },
        async execute(command) {
          const available = requireCommandCapability(command, capabilities)
          if (!available.ok) return available
          return capabilityUnavailable(available.value, {
            status: 'requires_vendor_profile',
            reason: 'No official OMI command or acknowledgement profile exists.',
          })
        },
        close() {
          if (closePromise !== undefined) return closePromise
          state = 'closing'
          acceptingFrames = false
          closePromise = (async () => {
            let firstFailure: DeviceResult<void> | undefined
            emitParserOutcomes(parser.finish())
            const unsubscribed = await transportSubscription?.unsubscribe()
            if (unsubscribed !== undefined && !unsubscribed.ok) {
              firstFailure = unsubscribed
            }
            const closed = await transportSession.close()
            if (!closed.ok && firstFailure === undefined) firstFailure = closed
            listeners.clear()
            activeTransportSessions.delete(transportSession)
            state = firstFailure === undefined ? 'closed' : 'failed'
            return firstFailure ?? ok(undefined)
          })()
          return closePromise
        },
      }

      return ok(session)
    },
  }
}

function ok<T>(value: T): DeviceResult<T> {
  return { ok: true, value }
}
