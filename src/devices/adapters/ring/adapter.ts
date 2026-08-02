import {
  capabilityUnavailable,
  requireCommandCapability,
  type CommandAcknowledgement,
  type DeviceAdapter,
  type DeviceCapabilityId,
  type DeviceCapabilityReport,
  type CapabilityState,
  type DeviceCommand,
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
  ringRoles,
  type RingCapabilityReport,
  type RingCapabilityStatus,
  type RingProfile,
  type RingRole,
  type RingRoleDefinition,
} from './profile'
import {
  type RingFrameParser,
  type RingFrameParserOutcome,
  type RingParseFailure,
} from './parser'

export interface RingEventProvenance {
  profileId: string
  sourceReference: string
  sourceUrl?: string
  model?: string
  firmware?: string
  validation: 'fixture_only' | 'physical_device'
}

export interface RingContextMetadata {
  contextStrength: 'weak'
  interpretationPolicy: 'no_emotion_grief_or_health_inference'
  provenance: RingEventProvenance
}

export interface RingMetricEvent extends NormalizedDeviceEventBase {
  kind: 'metric'
  sessionSequence: number
  metric: RingContextMetadata & {
    role: RingRole
    name: string
    value?: number | readonly number[] | string | boolean
    unit?: string
    privacy: 'normalized' | 'local_only'
    exportConsentRequired: boolean
  }
}

export interface RingStatusEvent extends NormalizedDeviceEventBase {
  kind: 'status'
  sessionSequence: number
  status: RingContextMetadata & {
    role: RingRole
    value: string
  }
}

export interface RingHistoryEvent extends NormalizedDeviceEventBase {
  kind: 'history'
  sessionSequence: number
  history: RingContextMetadata & {
    role: RingRole
    record: Readonly<Record<string, number | string | boolean>>
  }
}

export interface RingParseFailureEvent extends NormalizedDeviceEventBase {
  kind: 'parse_failure'
  sessionSequence: number
  errorCode: 'invalid_data'
  failure: RingParseFailure
}

export type RingAdapterEvent =
  | RingMetricEvent
  | RingStatusEvent
  | RingHistoryEvent
  | RingParseFailureEvent

export interface RingDeviceSession extends DeviceSession<RingAdapterEvent> {
  ringCapabilities: RingCapabilityReport
}

export interface RingAdapter extends DeviceAdapter<RingAdapterEvent> {
  openSession(
    transportSession: DeviceTransportSession,
  ): Promise<DeviceResult<RingDeviceSession>>
}

const operationMessages: Record<
  Extract<DeviceError['code'], 'disconnected' | 'protocol_error' | 'session_closed' | 'invalid_data' | 'write_failed' | 'notification_failed'>,
  string
> = {
  disconnected: 'The ring transport session is not connected.',
  protocol_error: 'The ring adapter session cannot be opened twice.',
  session_closed: 'The ring adapter session is not open.',
  invalid_data: 'The ring frame or profile data is invalid.',
  write_failed: 'The ring command write failed.',
  notification_failed: 'The ring notification subscription failed.',
}

function operationFailure<Code extends keyof typeof operationMessages>(
  code: Code,
  retryable: boolean,
): DeviceResult<never> {
  return {
    ok: false,
    error: {
      code,
      message: operationMessages[code],
      retryable,
    },
  }
}

function ringCapabilityToDeviceState(status: RingCapabilityStatus): CapabilityState {
  if (status === 'implemented') return { status }
  return {
    status,
    reason:
      status === 'requires_real_device'
        ? 'Physical ring validation is required.'
        : 'No reviewed ring role is configured.',
  }
}

function mergeDeviceCapability(
  current: CapabilityState,
  next: RingCapabilityStatus,
): CapabilityState {
  if (current.status === 'implemented' || next === 'implemented') {
    return ringCapabilityToDeviceState('implemented')
  }
  if (
    current.status === 'requires_real_device' ||
    next === 'requires_real_device'
  ) {
    return ringCapabilityToDeviceState('requires_real_device')
  }
  return ringCapabilityToDeviceState('requires_vendor_profile')
}

