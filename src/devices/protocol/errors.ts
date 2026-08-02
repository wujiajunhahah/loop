export const protocolErrorCodes = [
  'payload_too_large',
  'malformed_utf8',
  'malformed_json',
  'unsupported_version',
  'unknown_kind',
  'missing_required_field',
  'invalid_field',
  'non_finite_number',
] as const

export type ProtocolErrorCode = (typeof protocolErrorCodes)[number]

export interface ProtocolError {
  code: ProtocolErrorCode
  /** Fixed, redacted text that never includes source payload values. */
  message: string
  /** Schema-owned path only; unknown input keys and values are never returned. */
  field?: string
}

export type ProtocolResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProtocolError }
