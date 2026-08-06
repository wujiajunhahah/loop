import type { DeviceTransportReceiveSource } from '../../contracts'
import type { RingRole } from './profile'

export interface RingFrameParserInput {
  bytes: Uint8Array
  transportSequence: number
  receivedAt: string
  source: DeviceTransportReceiveSource
}

export interface RingMetricFrame {
  kind: 'metric'
  metric: {
    role: RingRole
    name: string
    value?: number | readonly number[] | string | boolean
    unit?: string
    fields?: Readonly<Record<string, number>>
    privacy: 'normalized' | 'local_only'
    exportConsentRequired: boolean
  }
}

export interface RingStatusFrame {
  kind: 'status'
  status: string
  role: RingRole
}

export interface RingHistoryFrame {
  kind: 'history'
  role: RingRole
  record: Readonly<Record<string, number | string | boolean>>
}

export type RingParsedFrame = RingMetricFrame | RingStatusFrame | RingHistoryFrame

export const ringParseFailureCodes = [
  'empty_input',
  'frame_too_short',
  'frame_too_long',
  'field_out_of_bounds',
  'value_out_of_bounds',
  'checksum_mismatch',
  'invalid_parser_config',
] as const

export type RingParseFailureCode = (typeof ringParseFailureCodes)[number]

export interface RingParseFailure {
  code: RingParseFailureCode
  message: string
  retryable: boolean
}

export type RingFrameParserOutcome =
  | { ok: true; value: RingParsedFrame }
  | { ok: false; failure: RingParseFailure }

export type RingFrameParser = (
  input: RingFrameParserInput,
) => RingFrameParserOutcome

export interface RingFrameField {
  name: string
  offset: number
  byteLength: number
  signed: boolean
  endianness: 'little_endian' | 'big_endian'
  scale?: number
  offsetValue?: number
  min?: number
  max?: number
  unit?: string
}

export interface RingChecksumRule {
  offset: number
  byteLength: number
  endianness: 'little_endian' | 'big_endian'
  calculate(bytes: Uint8Array): number
}

export interface RingFrameRules {
  minimumBytes?: number
  maximumBytes?: number
  fields: readonly RingFrameField[]
  checksum?: RingChecksumRule
}

export interface RingMetricParserOutput {
  kind: 'metric'
  name: string
  valueField: string
  unit?: string
  privacy?: 'normalized' | 'local_only'
}

export interface RingFrameParserOptions {
  role: RingRole
  rules: RingFrameRules
  output: RingMetricParserOutput
}

const failureMessages: Record<RingParseFailureCode, string> = {
  empty_input: 'The ring frame is empty.',
  frame_too_short: 'The ring frame is shorter than the configured layout.',
  frame_too_long: 'The ring frame is longer than the configured layout.',
  field_out_of_bounds: 'The configured ring field is outside the frame.',
  value_out_of_bounds: 'The ring frame value is outside the configured bounds.',
  checksum_mismatch: 'The ring frame checksum is invalid.',
  invalid_parser_config: 'The configured ring parser is invalid.',
}

function failure(
  code: RingParseFailureCode,
  retryable: boolean,
): RingFrameParserOutcome {
  return {
    ok: false,
    failure: {
      code,
      message: failureMessages[code],
      retryable,
    },
  }
}

function isIntegerInRange(value: number, minimum: number, maximum: number) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
}

function validateByteRange(offset: number, byteLength: number): boolean {
  return (
    isIntegerInRange(offset, 0, Number.MAX_SAFE_INTEGER) &&
    isIntegerInRange(byteLength, 1, 4)
  )
}

function readUnsigned(
  bytes: Uint8Array,
  offset: number,
  byteLength: number,
  endianness: RingFrameField['endianness'],
): number {
  let value = 0
  if (endianness === 'little_endian') {
    for (let index = 0; index < byteLength; index += 1) {
      value += (bytes[offset + index] ?? 0) * 2 ** (8 * index)
    }
  } else {
    for (let index = 0; index < byteLength; index += 1) {
      value = value * 256 + (bytes[offset + index] ?? 0)
    }
  }
  return value
}

function readNumber(
  bytes: Uint8Array,
  field: RingFrameField,
): number {
  const unsigned = readUnsigned(
    bytes,
    field.offset,
    field.byteLength,
    field.endianness,
  )
  const bits = field.byteLength * 8
  const signed = field.signed && unsigned >= 2 ** (bits - 1)
  const raw = signed ? unsigned - 2 ** bits : unsigned
  return raw * (field.scale ?? 1) + (field.offsetValue ?? 0)
}