function createDeviceCapabilities(
  profile: RingProfile,
): DeviceCapabilityReport {
  const capabilities: Record<DeviceCapabilityId, CapabilityState> = {
    interaction_events: ringCapabilityToDeviceState('requires_vendor_profile'),
    telemetry: ringCapabilityToDeviceState('requires_vendor_profile'),
    haptic_feedback: ringCapabilityToDeviceState('requires_vendor_profile'),
    light_feedback: ringCapabilityToDeviceState('requires_vendor_profile'),
    status_reporting: ringCapabilityToDeviceState('requires_vendor_profile'),
    audio_capture: ringCapabilityToDeviceState('requires_vendor_profile'),
  }

  for (const role of ringRoles) {
    const status = profile.capabilities[role].status
    if (role === 'wear') {
      capabilities.status_reporting = mergeDeviceCapability(
        capabilities.status_reporting,
        status,
      )
    } else if (role !== 'identity' && role !== 'commands') {
      capabilities.telemetry = mergeDeviceCapability(
        capabilities.telemetry,
        status,
      )
    }
  }

  const commands = profile.roles.commands
  if (
    commands !== undefined &&
    profile.capabilities.commands.status !== 'requires_vendor_profile'
  ) {
    for (const command of commands.commands ?? []) {
      if (typeof command.encode !== 'function') continue
      const capability = commandCapabilityForKind(command.commandKind)
      capabilities[capability] = mergeDeviceCapability(
        capabilities[capability],
        profile.capabilities.commands.status,
      )
    }
  }
  return capabilities
}

function commandCapabilityForKind(
  kind: DeviceCommand['kind'],
): DeviceCapabilityId {
  switch (kind) {
    case 'haptic_feedback':
      return 'haptic_feedback'
    case 'light_feedback':
      return 'light_feedback'
    case 'request_status':
      return 'status_reporting'
    case 'request_telemetry':
      return 'telemetry'
  }
}

function isEnabledDataRole(
  definition: RingRoleDefinition | undefined,
  role: RingRole,
  capabilities: RingCapabilityReport,
): definition is RingRoleDefinition & {
  gatt: NonNullable<RingRoleDefinition['gatt']>
  parser: RingFrameParser
  source: NonNullable<RingRoleDefinition['source']>
} {
  if (
    role === 'commands' ||
    definition?.capability.status !== 'implemented' ||
    capabilities[role].status !== 'implemented'
  ) {
    return false
  }
  return (
    definition.gatt !== undefined &&
    definition.parser !== undefined &&
    definition.source === 'notification'
  )
}

