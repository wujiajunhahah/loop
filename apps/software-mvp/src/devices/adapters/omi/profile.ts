export interface OmiAudioCodecProfile {
  codec: 'pcm_s16le' | 'pcm_u8' | 'opus'
  sampleRateHz: number
  bitDepth: number
  channels: number
}

export interface OmiAudioProfile {
  profileId: string
  discovery: {
    names: readonly string[]
    namePrefixes?: readonly string[]
  }
  gatt: {
    serviceId: string
    audioDataId: string
    audioCodecId: string
  }
  header: {
    byteLength: 3
    packetSequenceByteOrder: 'little_endian'
  }
  codecs: Readonly<Record<number, OmiAudioCodecProfile>>
  provenance: {
    sourceUrl: string
    sourceReference: string
    discoveryAndHeaderSourceUrl: string
    firmwareCaveat: string
  }
}

export interface OfficialOmiAudioProfileOptions {
  discovery?: OmiAudioProfile['discovery']
  sourceUrl?: string
  sourceReference?: string
  firmwareCaveat?: string
}

const SOURCE_REFERENCE = 'eb35343053ffda69676d13eb88874b576f71f180'
const SOURCE_URL =
  `https://github.com/BasedHardware/omi/blob/${SOURCE_REFERENCE}` +
  '/sdks/device/PROTOCOL.md'
const DOCUMENTATION_URL = 'https://docs.omi.me/doc/developer/Protocol.md'

/**
 * Official values only. Packet sizing remains caller configuration because the
 * cited source explicitly couples framing behavior to firmware and BLE MTU.
 */
export function createOfficialOmiAudioProfile(
  options: OfficialOmiAudioProfileOptions = {},
): OmiAudioProfile {
  return {
    profileId: 'omi-audio-official-eb353430',
    discovery: {
      names: [...(options.discovery?.names ?? ['Omi'])],
      ...(options.discovery?.namePrefixes === undefined
        ? {}
        : { namePrefixes: [...options.discovery.namePrefixes] }),
    },
    gatt: {
      serviceId: '19b10000-e8f2-537e-4f6c-d104768a1214',
      audioDataId: '19b10001-e8f2-537e-4f6c-d104768a1214',
      audioCodecId: '19b10002-e8f2-537e-4f6c-d104768a1214',
    },
    header: {
      byteLength: 3,
      packetSequenceByteOrder: 'little_endian',
    },
    codecs: {
      0: {
        codec: 'pcm_s16le',
        sampleRateHz: 16_000,
        bitDepth: 16,
        channels: 1,
      },
      1: {
        codec: 'pcm_u8',
        sampleRateHz: 16_000,
        bitDepth: 8,
        channels: 1,
      },
      20: {
        codec: 'opus',
        sampleRateHz: 16_000,
        bitDepth: 16,
        channels: 1,
      },
    },
    provenance: {
      sourceUrl: options.sourceUrl ?? SOURCE_URL,
      sourceReference: options.sourceReference ?? SOURCE_REFERENCE,
      discoveryAndHeaderSourceUrl: DOCUMENTATION_URL,
      firmwareCaveat:
        options.firmwareCaveat ??
        'Header size and codec map are firmware-coupled; physical-device validation is required.',
    },
  }
}

export const OFFICIAL_OMI_AUDIO_PROFILE = createOfficialOmiAudioProfile()
