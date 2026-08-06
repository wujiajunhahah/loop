import type {
  DeviceCapabilityId,
  DeviceCapabilityReport,
  NormalizedDeviceEventBase,
} from '../../devices/contracts'
import type {
  RuntimeDeviceSnapshot,
  RuntimeLatestValue,
  RuntimeSnapshot,
} from '../../devices/runtime'

export type DeviceKind = 'omi' | 'ring'
export type DataFreshness = 'fresh' | 'delayed' | 'stale'

export const capabilityLabels: Readonly<Record<DeviceCapabilityId, string>> = {
  interaction_events: '触碰与标记',
  telemetry: '遥测数据',
  haptic_feedback: '触觉反馈',
  light_feedback: '灯光反馈',
  status_reporting: '设备状态',
  audio_capture: '音频来源',
}

export const capabilityOrder = Object.keys(
  capabilityLabels,
) as DeviceCapabilityId[]

const TELEMETRY_DELAYED_AFTER_MS = 15_000
const TELEMETRY_STALE_AFTER_MS = 60_000

export function classifyDevice(device: RuntimeDeviceSnapshot): DeviceKind | undefined {
  const adapterIds = device.matchedAdapterIds.map((adapterId) => adapterId.toLowerCase())
  if (adapterIds.some((adapterId) => adapterId.startsWith('omi'))) return 'omi'
  if (adapterIds.some((adapterId) => adapterId.startsWith('ring'))) return 'ring'

  const identity = `${device.normalized?.category ?? ''} ${device.discovered.displayName ?? ''}`
    .toLowerCase()
  if (identity.includes('omi')) return 'omi'
  if (identity.includes('ring') || device.normalized?.category === 'ring') return 'ring'
  return undefined
}

export function devicesByKind(snapshot: RuntimeSnapshot, kind: DeviceKind) {
  return snapshot.devices.filter((device) => classifyDevice(device) === kind)
}

export function hasPartialCapabilities(
  capabilities: DeviceCapabilityReport | undefined,
) {
  return capabilities !== undefined && capabilityOrder.some(
    (capabilityId) => capabilities[capabilityId].status !== 'implemented',
  )
}

export function connectionLabel(device: RuntimeDeviceSnapshot) {
  switch (device.phase) {
    case 'discovered':
      return '未连接'
    case 'connecting':
      return '正在连接'
    case 'connected':
      return hasPartialCapabilities(device.capabilities)
        ? '已连接 · 部分功能暂不可用'
        : '已连接'
    case 'disconnecting':
      return '正在断开'
    case 'reconnecting':
      return '正在重新连接'
    case 'disconnected':
      return '已断开'
    case 'failed':
      return '暂时无法恢复连接'
  }
}

export function freshnessFor(
  value: RuntimeLatestValue,
  now: number,
): DataFreshness {
  const observedAt = Date.parse(value.occurredAt)
  if (!Number.isFinite(observedAt)) return 'stale'
  const age = Math.max(0, now - observedAt)
  if (age > TELEMETRY_STALE_AFTER_MS) return 'stale'
  if (age > TELEMETRY_DELAYED_AFTER_MS) return 'delayed'
  return 'fresh'
}

export function freshnessLabel(freshness: DataFreshness) {
  switch (freshness) {
    case 'fresh':
      return '刚刚更新'
    case 'delayed':
      return '更新延迟'
    case 'stale':
      return '数据已过期'
  }
}

export function sourceLabel(source: 'physical' | 'simulated') {
  return source === 'simulated' ? '演示数据' : '实体设备'
}

export function signalLabel(signalStrength: number) {
  if (signalStrength >= -55) return '信号良好'
  if (signalStrength >= -72) return '信号稳定'
  return '信号较弱'
}

type PendingInteraction = NormalizedDeviceEventBase & {
  kind: 'interaction'
  interaction: 'mark_moment' | 'touch'
}

export interface PendingDeviceEvent {
  event: PendingInteraction
  device: RuntimeDeviceSnapshot
}

function isPendingInteraction(
  event: NormalizedDeviceEventBase | undefined,
): event is PendingInteraction {
  if (event === undefined) return false
  const candidate = event as NormalizedDeviceEventBase & {
    kind?: unknown
    interaction?: unknown
  }
  return candidate.kind === 'interaction' &&
    (candidate.interaction === 'mark_moment' || candidate.interaction === 'touch')
}

export function findPendingDeviceEvent(
  snapshot: RuntimeSnapshot,
): PendingDeviceEvent | undefined {
  for (const device of [...snapshot.devices].reverse()) {
    if (isPendingInteraction(device.latestEvent)) {
      return { event: device.latestEvent, device }
    }
  }
  return undefined
}

export function observedTime(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
