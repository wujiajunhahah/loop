import type {
  AcknowledgementProtocolMessage,
  AudioChunkProtocolMessage,
  InteractionProtocolMessage,
  ParseFailureProtocolMessage,
  ProtocolEnvelopeBase,
  StatusProtocolMessage,
  TelemetryProtocolMessage,
  CommandProtocolMessage,
} from '../types'

export const baseEnvelopeFixture: Omit<ProtocolEnvelopeBase, 'kind'> = {
  schemaVersion: 1,
  messageId: 'message-telemetry-1',
  deviceId: 'device-ring-1',
  sessionId: 'device-session-1',
  source: 'physical',
  sequence: 1,
  deviceTimestamp: '2026-08-02T09:01:00.000Z',
  receivedTimestamp: '2026-08-02T09:01:00.125Z',
  provenance: {
    adapterId: 'fixture-ring-adapter',
    transportId: 'fixture-transport',
    transportSessionId: 'transport-session-1',
    profileId: 'reviewed-fixture-profile',
    firmwareVersion: 'fixture-firmware',
    rawFrame: {
      referenceId: 'raw-frame-1',
      byteLength: 24,
      characteristic: {
        serviceId: 'fixture-service-reference',
        characteristicId: 'fixture-characteristic-reference',
      },
    },
  },
}

const measurementContext = {
  deviceTimestamp: '2026-08-02T09:01:00.000Z',
  receivedTimestamp: '2026-08-02T09:01:00.125Z',
  source: 'physical' as const,
  provenance: {
    adapterId: 'fixture-ring-adapter',
    rawFrame: {
      referenceId: 'raw-frame-1',
      byteLength: 24,
    },
  },
}

export const telemetryFixture: TelemetryProtocolMessage = {
  ...baseEnvelopeFixture,
  kind: 'telemetry',
  telemetry: {
    contextStrength: 'weak',
    interpretationPolicy: 'no_emotion_grief_or_health_inference',
    measurements: [
      {
        ...measurementContext,
        metric: 'heart_rate',
        value: 72,
        unit: 'beats_per_minute',
        quality: 'high',
      },
      {
        ...measurementContext,
        metric: 'rr_interval',
        values: [810, 825, 804],
        unit: 'milliseconds',
        quality: 'medium',
      },
      {
        ...measurementContext,
        metric: 'spo2',
        value: 98,
        unit: 'percent',
      },
      {
        ...measurementContext,
        metric: 'temperature',
        value: 36.5,
        unit: 'celsius',
        quality: 'medium',
      },
      {
        ...measurementContext,
        metric: 'steps',
        value: 1200,
        unit: 'count',
      },
      {
        ...measurementContext,
        metric: 'activity',
        value: 300,
        unit: 'seconds',
      },
      {
        ...measurementContext,
        metric: 'accelerometer',
        values: { x: 0.1, y: -0.2, z: 0.98 },
        unit: 'g',
        quality: 'low',
      },
      {
        ...measurementContext,
        metric: 'battery',
        value: 84,
        unit: 'percent',
      },
      {
        ...measurementContext,
        metric: 'wear_state',
        value: 1,
        unit: 'boolean',
      },
    ],
  },
}

export const interactionFixture: InteractionProtocolMessage = {
  ...baseEnvelopeFixture,
  messageId: 'message-interaction-1',
  sequence: 2,
  kind: 'interaction',
  interaction: { type: 'touch' },
}

export const audioReferenceFixture: AudioChunkProtocolMessage = {
  ...baseEnvelopeFixture,
  messageId: 'message-audio-reference-1',
  sequence: 3,
  kind: 'audio_chunk',
  audio: {
    chunkId: 'audio-chunk-1',
    codec: 'configured-codec',
    sampleRateHz: 16_000,
    channels: 1,
    bitDepth: 16,
    content: {
      type: 'reference',
      referenceId: 'media-reference-1',
      byteLength: 960,
    },
  },
}

export const audioBytesFixture: AudioChunkProtocolMessage = {
  ...baseEnvelopeFixture,
  messageId: 'message-audio-bytes-1',
  sequence: 4,
  kind: 'audio_chunk',
  audio: {
    chunkId: 'audio-chunk-2',
    codec: 'configured-codec',
    sampleRateHz: 16_000,
    channels: 1,
    content: {
      type: 'bytes',
      bytes: [1, 2, 3, 4],
      byteLength: 4,
    },
  },
}

export const statusFixture: StatusProtocolMessage = {
  ...baseEnvelopeFixture,
  messageId: 'message-status-1',
  sequence: 5,
  kind: 'status',
  status: { state: 'connected' },
}

export const commandFixture: CommandProtocolMessage = {
  ...baseEnvelopeFixture,
  messageId: 'message-command-1',
  sequence: 6,
  kind: 'command',
  command: {
    commandId: 'command-1',
    kind: 'request_status',
    issuedAt: '2026-08-02T09:01:01.000Z',
  },
}

export const acknowledgementFixture: AcknowledgementProtocolMessage = {
  ...baseEnvelopeFixture,
  messageId: 'message-acknowledgement-1',
  sequence: 7,
  kind: 'acknowledgement',
  acknowledgement: {
    commandId: 'command-1',
    status: 'completed',
    acknowledgedAt: '2026-08-02T09:01:01.125Z',
    deduplicated: true,
  },
}

export const parseFailureFixture: ParseFailureProtocolMessage = {
  ...baseEnvelopeFixture,
  messageId: 'message-parse-failure-1',
  sequence: 8,
  kind: 'parse_failure',
  failure: {
    fatal: false,
    stage: 'framing',
    code: 'invalid_length',
  },
}
