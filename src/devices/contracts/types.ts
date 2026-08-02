export const capabilityStatuses = [
  'implemented',
  'requires_real_device',
  'requires_vendor_profile',
] as const

export type CapabilityStatus = (typeof capabilityStatuses)[number]

export const deviceCapabilityIds = [
  'interaction_events',
  'telemetry',
  'haptic_feedback',
  'light_feedback',
  'status_reporting',
  'audio_capture',
] as const

export type DeviceCapabilityId = (typeof deviceCapabilityIds)[number]

export interface ImplementedCapabilityState {
  status: 'implemented'
}

export interface RequiresRealDeviceCapabilityState {
  status: 'requires_real_device'
  reason: string
}

export interface RequiresVendorProfileCapabilityState {
  status: 'requires_vendor_profile'
  reason: string
}

export type UnavailableCapabilityState =
  | RequiresRealDeviceCapabilityState
  | RequiresVendorProfileCapabilityState

export type CapabilityState =
  | ImplementedCapabilityState
  | UnavailableCapabilityState

export interface DeviceCapability {
  id: DeviceCapabilityId
  state: CapabilityState
}

export type DeviceCapabilityReport = {
  readonly [Capability in DeviceCapabilityId]: CapabilityState
}

export type DeviceCategory =
  | 'ring'
  | 'wearable'
  | 'marker'
  | 'dock'
  | 'unknown'

export interface NormalizedDevice {
  deviceId: string
  displayName?: string
  category: DeviceCategory
  adapterId: string
}

export interface DeviceSubscription {
  subscriptionId: string
  /** Removes the listener; repeated calls have no additional effect. */
  unsubscribe(): void
}

export type TelemetryCategory =
  | 'physiological'
  | 'motion'
  | 'environmental'
  | 'device_status'

export interface TelemetryReference {
  referenceId: string
  deviceId: string
  category: TelemetryCategory
  observedAt: string
  contextStrength: 'weak'
  interpretationPolicy: 'no_emotion_grief_or_health_inference'
}

export type DeviceEventSource = 'physical' | 'simulated'

export interface NormalizedDeviceEventBase {
  eventId: string
  deviceId: string
  sessionId: string
  occurredAt: string
  source: DeviceEventSource
  /** Transport frames and characteristic references cannot cross this boundary. */
  transportFrame?: never
  characteristic?: never
}

export type DeviceInteraction =
  | 'mark_moment'
  | 'touch'
  | 'confirm'
  | 'dismiss'
  | 'gesture'

export interface InteractionDeviceEvent extends NormalizedDeviceEventBase {
  kind: 'interaction'
  interaction: DeviceInteraction
}

export interface TelemetryReferenceDeviceEvent
  extends NormalizedDeviceEventBase {
  kind: 'telemetry_reference'
  telemetry: TelemetryReference
}

export type DeviceStatus =
  | 'connected'
  | 'disconnected'
  | 'worn'
  | 'removed'
  | 'battery_low'

export interface StatusDeviceEvent extends NormalizedDeviceEventBase {
  kind: 'status'
  status: DeviceStatus
}

export type NormalizedDeviceEvent =
  | InteractionDeviceEvent
  | TelemetryReferenceDeviceEvent
  | StatusDeviceEvent

interface DeviceCommandBase {
  commandId: string
  issuedAt: string
}

export interface HapticFeedbackCommand extends DeviceCommandBase {
  kind: 'haptic_feedback'
  pattern: 'acknowledge' | 'attention'
}

export interface LightFeedbackCommand extends DeviceCommandBase {
  kind: 'light_feedback'
  state: 'off' | 'ready' | 'active' | 'error'
}

export interface RequestStatusCommand extends DeviceCommandBase {
  kind: 'request_status'
}

export interface RequestTelemetryCommand extends DeviceCommandBase {
  kind: 'request_telemetry'
  category: TelemetryCategory
}

export type DeviceCommand =
  | HapticFeedbackCommand
  | LightFeedbackCommand
  | RequestStatusCommand
  | RequestTelemetryCommand

export type CommandAcknowledgementStatus =
  | 'accepted'
  | 'completed'
  | 'rejected'

export interface CommandAcknowledgement {
  commandId: string
  sessionId: string
  status: CommandAcknowledgementStatus
  acknowledgedAt: string
  reason?: string
}

export function commandCapability(
  command: DeviceCommand,
): DeviceCapabilityId {
  switch (command.kind) {
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
