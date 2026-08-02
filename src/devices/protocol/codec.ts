import type { ProtocolError, ProtocolErrorCode, ProtocolResult } from './errors'
import {
  acknowledgementReasonCodes,
  measurementQualities,
  parseFailureCodes,
  parseFailureStages,
  protocolMessageKinds,
  protocolSchemaVersion,
  type ProtocolMessage,
  type ProtocolMessageKind,
} from './types'

export const MAX_PROTOCOL_PAYLOAD_BYTES = 256 * 1024

export interface ProtocolCodecOptions {
  /** May tighten, but never raise, the hard protocol payload limit. */
  maxPayloadBytes?: number
}

const errorMessages: Readonly<Record<ProtocolErrorCode, string>> = {
  payload_too_large: 'Protocol payload exceeds the allowed size.',
  malformed_utf8: 'Payload is not valid UTF-8.',
  malformed_json: 'Payload is not valid JSON.',
  unsupported_version: 'Protocol schema version is not supported.',
  unknown_kind: 'Protocol message kind is not supported.',
  missing_required_field: 'Protocol message is missing a required field.',
  invalid_field: 'Protocol message contains an invalid field.',
  non_finite_number: 'Protocol numbers must be finite.',
}

function failure(
  code: ProtocolErrorCode,
  field?: string,
): ProtocolResult<never> {
  const error: ProtocolError = { code, message: errorMessages[code] }
  if (field) error.field = field
  return { ok: false, error }
}

function validationError(
  code: ProtocolErrorCode,
  field?: string,
): ProtocolError {
  const error: ProtocolError = { code, message: errorMessages[code] }
  if (field) error.field = field
  return error
}

type Validator = (value: unknown, path: string) => ProtocolError | undefined

interface FieldRule {
  validate: Validator
  optional?: true
}

function field(validate: Validator): FieldRule {
  return { validate }
}

function optional(validate: Validator): FieldRule {
  return { validate, optional: true }
}

function pathTo(parent: string, child: string): string {
  return parent ? `${parent}.${child}` : child
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUint8Array(value: unknown): value is Uint8Array {
  return (
    typeof value === 'object' &&
    value !== null &&
    ArrayBuffer.isView(value) &&
    Object.prototype.toString.call(value) === '[object Uint8Array]'
  )
}

function objectOf(rules: Readonly<Record<string, FieldRule>>): Validator {
  return (value, path) => {
    if (!isRecord(value)) return validationError('invalid_field', path)

    for (const [key, rule] of Object.entries(rules)) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        if (rule.optional) continue
        return validationError('missing_required_field', pathTo(path, key))
      }

      const error = rule.validate(value[key], pathTo(path, key))
      if (error) return error
    }

    const knownKeys = new Set(Object.keys(rules))
    if (Object.keys(value).some((key) => !knownKeys.has(key))) {
      return validationError('invalid_field', path || undefined)
    }

    return undefined
  }
}

const nonEmptyString: Validator = (value, path) =>
  typeof value === 'string' && value.length > 0
    ? undefined
    : validationError('invalid_field', path)

function oneOf<const Value extends string | number | boolean>(
  values: readonly Value[],
): Validator {
  return (value, path) =>
    values.some((allowed) => value === allowed)
      ? undefined
      : validationError('invalid_field', path)
}

function literal<Value extends string | number | boolean>(
  expected: Value,
): Validator {
  return oneOf([expected])
}

interface NumberRules {
  integer?: true
  min?: number
  max?: number
}

function numberValue(rules: NumberRules = {}): Validator {
  return (value, path) => {
    if (typeof value !== 'number') return validationError('invalid_field', path)
    if (!Number.isFinite(value)) {
      return validationError('non_finite_number', path)
    }
    if (rules.integer && !Number.isSafeInteger(value)) {
      return validationError('invalid_field', path)
    }
    if (rules.min !== undefined && value < rules.min) {
      return validationError('invalid_field', path)
    }
    if (rules.max !== undefined && value > rules.max) {
      return validationError('invalid_field', path)
    }
    return undefined
  }
}

function nullable(validate: Validator): Validator {
  return (value, path) =>
    value === null ? undefined : validate(value, path)
}

function arrayOf(validate: Validator, minimumLength = 0): Validator {
  return (value, path) => {
    if (!Array.isArray(value) || value.length < minimumLength) {
      return validationError('invalid_field', path)
    }
    for (let index = 0; index < value.length; index += 1) {
      const error = validate(value[index], `${path}[${index}]`)
      if (error) return error
    }
    return undefined
  }
}

