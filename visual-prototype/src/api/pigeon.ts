export type PigeonDecision = 'grounded_match' | 'partial_match' | 'no_match' | 'pause'
export type PigeonPresentationMode = 'gentle' | 'standard' | 'standard_open'
export type PigeonFeedbackCode =
  | 'very_relevant'
  | 'not_relevant'
  | 'too_heavy'
  | 'suppress_memory'
  | 'misrepresents_creator'

export type VoiceDiaryChunk = {
  session_id: string
  chunk_id: string
  bytes_received: number
  audio_format: string
  source: string
  captured_at: string | null
  received_at: string
}

export type HrvLatestStatus = {
  device_id: string
  has_reading: boolean
  fresh: boolean
  valid: boolean
  state: 'low' | 'normal' | 'high' | 'unknown'
  value: number | null
  baseline: number
  measured_at: string | null
  received_at: string | null
  valid_until: string | null
  validity_reason: string | null
}

export type PigeonInteractionResponse = {
  api_version: 'v1'
  interaction_id: string
  status: 'completed'
  decision: PigeonDecision
  reply: {
    lead: string
    quote: string | null
    context_note: string | null
    closing: string | null
  }
  evidence: {
    memory_id: string
    title: string
    source_label: string
    creator_confirmed: boolean
    relation_reason: string
  } | null
  presentation: {
    mode: PigeonPresentationMode
    reduce_motion: boolean
    autoplay_audio: false
    allow_deeper_prompt: boolean
  }
  safety: {
    grounded: boolean
    impersonates_creator: false
    hrv_interpreted_as_emotion: false
  }
  feedback_options: PigeonFeedbackCode[]
}

const configuredBaseUrl = import.meta.env.VITE_PIGEON_API_BASE_URL?.trim()
const inferredHost = typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname

export const PIGEON_API_BASE_URL = (configuredBaseUrl || `http://${inferredHost}:8010`).replace(/\/$/, '')

async function requestJson<T>(path: string, init: RequestInit, timeoutMs = 50_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${PIGEON_API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...init.headers },
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`信使服务返回 ${response.status}${detail ? `：${detail}` : ''}`)
    }
    return await response.json() as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export function createPigeonInteraction(input: {
  clientRequestId: string
  text: string
  intensity: 'L1' | 'L2'
}): Promise<PigeonInteractionResponse> {
  return requestJson<PigeonInteractionResponse>('/api/v1/interactions', {
    method: 'POST',
    headers: { 'Idempotency-Key': input.clientRequestId },
    body: JSON.stringify({
      client_request_id: input.clientRequestId,
      relationship_id: 'rel_linlan_linya_001',
      recipient_id: 'person_linya',
      device_id: 'alloop-demo-001',
      input: { type: 'text', text: input.text },
      preferences: { content_intensity: input.intensity },
    }),
  })
}

export async function markPigeonPresented(interactionId: string): Promise<void> {
  const response = await fetch(`${PIGEON_API_BASE_URL}/api/v1/interactions/${encodeURIComponent(interactionId)}/presented`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ presented_at: new Date().toISOString() }),
  })
  if (!response.ok) throw new Error(`无法确认回信已展示（${response.status}）`)
}

export async function submitPigeonFeedback(
  interactionId: string,
  feedbackCode: PigeonFeedbackCode,
): Promise<void> {
  await requestJson(`/api/v1/interactions/${encodeURIComponent(interactionId)}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback_code: feedbackCode }),
  }, 15_000)
}

export async function getRecentVoiceDiaryChunks(limit = 1): Promise<VoiceDiaryChunk[]> {
  const response = await requestJson<{ items: VoiceDiaryChunk[] }>(
    `/api/conversation/voice-diary/recent?limit=${encodeURIComponent(limit)}`,
    { method: 'GET' },
    8_000,
  )
  return response.items
}

export function getLatestHrvStatus(deviceId = 'alloop-demo-001'): Promise<HrvLatestStatus> {
  return requestJson<HrvLatestStatus>(
    `/api/v1/hrv/latest?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'GET' },
    8_000,
  )
}
