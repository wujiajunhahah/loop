import type { DeviceInteractionProfileProvenance } from '../../domain'

export type DeviceInteractionPurpose = 'creator_capture' | 'recipient_entry'

export type DeviceInteractionDisposition =
  | 'dismissed'
  | 'entered_creator'
  | 'entered_recipient'
  | 'consent_revoked'

export interface ProcessedDeviceInteraction {
  version: 1
  eventId: string
  disposition: DeviceInteractionDisposition
  processedAt: string
}

interface DeviceInteractionHandoffBase {
  version: 2
  eventId: string
  deviceId: string
  deviceName: string
  source: 'physical' | 'simulated'
  occurredAt: string
  ownerId: string
  sessionId: string
  sessionSequence?: number
  profile?: DeviceInteractionProfileProvenance
}

export interface CreatorDeviceInteractionHandoff extends DeviceInteractionHandoffBase {
  purpose: 'creator_capture'
  interaction: 'mark_moment'
  verification: 'binding_verified'
  recipientId?: never
}

export interface RecipientDeviceInteractionHandoff extends DeviceInteractionHandoffBase {
  purpose: 'recipient_entry'
  interaction: 'touch'
  verification: 'entrustment_verified'
  recipientId: string
}

export type VerifiedDeviceInteractionHandoff =
  | CreatorDeviceInteractionHandoff
  | RecipientDeviceInteractionHandoff

export interface DeviceInteractionHandoffExpectation {
  ownerId?: string
  recipientId?: string
  now?: number
}

export const DEVICE_INTERACTION_HANDOFF_MAX_AGE_MS = 10 * 60_000
const MAX_FUTURE_SKEW_MS = 30_000
const STORAGE_KEY = 'loop:verified-device-interaction:v2'
const LEGACY_STORAGE_KEY = 'loop:verified-device-interaction:v1'
const PROCESSED_STORAGE_KEY = 'loop:processed-device-interactions:v1'
const MAX_PROCESSED_INTERACTIONS = 64
let memoryValue: VerifiedDeviceInteractionHandoff | undefined
let processedMemoryValue: ProcessedDeviceInteraction[] | undefined

function storage() {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isProfile(
  value: unknown,
): value is DeviceInteractionProfileProvenance {
  if (value === undefined) return true
  if (value === null || typeof value !== 'object') return false
  const candidate = value as DeviceInteractionProfileProvenance
  return nonBlank(candidate.profileId) &&
    nonBlank(candidate.sourceReference) &&
    (candidate.validation === 'fixture_only' ||
      candidate.validation === 'physical_device') &&
    (candidate.model === undefined || nonBlank(candidate.model)) &&
    (candidate.firmware === undefined || nonBlank(candidate.firmware))
}

function hasFreshTimestamp(occurredAt: unknown, now: number) {
  if (typeof occurredAt !== 'string') return false
  const timestamp = Date.parse(occurredAt)
  return Number.isFinite(timestamp) &&
    timestamp <= now + MAX_FUTURE_SKEW_MS &&
    timestamp >= now - DEVICE_INTERACTION_HANDOFF_MAX_AGE_MS
}

function isHandoff(
  value: unknown,
  now: number,
): value is VerifiedDeviceInteractionHandoff {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<VerifiedDeviceInteractionHandoff>
  const commonValid = candidate.version === 2 &&
    nonBlank(candidate.eventId) &&
    nonBlank(candidate.deviceId) &&
    nonBlank(candidate.deviceName) &&
    (candidate.source === 'physical' || candidate.source === 'simulated') &&
    nonBlank(candidate.ownerId) &&
    nonBlank(candidate.sessionId) &&
    (candidate.sessionSequence === undefined ||
      (Number.isSafeInteger(candidate.sessionSequence) && candidate.sessionSequence > 0)) &&
    isProfile(candidate.profile) &&
    hasFreshTimestamp(candidate.occurredAt, now)
  if (!commonValid) return false
  if (candidate.purpose === 'creator_capture') {
    return candidate.interaction === 'mark_moment' &&
      candidate.verification === 'binding_verified' &&
      candidate.recipientId === undefined
  }
  return candidate.purpose === 'recipient_entry' &&
    candidate.interaction === 'touch' &&
    candidate.verification === 'entrustment_verified' &&
    nonBlank(candidate.recipientId)
}

function cloneHandoff(
  handoff: VerifiedDeviceInteractionHandoff,
): VerifiedDeviceInteractionHandoff {
  return {
    ...handoff,
    ...(handoff.profile === undefined
      ? {}
      : { profile: { ...handoff.profile } }),
  }
}

function isProcessedInteraction(
  value: unknown,
): value is ProcessedDeviceInteraction {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<ProcessedDeviceInteraction>
  return candidate.version === 1 &&
    typeof candidate.eventId === 'string' && candidate.eventId.length > 0 &&
    (candidate.disposition === 'dismissed' ||
      candidate.disposition === 'entered_creator' ||
      candidate.disposition === 'entered_recipient' ||
      candidate.disposition === 'consent_revoked') &&
    typeof candidate.processedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.processedAt))
}

