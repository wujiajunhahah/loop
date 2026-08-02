import { describe, expect, it } from 'vitest'
import {
  MAX_PROTOCOL_PAYLOAD_BYTES,
  decodeProtocolMessage,
  encodeProtocolMessage,
  protocolMessageKinds,
  protocolSchemaVersion,
  type ProtocolMessage,
  type ProtocolResult,
} from '.'
import {
  acknowledgementFixture,
  audioBytesFixture,
  audioReferenceFixture,
  commandFixture,
  interactionFixture,
  parseFailureFixture,
  statusFixture,
  telemetryFixture,
} from './fixtures/v1'

const textEncoder = new TextEncoder()

function jsonBytes(value: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(value))
}

function resultValue<T>(result: ProtocolResult<T>): T {
  if (!result.ok) {
    throw new Error(
      `Expected protocol success, received ${result.error.code}:${result.error.field ?? 'message'}`,
    )
  }
  expect(result.ok).toBe(true)
  return result.value
}

function resultError<T>(result: ProtocolResult<T>) {
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('Expected a protocol error')
  return result.error
}

describe('protocol v1 messages', () => {
  it('round-trips schema version 1 with deterministic UTF-8 JSON bytes', () => {
    const reordered: ProtocolMessage = {
      telemetry: telemetryFixture.telemetry,
      provenance: telemetryFixture.provenance,
      receivedTimestamp: telemetryFixture.receivedTimestamp,
      deviceTimestamp: telemetryFixture.deviceTimestamp,
      sequence: telemetryFixture.sequence,
      source: telemetryFixture.source,
      sessionId: telemetryFixture.sessionId,
      deviceId: telemetryFixture.deviceId,
      messageId: telemetryFixture.messageId,
      kind: telemetryFixture.kind,
      schemaVersion: telemetryFixture.schemaVersion,
    }

    const encoded = resultValue(encodeProtocolMessage(telemetryFixture))
    const reorderedEncoded = resultValue(encodeProtocolMessage(reordered))

    expect(protocolSchemaVersion).toBe(1)
    expect(encoded).toEqual(reorderedEncoded)
    expect(resultValue(decodeProtocolMessage(encoded))).toEqual(telemetryFixture)
  })

  it('supports every message kind without vendor UUID or opcode assumptions', () => {
    const messages: readonly ProtocolMessage[] = [
      telemetryFixture,
      interactionFixture,
      audioReferenceFixture,
      audioBytesFixture,
      statusFixture,
      commandFixture,
      acknowledgementFixture,
      parseFailureFixture,
    ]

    expect(protocolMessageKinds).toEqual([
      'telemetry',
      'interaction',
      'audio_chunk',
      'status',
      'command',
      'acknowledgement',
      'parse_failure',
    ])
    for (const message of messages) {
      const decoded = resultValue(
        decodeProtocolMessage(resultValue(encodeProtocolMessage(message))),
      )
      expect(decoded).toEqual(message)
    }

    expect(telemetryFixture.provenance.rawFrame).toEqual({
      referenceId: 'raw-frame-1',
      byteLength: 24,
      characteristic: {
        serviceId: 'fixture-service-reference',
        characteristicId: 'fixture-characteristic-reference',
      },
    })
    expect(telemetryFixture.provenance.rawFrame).not.toHaveProperty('payload')
    expect(commandFixture.command).not.toHaveProperty('opcode')
  })

  it('retains every optional metric as weak context with record-level provenance', () => {
    const decoded = resultValue(
      decodeProtocolMessage(
        resultValue(encodeProtocolMessage(telemetryFixture)),
      ),
    )
    expect(decoded.kind).toBe('telemetry')
    if (decoded.kind !== 'telemetry') return

    expect(decoded.telemetry.contextStrength).toBe('weak')
    expect(decoded.telemetry.interpretationPolicy).toBe(
      'no_emotion_grief_or_health_inference',
    )
    expect(
      decoded.telemetry.measurements.map((measurement) => measurement.metric),
    ).toEqual([
      'heart_rate',
      'rr_interval',
      'spo2',
      'temperature',
      'steps',
      'activity',
      'accelerometer',
      'battery',
      'wear_state',
    ])

    for (const measurement of decoded.telemetry.measurements) {
      expect(measurement.unit).toBeTruthy()
      expect(measurement.deviceTimestamp).toBe(
        '2026-08-02T09:01:00.000Z',
      )
      expect(measurement.receivedTimestamp).toBe(
        '2026-08-02T09:01:00.125Z',
      )
      expect(measurement.source).toBe('physical')
      expect(measurement.provenance.adapterId).toBe('fixture-ring-adapter')
      expect(measurement.provenance.rawFrame).not.toHaveProperty('payload')
    }
    expect(decoded.telemetry.measurements[2]).not.toHaveProperty('quality')
    expect(decoded.telemetry).not.toHaveProperty('emotion')
    expect(decoded.telemetry).not.toHaveProperty('diagnosis')
    expect(decoded.telemetry).not.toHaveProperty('intervention')
  })

  it('makes command retries and acknowledgement deduplication explicit', () => {
    const retry: ProtocolMessage = {
      ...commandFixture,
      messageId: 'message-command-retry-1',
      sequence: commandFixture.sequence + 1,
    }

    expect(retry.kind).toBe('command')
    if (retry.kind !== 'command') return
    expect(retry.command.commandId).toBe(commandFixture.command.commandId)
    expect(acknowledgementFixture.acknowledgement.commandId).toBe(
      retry.command.commandId,
    )
    expect(acknowledgementFixture.acknowledgement.status).toBe('completed')
    expect(acknowledgementFixture.acknowledgement.deduplicated).toBe(true)
  })

  it('keeps parse failures non-fatal and isolated from subsequent messages', () => {
    const failedFrame = resultValue(
      decodeProtocolMessage(
        resultValue(encodeProtocolMessage(parseFailureFixture)),
      ),
    )
    const nextFrame = resultValue(
      decodeProtocolMessage(
        resultValue(encodeProtocolMessage(interactionFixture)),
      ),
    )

    expect(failedFrame).toMatchObject({
      kind: 'parse_failure',
      sessionId: 'device-session-1',
      sequence: 8,
      source: 'physical',
      failure: {
        fatal: false,
        stage: 'framing',
        code: 'invalid_length',
      },
    })
    expect(failedFrame).not.toHaveProperty('rawBytes')
    expect(nextFrame.kind).toBe('interaction')
  })
})