function isNonBlank(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function validateProfile(profile: RingProfile): boolean {
  if (
    !isNonBlank(profile.profileId) ||
    !isNonBlank(profile.provenance.sourceReference)
  ) {
    return false
  }

  const discoveryHints = [
    ...(profile.discovery.serviceIds ?? []),
    ...(profile.discovery.names ?? []),
    ...(profile.discovery.namePrefixes ?? []),
  ]
  if (discoveryHints.some((hint) => !isNonBlank(hint))) return false

  const hasImplementedCapability = ringRoles.some(
    (role) => profile.capabilities[role].status === 'implemented',
  )
  if (
    hasImplementedCapability &&
    (!isNonBlank(profile.constraints.model?.exact) ||
      !isNonBlank(profile.constraints.firmware?.exact) ||
      discoveryHints.length === 0)
  ) {
    return false
  }

  for (const role of ringRoles) {
    const definition = profile.roles[role]
    if (profile.capabilities[role].status !== 'implemented') continue
    if (definition?.capability.status !== 'implemented') return false
    if (role === 'commands') {
      if (
        definition.commands === undefined ||
        definition.commands.length === 0 ||
        definition.commands.some(
          (command) =>
            command.characteristic.serviceId.trim() === '' ||
            command.characteristic.characteristicId.trim() === '' ||
            typeof command.encode !== 'function',
        )
      ) {
        return false
      }
    } else if (!isEnabledDataRole(definition, role, profile.capabilities)) {
      return false
    }
  }
  return true
}

function matchesHint(
  device: DeviceTransportSession['device'],
  profile: RingProfile,
): boolean {
  const serviceMatches =
    profile.discovery.serviceIds?.some((expected) =>
      isNonBlank(expected) &&
      (device.advertisedServiceIds?.some(
        (actual) => actual.toLowerCase() === expected.toLowerCase(),
      ) ?? false),
    ) ?? false
  const nameMatches =
    (device.displayName !== undefined &&
      (profile.discovery.names?.some(
        (name) => isNonBlank(name) && name === device.displayName,
      ) ?? false)) ||
    (device.displayName !== undefined &&
      (profile.discovery.namePrefixes?.some((prefix) =>
        isNonBlank(prefix) && device.displayName?.startsWith(prefix),
      ) ?? false))
  return serviceMatches || nameMatches
}

function eventProvenance(profile: RingProfile): RingEventProvenance {
  return {
    profileId: profile.profileId,
    sourceReference: profile.provenance.sourceReference,
    ...(profile.provenance.sourceUrl === undefined
      ? {}
      : { sourceUrl: profile.provenance.sourceUrl }),
    ...(profile.constraints.model?.exact === undefined
      ? {}
      : { model: profile.constraints.model.exact }),
    ...(profile.constraints.firmware?.exact === undefined
      ? {}
      : { firmware: profile.constraints.firmware.exact }),
    validation: profile.provenance.validation,
  }
}

function toParseFailure(code: RingParseFailure['code']): RingParseFailure {
  const messages: Record<RingParseFailure['code'], string> = {
    empty_input: 'The ring frame is empty.',
    frame_too_short: 'The ring frame is shorter than the configured layout.',
    frame_too_long: 'The ring frame is longer than the configured layout.',
    field_out_of_bounds: 'The configured ring field is outside the frame.',
    value_out_of_bounds: 'The ring frame value is outside the configured bounds.',
    checksum_mismatch: 'The ring frame checksum is invalid.',
    invalid_parser_config: 'The configured ring parser is invalid.',
  }
  return { code, message: messages[code], retryable: false }
}

export function createRingAdapter(profile: RingProfile): RingAdapter {
  const activeTransportSessions = new WeakSet<DeviceTransportSession>()
  let sessionSequence = 0

  return {
    adapterId: 'ring',
    matches(device) {
      return (
        device.connectable &&
        device.transportKind === 'bluetooth_low_energy' &&
        matchesHint(device, profile)
      )
    },
    async openSession(transportSession) {
      if (transportSession.getState() !== 'connected') {
        return operationFailure('disconnected', true)
      }
      if (activeTransportSessions.has(transportSession)) {
        return operationFailure('protocol_error', false)
      }
      if (!validateProfile(profile)) {
        return operationFailure('invalid_data', false)
      }
      activeTransportSessions.add(transportSession)

      const localSessionSequence = ++sessionSequence
      const normalizedSessionId = `ring-session-${localSessionSequence}`
      const normalizedDevice = {
        deviceId: `ring-device-${localSessionSequence}`,
        displayName: transportSession.device.displayName,
        category: 'ring' as const,
        adapterId: 'ring',
      }
      const capabilities = createDeviceCapabilities(profile)
      const ringCapabilities = profile.capabilities
      const provenance = eventProvenance(profile)
      let state: DeviceSessionState = 'opening'
      let acceptingFrames = true
      let eventSequence = 0
      let frameSequence = 0
      let listenerSequence = 0
      const listeners = new Map<number, (event: RingAdapterEvent) => void>()
      const transportSubscriptions = new Map<
        RingRole,
        DeviceTransportNotificationSubscription
      >()
      const activeWrites = new Set<Promise<DeviceResult<void>>>()
      let closePromise: Promise<DeviceResult<void>> | undefined

      const emit = (event: RingAdapterEvent) => {
        for (const listener of [...listeners.values()]) {
          try {
            listener(event)
          } catch {
            // A consumer cannot stop another listener or parser recovery.
          }
        }
      }

      const emitOutcome = (
        role: RingRole,
        input: Parameters<RingFrameParser>[0],
        outcome: RingFrameParserOutcome,
      ) => {
        eventSequence += 1
        if (!outcome.ok) {
          emit({
            eventId: `${normalizedSessionId}-event-${eventSequence}`,
            deviceId: normalizedDevice.deviceId,
            sessionId: normalizedSessionId,
            occurredAt: input.receivedAt,
            source: input.source === 'read' ? 'physical' : 'physical',
            kind: 'parse_failure',
            sessionSequence: frameSequence,
            errorCode: 'invalid_data',
            failure: {
              ...toParseFailure(outcome.failure.code),
              retryable: outcome.failure.retryable,
            },
          })
          return
        }

        const frame = outcome.value
        const context = {
          contextStrength: 'weak' as const,
          interpretationPolicy:
            'no_emotion_grief_or_health_inference' as const,
          provenance,
        }
        if (frame.kind === 'metric') {
          const metric = frame.metric
          const rawLocalRole = role === 'ppg' || role === 'accelerometer'
          const localOnly = rawLocalRole || metric.privacy === 'local_only'
          emit({
            eventId: `${normalizedSessionId}-event-${eventSequence}`,
            deviceId: normalizedDevice.deviceId,
            sessionId: normalizedSessionId,
            occurredAt: input.receivedAt,
            source: 'physical',
            kind: 'metric',
            sessionSequence: frameSequence,
            metric: {
              ...context,
              role,
              name: rawLocalRole ? role : metric.name,
              ...(localOnly
                ? {}
                : metric.value === undefined
                  ? {}
                  : { value: metric.value }),
              ...(rawLocalRole || metric.unit === undefined
                ? {}
                : { unit: metric.unit }),
              privacy: localOnly ? 'local_only' : 'normalized',
              exportConsentRequired: localOnly,
            },
          })
        } else if (frame.kind === 'status') {
          if (role === 'ppg' || role === 'accelerometer') {
            emit({
              eventId: `${normalizedSessionId}-event-${eventSequence}`,
              deviceId: normalizedDevice.deviceId,
              sessionId: normalizedSessionId,
              occurredAt: input.receivedAt,
              source: 'physical',
              kind: 'parse_failure',
              sessionSequence: frameSequence,
              errorCode: 'invalid_data',
              failure: toParseFailure('invalid_parser_config'),
            })
            return
          }
          emit({
            eventId: `${normalizedSessionId}-event-${eventSequence}`,
            deviceId: normalizedDevice.deviceId,
            sessionId: normalizedSessionId,
            occurredAt: input.receivedAt,
            source: 'physical',
            kind: 'status',
            sessionSequence: frameSequence,
            status: { ...context, role, value: frame.status },
          })
        } else {
          if (role === 'ppg' || role === 'accelerometer') {
            emit({
              eventId: `${normalizedSessionId}-event-${eventSequence}`,
              deviceId: normalizedDevice.deviceId,
              sessionId: normalizedSessionId,
              occurredAt: input.receivedAt,
              source: 'physical',
              kind: 'parse_failure',
              sessionSequence: frameSequence,
              errorCode: 'invalid_data',
              failure: toParseFailure('invalid_parser_config'),
            })
            return
          }
          emit({
            eventId: `${normalizedSessionId}-event-${eventSequence}`,
            deviceId: normalizedDevice.deviceId,
            sessionId: normalizedSessionId,
            occurredAt: input.receivedAt,
            source: 'physical',
            kind: 'history',
            sessionSequence: frameSequence,
            history: { ...context, role, record: frame.record },
          })
        }
      }

      const cleanupSubscriptions = async () => {
        let firstFailure: DeviceResult<void> | undefined
        for (const subscription of transportSubscriptions.values()) {
          try {
            const result = await subscription.unsubscribe()
            if (!result.ok && firstFailure === undefined) {
              firstFailure = operationFailure('notification_failed', result.error.retryable)
            }
          } catch {
            if (firstFailure === undefined) {
              firstFailure = operationFailure('notification_failed', false)
            }
          }
        }
        transportSubscriptions.clear()
        return firstFailure
      }

      const session: RingDeviceSession = {
        sessionId: normalizedSessionId,
        device: normalizedDevice,
        capabilities,
        ringCapabilities,
        getState: () => state,
        subscribe(listener): DeviceResult<DeviceSubscription> {
          if (state !== 'open') return operationFailure('session_closed', false)
          const listenerId = ++listenerSequence
          listeners.set(listenerId, listener)
          let unsubscribed = false
          return {
            ok: true,
            value: {
              subscriptionId: `${normalizedSessionId}-listener-${listenerId}`,
              unsubscribe() {
                if (unsubscribed) return
                unsubscribed = true
                listeners.delete(listenerId)
              },
            },
          }
        },
        async execute(command): Promise<DeviceResult<CommandAcknowledgement>> {
          if (state !== 'open') return operationFailure('session_closed', false)
          const commandDefinition = (profile.roles.commands?.commands ?? []).find(
            (candidate) => candidate.commandKind === command.kind,
          )
          const commandCapability = commandCapabilityForKind(command.kind)
          if (
            commandDefinition === undefined ||
            profile.roles.commands?.capability.status ===
              'requires_vendor_profile' ||
            profile.capabilities.commands.status === 'requires_vendor_profile'
          ) {
            return capabilityUnavailable(commandCapability, {
              status: 'requires_vendor_profile',
              reason: 'No reviewed ring command encoder is configured.',
            })
          }
          if (
            profile.roles.commands?.capability.status === 'requires_real_device' ||
            profile.capabilities.commands.status === 'requires_real_device'
          ) {
            return capabilityUnavailable(commandCapability, {
              status: 'requires_real_device',
              reason: 'Physical ring command validation is required.',
            })
          }
          const available = requireCommandCapability(command, capabilities)
          if (!available.ok) return available

          let settleActiveWrite: (
            result: DeviceResult<void>,
          ) => void = () => undefined
          const activeWrite = new Promise<DeviceResult<void>>((resolve) => {
            settleActiveWrite = resolve
          })
          activeWrites.add(activeWrite)
          const finishActiveWrite = (result: DeviceResult<void>) => {
            settleActiveWrite(result)
            activeWrites.delete(activeWrite)
          }

          let payload: Uint8Array
          try {
            payload = new Uint8Array(commandDefinition.encode(command))
          } catch {
            const failed = operationFailure('invalid_data', false)
            finishActiveWrite(failed)
            return failed
          }
          let written: DeviceResult<void>
          try {
            written = await transportSession.write({
              characteristic: commandDefinition.characteristic,
              payload,
              mode: commandDefinition.mode ?? 'with_response',
            })
            if (!written.ok) {
              written = operationFailure('write_failed', written.error.retryable)
            }
          } catch {
            written = operationFailure('write_failed', false)
          }
          finishActiveWrite(written)
          if (!written.ok) return operationFailure('write_failed', written.error.retryable)
          return {
            ok: true,
            value: {
              commandId: command.commandId,
              sessionId: normalizedSessionId,
              status: 'accepted',
              acknowledgedAt: new Date().toISOString(),
            },
          }
        },
        close() {
          if (closePromise !== undefined) return closePromise
          state = 'closing'
          acceptingFrames = false
          closePromise = (async () => {
            await Promise.allSettled([...activeWrites])
            const subscriptionFailure = await cleanupSubscriptions()
            let sessionFailure: DeviceResult<void> | undefined
            try {
              const closed = await transportSession.close()
              if (!closed.ok) sessionFailure = operationFailure('disconnected', closed.error.retryable)
            } catch {
              sessionFailure = operationFailure('disconnected', false)
            }
            listeners.clear()
            activeTransportSessions.delete(transportSession)
            const firstFailure = subscriptionFailure ?? sessionFailure
            state = firstFailure === undefined ? 'closed' : 'failed'
            return firstFailure ?? { ok: true, value: undefined }
          })()
          return closePromise
        },
      }

      for (const role of ringRoles) {
        const definition = profile.roles[role]
        if (
          !isEnabledDataRole(definition, role, profile.capabilities) ||
          definition.source !== 'notification'
        ) continue
        let subscribed: Awaited<
          ReturnType<DeviceTransportSession['subscribe']>
        >
        try {
          subscribed = await transportSession.subscribe(
            definition.gatt,
            (frame) => {
              if (!acceptingFrames) return
              frameSequence += 1
              const parserInput = {
                bytes: new Uint8Array(frame.payload),
                transportSequence: frame.sequence,
                receivedAt: frame.receivedAt,
                source: frame.source,
              }
              if (
                frame.characteristic.serviceId.toLowerCase() !==
                  definition.gatt.serviceId.toLowerCase() ||
                frame.characteristic.characteristicId.toLowerCase() !==
                  definition.gatt.characteristicId.toLowerCase()
              ) {
                emitOutcome(role, parserInput, {
                  ok: false,
                  failure: toParseFailure('invalid_parser_config'),
                })
                return
              }
              try {
                emitOutcome(role, parserInput, definition.parser(parserInput))
              } catch {
                emitOutcome(role, parserInput, {
                  ok: false,
                  failure: toParseFailure('invalid_parser_config'),
                })
              }
            },
          )
        } catch {
          acceptingFrames = false
          await cleanupSubscriptions()
          activeTransportSessions.delete(transportSession)
          return operationFailure('notification_failed', false)
        }
        if (!subscribed.ok) {
          acceptingFrames = false
          await cleanupSubscriptions()
          activeTransportSessions.delete(transportSession)
          return operationFailure('notification_failed', subscribed.error.retryable)
        }
        transportSubscriptions.set(role, subscribed.value)
      }

      state = 'open'
      return { ok: true, value: session }
    },
  }
}