function validateRules(
  rules: RingFrameRules,
  output: RingMetricParserOutput,
): RingParseFailureCode | undefined {
  if (rules.fields.length === 0) return 'invalid_parser_config'
  if (rules.minimumBytes !== undefined && !isIntegerInRange(rules.minimumBytes, 0, Number.MAX_SAFE_INTEGER)) {
    return 'invalid_parser_config'
  }
  if (rules.maximumBytes !== undefined && !isIntegerInRange(rules.maximumBytes, 0, Number.MAX_SAFE_INTEGER)) {
    return 'invalid_parser_config'
  }
  if (
    rules.minimumBytes !== undefined &&
    rules.maximumBytes !== undefined &&
    rules.minimumBytes > rules.maximumBytes
  ) {
    return 'invalid_parser_config'
  }
  if (!rules.fields.some((field) => field.name === output.valueField)) {
    return 'invalid_parser_config'
  }

  for (const field of rules.fields) {
    if (!validateByteRange(field.offset, field.byteLength)) {
      return 'invalid_parser_config'
    }
    if (
      (field.scale !== undefined && !Number.isFinite(field.scale)) ||
      (field.offsetValue !== undefined && !Number.isFinite(field.offsetValue)) ||
      (field.min !== undefined && !Number.isFinite(field.min)) ||
      (field.max !== undefined && !Number.isFinite(field.max)) ||
      (field.min !== undefined &&
        field.max !== undefined &&
        field.min > field.max)
    ) {
      return 'invalid_parser_config'
    }
  }
  if (rules.checksum !== undefined && !validateByteRange(rules.checksum.offset, rules.checksum.byteLength)) {
    return 'invalid_parser_config'
  }
  return undefined
}

export function createRingFrameParser(
  options: RingFrameParserOptions,
): RingFrameParser {
  const configurationError = validateRules(options.rules, options.output)
  const requiredBytes = Math.max(
    ...options.rules.fields.map((field) => field.offset + field.byteLength),
    options.rules.checksum === undefined
      ? 0
      : options.rules.checksum.offset + options.rules.checksum.byteLength,
    options.rules.minimumBytes ?? 0,
  )

  return (input) => {
    if (configurationError !== undefined) {
      return failure(configurationError, false)
    }
    if (input.bytes.byteLength === 0) return failure('empty_input', true)
    if (input.bytes.byteLength < requiredBytes) {
      return failure('frame_too_short', false)
    }
    if (
      options.rules.maximumBytes !== undefined &&
      input.bytes.byteLength > options.rules.maximumBytes
    ) {
      return failure('frame_too_long', false)
    }

    for (const field of options.rules.fields) {
      const end = field.offset + field.byteLength
      if (end > input.bytes.byteLength) {
        return failure('field_out_of_bounds', false)
      }
    }

    if (options.rules.checksum !== undefined) {
      const checksum = options.rules.checksum
      const expected = readUnsigned(
        input.bytes,
        checksum.offset,
        checksum.byteLength,
        checksum.endianness,
      )
      let calculated: number
      try {
        calculated = checksum.calculate(new Uint8Array(input.bytes))
      } catch {
        return failure('checksum_mismatch', false)
      }
      if (!Number.isSafeInteger(calculated) || calculated !== expected) {
        return failure('checksum_mismatch', false)
      }
    }

    const fields: Record<string, number> = {}
    for (const field of options.rules.fields) {
      const value = readNumber(input.bytes, field)
      if (
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max)
      ) {
        return failure('value_out_of_bounds', false)
      }
      fields[field.name] = value
    }

    const value = fields[options.output.valueField]
    const valueField = options.rules.fields.find(
      (field) => field.name === options.output.valueField,
    )
    const privacy =
      options.role === 'ppg' || options.role === 'accelerometer'
        ? 'local_only'
        : (options.output.privacy ?? 'normalized')
    return {
      ok: true,
      value: {
        kind: 'metric',
        metric: {
          role: options.role,
          name: options.output.name,
          value,
          ...(options.output.unit === undefined && valueField?.unit === undefined
            ? {}
            : { unit: options.output.unit ?? valueField?.unit }),
          fields,
          privacy,
          exportConsentRequired: privacy === 'local_only',
        },
      },
    }
  }
}
