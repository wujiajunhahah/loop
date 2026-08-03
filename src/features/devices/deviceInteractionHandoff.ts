export type DeviceInteractionPurpose = 'creator_capture' | 'recipient_entry'

export interface VerifiedDeviceInteractionHandoff {
  version: 1
  purpose: DeviceInteractionPurpose
  eventId: string
  interaction: 'mark_moment' | 'touch'
  deviceId: string
  deviceName: string
  source: 'physical' | 'simulated'
  occurredAt: string
  verification: 'binding_verified' | 'entrustment_verified'
  recipientId?: string
}

const STORAGE_KEY = 'loop:verified-device-interaction:v1'
let memoryValue: VerifiedDeviceInteractionHandoff | undefined

function storage() {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

function isHandoff(value: unknown): value is VerifiedDeviceInteractionHandoff {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<VerifiedDeviceInteractionHandoff>
  return candidate.version === 1 &&
    (candidate.purpose === 'creator_capture' || candidate.purpose === 'recipient_entry') &&
    typeof candidate.eventId === 'string' && candidate.eventId.length > 0 &&
    (candidate.interaction === 'mark_moment' || candidate.interaction === 'touch') &&
    typeof candidate.deviceId === 'string' && candidate.deviceId.length > 0 &&
    typeof candidate.deviceName === 'string' && candidate.deviceName.length > 0 &&
    (candidate.source === 'physical' || candidate.source === 'simulated') &&
    typeof candidate.occurredAt === 'string' &&
    (candidate.verification === 'binding_verified' ||
      candidate.verification === 'entrustment_verified')
}

export function writeDeviceInteractionHandoff(
  handoff: VerifiedDeviceInteractionHandoff,
) {
  memoryValue = { ...handoff }
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(handoff))
  } catch {
    // Navigation in the current document can still use the in-memory value.
  }
}

export function readDeviceInteractionHandoff(
  purpose?: DeviceInteractionPurpose,
) {
  if (memoryValue !== undefined) {
    return purpose === undefined || memoryValue.purpose === purpose
      ? { ...memoryValue }
      : undefined
  }
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (raw === null || raw === undefined) return undefined
    const candidate: unknown = JSON.parse(raw)
    if (!isHandoff(candidate)) {
      storage()?.removeItem(STORAGE_KEY)
      return undefined
    }
    memoryValue = candidate
    return purpose === undefined || candidate.purpose === purpose
      ? { ...candidate }
      : undefined
  } catch {
    return undefined
  }
}

export function clearDeviceInteractionHandoff(eventId?: string) {
  if (eventId !== undefined && memoryValue?.eventId !== eventId) return
  memoryValue = undefined
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    // Clearing in memory is sufficient for the current document.
  }
}