const characteristicValidator = objectOf({
  serviceId: field(nonEmptyString),
  characteristicId: field(nonEmptyString),
})

const rawFrameValidator = objectOf({
  referenceId: field(nonEmptyString),
  byteLength: field(numberValue({ integer: true, min: 0 })),
  characteristic: optional(characteristicValidator),
})

const provenanceValidator = objectOf({
  adapterId: field(nonEmptyString),
  transportId: optional(nonEmptyString),
  transportSessionId: optional(nonEmptyString),
  profileId: optional(nonEmptyString),
  firmwareVersion: optional(nonEmptyString),
  rawFrame: optional(rawFrameValidator),
})

const measurementProvenanceValidator = objectOf({
  adapterId: field(nonEmptyString),
  rawFrame: optional(rawFrameValidator),
})

const sourceValidator = oneOf(['physical', 'simulated'] as const)
const qualityValidator = oneOf(measurementQualities)
const finiteNumber = numberValue()

function measurementRules(metric: string, unit: Validator) {
  return {
    metric: field(literal(metric)),
    unit: field(unit),
    quality: optional(qualityValidator),
    deviceTimestamp: field(nullable(nonEmptyString)),
    receivedTimestamp: field(nonEmptyString),
    source: field(sourceValidator),
    provenance: field(measurementProvenanceValidator),
  }
}

const measurementValidators = {
  heart_rate: objectOf({
    ...measurementRules('heart_rate', literal('beats_per_minute')),
    value: field(finiteNumber),
  }),
  rr_interval: objectOf({
    ...measurementRules('rr_interval', literal('milliseconds')),
    values: field(arrayOf(finiteNumber, 1)),
  }),
  spo2: objectOf({
    ...measurementRules('spo2', literal('percent')),
    value: field(finiteNumber),
  }),
  temperature: objectOf({
    ...measurementRules('temperature', literal('celsius')),
    value: field(finiteNumber),
  }),
  steps: objectOf({
    ...measurementRules('steps', literal('count')),
    value: field(finiteNumber),
  }),
  activity: objectOf({
    ...measurementRules('activity', oneOf(['count', 'seconds'] as const)),
    value: field(finiteNumber),
  }),
  accelerometer: objectOf({
    ...measurementRules(
      'accelerometer',
      oneOf(['g', 'meters_per_second_squared', 'raw'] as const),
    ),
    values: field(
      objectOf({
        x: field(finiteNumber),
        y: field(finiteNumber),
        z: field(finiteNumber),
      }),
    ),
  }),
  battery: objectOf({
    ...measurementRules('battery', literal('percent')),
    value: field(finiteNumber),
  }),
  wear_state: objectOf({
    ...measurementRules('wear_state', literal('boolean')),
    value: field(oneOf([0, 1] as const)),
  }),
} satisfies Readonly<Record<string, Validator>>

const measurementValidator: Validator = (value, path) => {
  if (!isRecord(value)) return validationError('invalid_field', path)
  if (!Object.prototype.hasOwnProperty.call(value, 'metric')) {
    return validationError('missing_required_field', pathTo(path, 'metric'))
  }
  const metric = value.metric
  if (typeof metric !== 'string' || !(metric in measurementValidators)) {
    return validationError('invalid_field', pathTo(path, 'metric'))
  }
  return measurementValidators[metric as keyof typeof measurementValidators](
    value,
    path,
  )
}

const telemetryValidator = objectOf({
  contextStrength: field(literal('weak')),
  interpretationPolicy: field(
    literal('no_emotion_grief_or_health_inference'),
  ),
  measurements: field(arrayOf(measurementValidator)),
})

const interactionValidator = objectOf({
  type: field(
    oneOf([
      'mark_moment',
      'touch',
      'confirm',
      'dismiss',
      'gesture',
    ] as const),
  ),
})

const audioReferenceContentValidator = objectOf({
  type: field(literal('reference')),
  referenceId: field(nonEmptyString),
  byteLength: field(numberValue({ integer: true, min: 0 })),
})

const audioBytesContentShapeValidator = objectOf({
  type: field(literal('bytes')),
  bytes: field(arrayOf(numberValue({ integer: true, min: 0, max: 255 }))),
  byteLength: field(numberValue({ integer: true, min: 0 })),
})

