export const OMI_AUDIO_FIXTURE_PROVENANCE = {
  sourceUrl:
    'https://github.com/BasedHardware/omi/blob/eb35343053ffda69676d13eb88874b576f71f180/sdks/device/PROTOCOL.md',
  sourceReference: 'eb35343053ffda69676d13eb88874b576f71f180',
  deviceModel: 'Omi protocol-derived synthetic fixture; no physical device',
  firmware: 'unspecified; the official header is firmware-coupled',
  transportAssumption:
    'Synthetic byte stream with explicit per-index payload lengths; no MTU claim',
} as const

export function omiAudioFrame(
  packetSequence: number,
  fragmentIndex: number,
  payload: readonly number[],
): Uint8Array {
  return new Uint8Array([
    packetSequence & 0xff,
    (packetSequence >>> 8) & 0xff,
    fragmentIndex,
    ...payload,
  ])
}

export const OMI_COMPLETE_FRAME = omiAudioFrame(0x1234, 0, [
  0x11, 0x22, 0x33, 0x44,
])

export const OMI_FRAGMENTED_PACKET = {
  first: omiAudioFrame(0x1235, 0, [0x51, 0x52, 0x53, 0x54]),
  second: omiAudioFrame(0x1235, 1, [0x55, 0x56]),
} as const
