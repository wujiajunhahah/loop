import type {
  CommandAcknowledgementStatus,
  DeviceCommand,
  DeviceEventSource,
  DeviceInteraction,
  DeviceStatus,
} from '../contracts/types'

export const protocolSchemaVersion = 1 as const

export const protocolMessageKinds = [
  'telemetry',
  'interaction',
  'audio_chunk',
  'status',
  'command',
  'acknowledgement',
  'parse_failure',
] as const

export type ProtocolMessageKind = (typeof protocolMessageKinds)[number]
export type ProtocolSource = DeviceEventSource

export interface CharacteristicProvenance {
  serviceId: string
  characteristicId: string
}

/** Metadata may locate a frame, but raw frame bytes never cross this boundary. */
export interface RawFrameMetadata {
  referenceId: string
  byteLength: number
  characteristic?: CharacteristicProvenance
  payload?: never
}

export interface DeviceSessionProvenance {
  adapterId: string
  transportId?: string
  transportSessionId?: string
  profileId?: string
  firmwareVersion?: string
  rawFrame?: RawFrameMetadata
}

export interface ProtocolEnvelopeBase {
  schemaVersion: typeof protocolSchemaVersion
  kind: ProtocolMessageKind
  messageId: string
  deviceId: string
  sessionId: string
  source: ProtocolSource
  /** Supplied by the session owner and strictly increased within that session. */
  sequence: number
  /** Null means that the device did not supply a timestamp. */
  deviceTimestamp: string | null
  receivedTimestamp: string
  provenance: DeviceSessionProvenance
}

export const measurementQualities = ['low', 'medium', 'high'] as const
export type MeasurementQuality = (typeof measurementQualities)[number]

export interface MeasurementProvenance {
  adapterId: string
  rawFrame?: RawFrameMetadata
}

interface MeasurementBase<Metric extends string, Unit extends string> {
  metric: Metric
  unit: Unit
  quality?: MeasurementQuality
  deviceTimestamp: string | null
  receivedTimestamp: string
  source: ProtocolSource
  provenance: MeasurementProvenance
}

export interface HeartRateMeasurement
  extends MeasurementBase<'heart_rate', 'beats_per_minute'> {
  value: number
}

/** RR intervals are inputs for HRV processing, not a diagnosis or inference. */
export interface RrIntervalMeasurement
  extends MeasurementBase<'rr_interval', 'milliseconds'> {
  values: readonly number[]
}

export interface Spo2Measurement
  extends MeasurementBase<'spo2', 'percent'> {
  value: number
}

export interface TemperatureMeasurement
  extends MeasurementBase<'temperature', 'celsius'> {
  value: number
}

export interface StepsMeasurement extends MeasurementBase<'steps', 'count'> {
  value: number
}

export interface ActivityMeasurement
  extends MeasurementBase<'activity', 'count' | 'seconds'> {
  value: number
}

export interface AccelerometerMeasurement
  extends MeasurementBase<
    'accelerometer',
    'g' | 'meters_per_second_squared' | 'raw'
  > {
  values: {
    x: number
    y: number
    z: number
  }
}

export interface BatteryMeasurement
  extends MeasurementBase<'battery', 'percent'> {
  value: number
}

/** A present record uses 1 for worn and 0 for removed; unknown state is omitted. */
export interface WearStateMeasurement
  extends MeasurementBase<'wear_state', 'boolean'> {
  value: 0 | 1
}

export type NormalizedMeasurement =
  | HeartRateMeasurement
  | RrIntervalMeasurement
  | Spo2Measurement
  | TemperatureMeasurement
  | StepsMeasurement
  | ActivityMeasurement
  | AccelerometerMeasurement
  | BatteryMeasurement
  | WearStateMeasurement

export interface TelemetryProtocolMessage extends ProtocolEnvelopeBase {
  kind: 'telemetry'
  telemetry: {
    /** Telemetry is context only and cannot drive emotion, grief, or health inference. */
    contextStrength: 'weak'
    interpretationPolicy: 'no_emotion_grief_or_health_inference'
    measurements: readonly NormalizedMeasurement[]
  }
}

export interface InteractionProtocolMessage extends ProtocolEnvelopeBase {
  kind: 'interaction'
  interaction: {
    type: DeviceInteraction
  }
}

interface AudioChunkBase {
  chunkId: string
  /** Adapter-supplied codec label; the protocol assumes no vendor codec ids. */
  codec: string
  sampleRateHz: number
  channels: number
  bitDepth?: number
  frameDurationMs?: number
}

export interface AudioChunkReference extends AudioChunkBase {
  content: {
    type: 'reference'
    referenceId: string
    byteLength: number
  }
}

export interface AudioChunkBytes extends AudioChunkBase {
  content: {
    type: 'bytes'
    /** JSON-native octets; codec errors never include these values. */
    bytes: readonly number[]
    byteLength: number
  }
}

export interface AudioChunkProtocolMessage extends ProtocolEnvelopeBase {
  kind: 'audio_chunk'
  audio: AudioChunkReference | AudioChunkBytes
}

export interface StatusProtocolMessage extends ProtocolEnvelopeBase {
  kind: 'status'
  status: {
    state: DeviceStatus
  }
}

export interface CommandProtocolMessage extends ProtocolEnvelopeBase {
  kind: 'command'
  /** Keep commandId unchanged across retries so receivers can deduplicate. */
  command: DeviceCommand
}

export const acknowledgementReasonCodes = [
  'unsupported',
  'invalid_request',
  'busy',
  'failed',
] as const

export type AcknowledgementReasonCode =
  (typeof acknowledgementReasonCodes)[number]

export interface ProtocolCommandAcknowledgement {
  commandId: string
  status: CommandAcknowledgementStatus
  acknowledgedAt: string
  /** True when this acknowledgement answers a repeated commandId. */
  deduplicated: boolean
  reasonCode?: AcknowledgementReasonCode
}

export interface AcknowledgementProtocolMessage extends ProtocolEnvelopeBase {
  kind: 'acknowledgement'
  acknowledgement: ProtocolCommandAcknowledgement
}

export const parseFailureStages = ['framing', 'decoding', 'validation'] as const
export type ParseFailureStage = (typeof parseFailureStages)[number]

export const parseFailureCodes = [
  'malformed_frame',
  'invalid_length',
  'unsupported_value',
  'integrity_check_failed',
] as const

export type ParseFailureCode = (typeof parseFailureCodes)[number]

/** Safe, non-fatal parser diagnostics contain no free-form text or payload bytes. */
export interface ParseFailureProtocolMessage extends ProtocolEnvelopeBase {
  kind: 'parse_failure'
  failure: {
    fatal: false
    stage: ParseFailureStage
    code: ParseFailureCode
  }
}

export type ProtocolMessage =
  | TelemetryProtocolMessage
  | InteractionProtocolMessage
  | AudioChunkProtocolMessage
  | StatusProtocolMessage
  | CommandProtocolMessage
  | AcknowledgementProtocolMessage
  | ParseFailureProtocolMessage