describe('protocol v1 rejection boundaries', () => {
  it('rejects malformed UTF-8 and JSON without throwing or echoing input', () => {
    const malformedUtf8 = new Uint8Array([0xc3, 0x28])
    const rawAudioMarker = 'RAW_AUDIO_DO_NOT_ECHO'
    const malformedJson = textEncoder.encode(
      `{"kind":"audio_chunk","audio":"${rawAudioMarker}"`,
    )

    expect(() => decodeProtocolMessage(malformedUtf8)).not.toThrow()
    expect(resultError(decodeProtocolMessage(malformedUtf8))).toEqual({
      code: 'malformed_utf8',
      message: 'Payload is not valid UTF-8.',
    })

    const jsonError = resultError(decodeProtocolMessage(malformedJson))
    expect(jsonError).toEqual({
      code: 'malformed_json',
      message: 'Payload is not valid JSON.',
    })
    expect(JSON.stringify(jsonError)).not.toContain(rawAudioMarker)
  })

  it('rejects unknown schema versions and message kinds', () => {
    expect(
      resultError(
        decodeProtocolMessage(
          jsonBytes({ ...interactionFixture, schemaVersion: 2 }),
        ),
      ),
    ).toEqual({
      code: 'unsupported_version',
      message: 'Protocol schema version is not supported.',
      field: 'schemaVersion',
    })
    expect(
      resultError(
        decodeProtocolMessage(
          jsonBytes({ ...interactionFixture, kind: 'vendor_packet' }),
        ),
      ),
    ).toEqual({
      code: 'unknown_kind',
      message: 'Protocol message kind is not supported.',
      field: 'kind',
    })
  })

  it('rejects missing fields, unsafe sequences, and malformed lengths', () => {
    const { receivedTimestamp: _receivedTimestamp, ...missingTimestamp } =
      interactionFixture
    const malformedAudioLength = {
      ...audioBytesFixture,
      audio: {
        ...audioBytesFixture.audio,
        content: {
          type: 'bytes',
          bytes: [1, 2, 3, 4],
          byteLength: 3,
        },
      },
    }

    expect(
      resultError(decodeProtocolMessage(jsonBytes(missingTimestamp))),
    ).toEqual({
      code: 'missing_required_field',
      message: 'Protocol message is missing a required field.',
      field: 'receivedTimestamp',
    })
    expect(
      resultError(
        decodeProtocolMessage(
          jsonBytes({ ...interactionFixture, sequence: 0 }),
        ),
      ),
    ).toEqual({
      code: 'invalid_field',
      message: 'Protocol message contains an invalid field.',
      field: 'sequence',
    })
    expect(
      resultError(decodeProtocolMessage(jsonBytes(malformedAudioLength))),
    ).toEqual({
      code: 'invalid_field',
      message: 'Protocol message contains an invalid field.',
      field: 'audio.content.byteLength',
    })
  })

  it('rejects non-finite numbers before JSON encoding', () => {
    const invalidAudio = {
      ...audioBytesFixture,
      audio: {
        ...audioBytesFixture.audio,
        sampleRateHz: Number.NaN,
      },
    }

    expect(() => encodeProtocolMessage(invalidAudio)).not.toThrow()
    expect(resultError(encodeProtocolMessage(invalidAudio))).toEqual({
      code: 'non_finite_number',
      message: 'Protocol numbers must be finite.',
      field: 'audio.sampleRateHz',
    })
  })

  it('rejects payloads over the hard maximum or a stricter caller limit', () => {
    const oversized = new Uint8Array(MAX_PROTOCOL_PAYLOAD_BYTES + 1)

    expect(resultError(decodeProtocolMessage(oversized))).toEqual({
      code: 'payload_too_large',
      message: 'Protocol payload exceeds the allowed size.',
    })
    expect(
      resultError(
        encodeProtocolMessage(telemetryFixture, { maxPayloadBytes: 32 }),
      ),
    ).toEqual({
      code: 'payload_too_large',
      message: 'Protocol payload exceeds the allowed size.',
    })
  })

  it('rejects raw-frame payload fields and invalid audio bytes without leaking them', () => {
    const rawMarker = 'PHYSIOLOGICAL_FRAME_DO_NOT_ECHO'
    const frameWithPayload = {
      ...telemetryFixture,
      provenance: {
        ...telemetryFixture.provenance,
        rawFrame: {
          ...telemetryFixture.provenance.rawFrame,
          payload: rawMarker,
        },
      },
    }
    const audioWithInvalidByte = {
      ...audioBytesFixture,
      audio: {
        ...audioBytesFixture.audio,
        content: {
          type: 'bytes',
          bytes: [1, 2, 999],
          byteLength: 3,
        },
      },
    }

    const frameError = resultError(encodeProtocolMessage(frameWithPayload))
    const audioError = resultError(encodeProtocolMessage(audioWithInvalidByte))

    expect(frameError.code).toBe('invalid_field')
    expect(audioError).toEqual({
      code: 'invalid_field',
      message: 'Protocol message contains an invalid field.',
      field: 'audio.content.bytes[2]',
    })
    expect(JSON.stringify(frameError)).not.toContain(rawMarker)
    expect(JSON.stringify(audioError)).not.toContain('999')
  })
})