const audioContentValidator: Validator = (value, path) => {
  if (!isRecord(value)) return validationError('invalid_field', path)
  if (!Object.prototype.hasOwnProperty.call(value, 'type')) {
    return validationError('missing_required_field', pathTo(path, 'type'))
  }

  if (value.type === 'reference') {
    return audioReferenceContentValidator(value, path)
  }
  if (value.type === 'bytes') {
    const shapeError = audioBytesContentShapeValidator(value, path)
    if (shapeError) return shapeError
    const bytes = value.bytes
    if (!Array.isArray(bytes) || value.byteLength !== bytes.length) {
      return validationError('invalid_field', pathTo(path, 'byteLength'))
    }
    return undefined
  }
  return validationError('invalid_field', pathTo(path, 'type'))
}

const audioValidator = objectOf({
  chunkId: field(nonEmptyString),
  codec: field(nonEmptyString),
  sampleRateHz: field(numberValue({ integer: true, min: 1 })),
  channels: field(numberValue({ integer: true, min: 1 })),
  bitDepth: optional(numberValue({ integer: true, min: 1 })),
  frameDurationMs: optional(numberValue({ min: 0 })),
  content: field(audioContentValidator),
})

const statusValidator = objectOf({
  state: field(
    oneOf([
      'connected',
      'disconnected',
      'worn',
      'removed',
      'battery_low',
    ] as const),
  ),
})

const commandValidators = {
  haptic_feedback: objectOf({
    commandId: field(nonEmptyString),
    kind: field(literal('haptic_feedback')),
    issuedAt: field(nonEmptyString),
    pattern: field(oneOf(['acknowledge', 'attention'] as const)),
  }),
  light_feedback: objectOf({
    commandId: field(nonEmptyString),
    kind: field(literal('light_feedback')),
    issuedAt: field(nonEmptyString),
    state: field(oneOf(['off', 'ready', 'active', 'error'] as const)),
  }),
  request_status: objectOf({
    commandId: field(nonEmptyString),
    kind: field(literal('request_status')),
    issuedAt: field(nonEmptyString),
  }),
  request_telemetry: objectOf({
    commandId: field(nonEmptyString),
    kind: field(literal('request_telemetry')),
    issuedAt: field(nonEmptyString),
    category: field(
      oneOf([
        'physiological',
        'motion',
        'environmental',
        'device_status',
      ] as const),
    ),
  }),
} satisfies Readonly<Record<string, Validator>>

const commandValidator: Validator = (value, path) => {
  if (!isRecord(value)) return validationError('invalid_field', path)
  if (!Object.prototype.hasOwnProperty.call(value, 'kind')) {
    return validationError('missing_required_field', pathTo(path, 'kind'))
  }
  const kind = value.kind
  if (typeof kind !== 'string' || !(kind in commandValidators)) {
    return validationError('invalid_field', pathTo(path, 'kind'))
  }
  return commandValidators[kind as keyof typeof commandValidators](value, path)
}

const acknowledgementValidator = objectOf({
  commandId: field(nonEmptyString),
  status: field(oneOf(['accepted', 'completed', 'rejected'] as const)),
  acknowledgedAt: field(nonEmptyString),
  deduplicated: field(oneOf([true, false] as const)),
  reasonCode: optional(oneOf(acknowledgementReasonCodes)),
})

const parseFailureValidator = objectOf({
  fatal: field(literal(false)),
  stage: field(oneOf(parseFailureStages)),
  code: field(oneOf(parseFailureCodes)),
})

function messageRules(kind: ProtocolMessageKind) {
  return {
    schemaVersion: field(literal(protocolSchemaVersion)),
    kind: field(literal(kind)),
    messageId: field(nonEmptyString),
    deviceId: field(nonEmptyString),
    sessionId: field(nonEmptyString),
    source: field(sourceValidator),
    sequence: field(numberValue({ integer: true, min: 1 })),
    deviceTimestamp: field(nullable(nonEmptyString)),
    receivedTimestamp: field(nonEmptyString),
    provenance: field(provenanceValidator),
  }
}

