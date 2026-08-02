import type { DeviceTransportReceiveSource } from '../../contracts'
import type { OmiAudioCodecProfile, OmiAudioProfile } from './profile'

export interface OmiFirmwareProvenance {
  model: string
  version: string
  validation: 'fixture_only' | 'physical_device'
}

export interface OmiAudioFramingConfiguration {
  /** Exact payload bytes after the official 3-byte header for each index. */
  payloadBytesByFragmentIndex: Readonly<Record<number, number>>
}

export interface OmiAudioParserInput {
  bytes: Uint8Array
  transportSequence: number
  receivedAt: string
  source: DeviceTransportReceiveSource
}

export interface OmiAudioChunkMetadata {
  codec: OmiAudioCodecProfile['codec']
  sampleRateHz: number
  bitDepth: number
  channelCount: number
  transportSequence: number
  sessionSequence: number
  packetSequence: number
  fragmentIndex: number
  receivedAt: string
  source: DeviceTransportReceiveSource
  provenance: {
    profileId: string
    sourceUrl: string
    sourceReference: string
    firmwareCaveat: string
    firmware: OmiFirmwareProvenance
  }
}

export const omiAudioParseFailureCodes = [
  'empty_input',
  'incomplete_frame',
  'invalid_fragment_layout',
  'unknown_codec',
  'fragment_discontinuity',
] as const

export type OmiAudioParseFailureCode =
  (typeof omiAudioParseFailureCodes)[number]

export interface OmiAudioParseFailure {
  code: OmiAudioParseFailureCode
  message: string
  retryable: boolean
  transportSequence?: number
  receivedAt?: string
  source?: DeviceTransportReceiveSource
}

export interface OmiParsedAudioFrame {
  ok: true
  metadata: OmiAudioChunkMetadata
  /** Adapter-private bytes; normalized events never expose this field. */
  payload: Uint8Array
}

export interface OmiAudioParserFailure {
  ok: false
  failure: OmiAudioParseFailure
}

export type OmiAudioParserOutcome =
  | OmiParsedAudioFrame
  | OmiAudioParserFailure

export interface OmiAudioStreamParser {
  push(input: OmiAudioParserInput): readonly OmiAudioParserOutcome[]
  finish(): readonly OmiAudioParserOutcome[]
}

export interface OmiAudioStreamParserOptions {
  codecId: number
  framing: OmiAudioFramingConfiguration
  profile: OmiAudioProfile
  firmware: OmiFirmwareProvenance
}

interface PreviousHeader {
  packetSequence: number
  fragmentIndex: number
}

const failureMessages: Record<OmiAudioParseFailureCode, string> = {
  empty_input: 'The audio stream supplied an empty input chunk.',
  incomplete_frame: 'The audio stream ended with an incomplete frame.',
  invalid_fragment_layout:
    'The configured profile cannot determine this frame boundary.',
  unknown_codec: 'The configured profile does not support the audio codec.',
  fragment_discontinuity: 'The audio fragment sequence is discontinuous.',
}

function failure(
  code: OmiAudioParseFailureCode,
  retryable: boolean,
  input?: Omit<OmiAudioParserInput, 'bytes'>,
): OmiAudioParserFailure {
  return {
    ok: false,
    failure: {
      code,
      message: failureMessages[code],
      retryable,
      ...(input === undefined ? {} : input),
    },
  }
}

function appendBytes(
  current: Uint8Array,
  next: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const appended = new Uint8Array(current.byteLength + next.byteLength)
  appended.set(current)
  appended.set(next, current.byteLength)
  return appended
}

function isDiscontinuous(
  previous: PreviousHeader | undefined,
  packetSequence: number,
  fragmentIndex: number,
): boolean {
  if (previous === undefined) return false
  if (packetSequence === previous.packetSequence) {
    return fragmentIndex !== previous.fragmentIndex + 1
  }
  const expectedPacket = (previous.packetSequence + 1) & 0xffff
  return packetSequence !== expectedPacket || fragmentIndex !== 0
}

export function createOmiAudioStreamParser(
  options: OmiAudioStreamParserOptions,
): OmiAudioStreamParser {
  let pending = new Uint8Array()
  let latestInput: Omit<OmiAudioParserInput, 'bytes'> | undefined
  let previousHeader: PreviousHeader | undefined
  let sessionSequence = 0

  return {
    push(input) {
      const inputMetadata = {
        transportSequence: input.transportSequence,
        receivedAt: input.receivedAt,
        source: input.source,
      }
      if (input.bytes.byteLength === 0) {
        return [failure('empty_input', true, inputMetadata)]
      }

      pending = appendBytes(pending, input.bytes)
      latestInput = inputMetadata
      const outcomes: OmiAudioParserOutcome[] = []

      while (pending.byteLength >= options.profile.header.byteLength) {
        const fragmentIndex = pending[2]
        const payloadBytes =
          options.framing.payloadBytesByFragmentIndex[fragmentIndex]
        if (!Number.isSafeInteger(payloadBytes) || payloadBytes <= 0) {
          pending = new Uint8Array()
          outcomes.push(
            failure('invalid_fragment_layout', false, inputMetadata),
          )
          break
        }

        const frameBytes = options.profile.header.byteLength + payloadBytes
        if (pending.byteLength < frameBytes) break

        const frame = pending.slice(0, frameBytes)
        pending = pending.slice(frameBytes)
        const packetSequence = frame[0] | (frame[1] << 8)
        if (isDiscontinuous(previousHeader, packetSequence, fragmentIndex)) {
          outcomes.push(
            failure('fragment_discontinuity', true, inputMetadata),
          )
        }
        previousHeader = { packetSequence, fragmentIndex }

        const codec = options.profile.codecs[options.codecId]
        if (codec === undefined) {
          outcomes.push(failure('unknown_codec', false, inputMetadata))
          continue
        }

        sessionSequence += 1
        outcomes.push({
          ok: true,
          metadata: {
            codec: codec.codec,
            sampleRateHz: codec.sampleRateHz,
            bitDepth: codec.bitDepth,
            channelCount: codec.channels,
            transportSequence: input.transportSequence,
            sessionSequence,
            packetSequence,
            fragmentIndex,
            receivedAt: input.receivedAt,
            source: input.source,
            provenance: {
              profileId: options.profile.profileId,
              sourceUrl: options.profile.provenance.sourceUrl,
              sourceReference: options.profile.provenance.sourceReference,
              firmwareCaveat: options.profile.provenance.firmwareCaveat,
              firmware: { ...options.firmware },
            },
          },
          payload: frame.slice(options.profile.header.byteLength),
        })
      }

      return outcomes
    },
    finish() {
      if (pending.byteLength === 0) return []
      pending = new Uint8Array()
      return [failure('incomplete_frame', true, latestInput)]
    },
  }
}