function readProcessedInteractions() {
  if (processedMemoryValue !== undefined) return processedMemoryValue

  try {
    const target = storage()
    const raw = target?.getItem(PROCESSED_STORAGE_KEY)
    if (raw === null || raw === undefined) {
      processedMemoryValue = []
      return processedMemoryValue
    }

    const candidate: unknown = JSON.parse(raw)
    if (!Array.isArray(candidate) || !candidate.every(isProcessedInteraction)) {
      target?.removeItem(PROCESSED_STORAGE_KEY)
      processedMemoryValue = []
      return processedMemoryValue
    }

    processedMemoryValue = candidate
      .slice(-MAX_PROCESSED_INTERACTIONS)
      .map((record) => ({ ...record }))
    return processedMemoryValue
  } catch {
    try {
      storage()?.removeItem(PROCESSED_STORAGE_KEY)
    } catch {
      // The in-memory ledger remains usable when session storage is unavailable.
    }
    processedMemoryValue = []
    return processedMemoryValue
  }
}

export function markDeviceInteractionProcessed(
  record: ProcessedDeviceInteraction,
) {
  if (!isProcessedInteraction(record)) return

  const next = readProcessedInteractions()
    .filter((existing) => existing.eventId !== record.eventId)
  next.push({ ...record })
  processedMemoryValue = next.slice(-MAX_PROCESSED_INTERACTIONS)

  try {
    storage()?.setItem(
      PROCESSED_STORAGE_KEY,
      JSON.stringify(processedMemoryValue),
    )
  } catch {
    // The current document can still use the in-memory ledger.
  }
}

export function isDeviceInteractionProcessed(eventId: string) {
  return readProcessedInteractions().some((record) => record.eventId === eventId)
}

export function clearProcessedDeviceInteractions() {
  processedMemoryValue = []
  try {
    storage()?.removeItem(PROCESSED_STORAGE_KEY)
  } catch {
    // Clearing in memory is sufficient for the current document.
  }
}

export function writeDeviceInteractionHandoff(
  handoff: VerifiedDeviceInteractionHandoff,
  now = Date.now(),
) {
  if (!isHandoff(handoff, now)) return false
  memoryValue = cloneHandoff(handoff)
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(handoff))
    storage()?.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Navigation in the current document can still use the in-memory value.
  }
  return true
}

export function readDeviceInteractionHandoff(
  purpose: 'creator_capture',
  expectation?: DeviceInteractionHandoffExpectation,
): CreatorDeviceInteractionHandoff | undefined
export function readDeviceInteractionHandoff(
  purpose: 'recipient_entry',
  expectation?: DeviceInteractionHandoffExpectation,
): RecipientDeviceInteractionHandoff | undefined
export function readDeviceInteractionHandoff(
  purpose?: undefined,
  expectation?: DeviceInteractionHandoffExpectation,
): VerifiedDeviceInteractionHandoff | undefined
export function readDeviceInteractionHandoff(
  purpose?: DeviceInteractionPurpose,
  expectation: DeviceInteractionHandoffExpectation = {},
): VerifiedDeviceInteractionHandoff | undefined {
  const now = expectation.now ?? Date.now()
  if (memoryValue !== undefined) {
    if (!hasFreshTimestamp(memoryValue.occurredAt, now)) {
      const expiredEventId = memoryValue.eventId
      clearDeviceInteractionHandoff(expiredEventId)
      return undefined
    }
    if (purpose !== undefined && memoryValue.purpose !== purpose) return undefined
    if (expectation.ownerId !== undefined && memoryValue.ownerId !== expectation.ownerId) {
      return undefined
    }
    if (
      expectation.recipientId !== undefined &&
      memoryValue.recipientId !== expectation.recipientId
    ) return undefined
    return cloneHandoff(memoryValue)
  }
  try {
    const target = storage()
    target?.removeItem(LEGACY_STORAGE_KEY)
    const raw = target?.getItem(STORAGE_KEY)
    if (raw === null || raw === undefined) return undefined
    const candidate: unknown = JSON.parse(raw)
    if (!isHandoff(candidate, now)) {
      target?.removeItem(STORAGE_KEY)
      return undefined
    }
    memoryValue = cloneHandoff(candidate)
    if (purpose !== undefined && candidate.purpose !== purpose) return undefined
    if (expectation.ownerId !== undefined && candidate.ownerId !== expectation.ownerId) {
      return undefined
    }
    if (
      expectation.recipientId !== undefined &&
      candidate.recipientId !== expectation.recipientId
    ) return undefined
    return cloneHandoff(candidate)
  } catch {
    return undefined
  }
}

export function clearDeviceInteractionHandoff(eventId?: string) {
  if (eventId === undefined) {
    memoryValue = undefined
    try {
      storage()?.removeItem(STORAGE_KEY)
      storage()?.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // Clearing in memory is sufficient for the current document.
    }
    return
  }

  let storedEventId: string | undefined
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (raw !== null && raw !== undefined) {
      const candidate: unknown = JSON.parse(raw)
      if (candidate !== null && typeof candidate === 'object') {
        const value = (candidate as { eventId?: unknown }).eventId
        if (typeof value === 'string') storedEventId = value
      }
    }
  } catch {
    // The in-memory value remains authoritative when storage cannot be read.
  }
  if (
    memoryValue?.eventId !== eventId &&
    storedEventId !== eventId
  ) return
  memoryValue = undefined
  try {
    storage()?.removeItem(STORAGE_KEY)
    storage()?.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Clearing in memory is sufficient for the current document.
  }
}