const messageValidators = {
  telemetry: objectOf({
    ...messageRules('telemetry'),
    telemetry: field(telemetryValidator),
  }),
  interaction: objectOf({
    ...messageRules('interaction'),
    interaction: field(interactionValidator),
  }),
  audio_chunk: objectOf({
    ...messageRules('audio_chunk'),
    audio: field(audioValidator),
  }),
  status: objectOf({
    ...messageRules('status'),
    status: field(statusValidator),
  }),
  command: objectOf({
    ...messageRules('command'),
    command: field(commandValidator),
  }),
  acknowledgement: objectOf({
    ...messageRules('acknowledgement'),
    acknowledgement: field(acknowledgementValidator),
  }),
  parse_failure: objectOf({
    ...messageRules('parse_failure'),
    failure: field(parseFailureValidator),
  }),
} satisfies Readonly<Record<ProtocolMessageKind, Validator>>

function validateProtocolMessage(value: unknown): ProtocolResult<ProtocolMessage> {
  if (!isRecord(value)) return failure('invalid_field')
  if (!Object.prototype.hasOwnProperty.call(value, 'schemaVersion')) {
    return failure('missing_required_field', 'schemaVersion')
  }
  if (typeof value.schemaVersion !== 'number') {
    return failure('invalid_field', 'schemaVersion')
  }
  if (!Number.isFinite(value.schemaVersion)) {
    return failure('non_finite_number', 'schemaVersion')
  }
  if (value.schemaVersion !== protocolSchemaVersion) {
    return failure('unsupported_version', 'schemaVersion')
  }

  if (!Object.prototype.hasOwnProperty.call(value, 'kind')) {
    return failure('missing_required_field', 'kind')
  }
  if (
    typeof value.kind !== 'string' ||
    !protocolMessageKinds.includes(value.kind as ProtocolMessageKind)
  ) {
    return failure('unknown_kind', 'kind')
  }

  const error = messageValidators[value.kind as ProtocolMessageKind](value, '')
  if (error) return { ok: false, error }
  return { ok: true, value: value as unknown as ProtocolMessage }
}

type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue }

type CanonicalResult =
  | { ok: true; value: JsonValue }
  | { ok: false }

function canonicalize(
  value: unknown,
  ancestors: WeakSet<object>,
): CanonicalResult {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return { ok: true, value }
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false }
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) return { ok: false }
    ancestors.add(value)
    const output: JsonValue[] = []
    for (const item of value) {
      const result = canonicalize(item, ancestors)
      if (!result.ok) return { ok: false }
      output.push(result.value)
    }
    ancestors.delete(value)
    return { ok: true, value: output }
  }

  if (isRecord(value)) {
    if (ancestors.has(value)) return { ok: false }
    ancestors.add(value)
    const output: { [key: string]: JsonValue } = {}
    for (const key of Object.keys(value).sort()) {
      const result = canonicalize(value[key], ancestors)
      if (!result.ok) return { ok: false }
      output[key] = result.value
    }
    ancestors.delete(value)
    return { ok: true, value: output }
  }

  return { ok: false }
}

function payloadLimit(options?: ProtocolCodecOptions): number {
  const requested = options?.maxPayloadBytes
  if (
    requested === undefined ||
    !Number.isSafeInteger(requested) ||
    requested <= 0
  ) {
    return MAX_PROTOCOL_PAYLOAD_BYTES
  }
  return Math.min(requested, MAX_PROTOCOL_PAYLOAD_BYTES)
}

/** Encode canonical JSON without allowing untrusted values to escape as throws. */
export function encodeProtocolMessage(
  value: unknown,
  options?: ProtocolCodecOptions,
): ProtocolResult<Uint8Array> {
  try {
    const validated = validateProtocolMessage(value)
    if (!validated.ok) return validated

    const canonical = canonicalize(validated.value, new WeakSet())
    if (!canonical.ok) return failure('invalid_field')

    const bytes = new TextEncoder().encode(JSON.stringify(canonical.value))
    if (bytes.byteLength > payloadLimit(options)) {
      return failure('payload_too_large')
    }
    return { ok: true, value: bytes }
  } catch {
    return failure('invalid_field')
  }
}

/** Decode untrusted bytes into a validated V1 message; this function never throws. */
export function decodeProtocolMessage(
  bytes: Uint8Array,
  options?: ProtocolCodecOptions,
): ProtocolResult<ProtocolMessage> {
  try {
    if (!isUint8Array(bytes)) return failure('invalid_field')
    if (bytes.byteLength > payloadLimit(options)) {
      return failure('payload_too_large')
    }

    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return failure('malformed_utf8')
    }

    let value: unknown
    try {
      value = JSON.parse(text) as unknown
    } catch {
      return failure('malformed_json')
    }

    return validateProtocolMessage(value)
  } catch {
    return failure('invalid_field')
  }
}
