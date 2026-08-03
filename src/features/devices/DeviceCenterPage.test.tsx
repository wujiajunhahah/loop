import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeviceCapabilityReport, DeviceResult, DiscoveredDevice } from '../../devices/contracts'
import type {
  DeviceRuntime,
  RuntimeDeviceSnapshot,
  RuntimeScanResult,
  RuntimeSnapshot,
} from '../../devices/runtime'
import { DeviceCenterPage } from './DeviceCenterPage'

const capabilities: DeviceCapabilityReport = {
  interaction_events: { status: 'requires_vendor_profile', reason: '等待经过审核的设备协议。' },
  telemetry: { status: 'implemented' },
  haptic_feedback: { status: 'requires_vendor_profile', reason: '等待经过审核的设备协议。' },
  light_feedback: { status: 'requires_vendor_profile', reason: '等待经过审核的设备协议。' },
  status_reporting: { status: 'implemented' },
  audio_capture: { status: 'requires_real_device', reason: '需要真机确认音频来源。' },
}

function discovered(kind: 'omi' | 'ring', simulated = false): DiscoveredDevice {
  return {
    discoveryId: `${kind}-device-id-with-private-suffix`,
    transportId: simulated ? `simulator-${kind}-transport` : 'capacitor-ble',
    transportKind: simulated ? 'simulated' : 'bluetooth_low_energy',
    displayName: kind === 'omi' ? 'Omi DevKit' : 'Alloop Ring',
    connectable: true,
    signalStrength: kind === 'omi' ? -48 : -67,
    discoveredAt: '2026-08-03T00:00:00.000Z',
  }
}

function device(
  kind: 'omi' | 'ring',
  phase: RuntimeDeviceSnapshot['phase'] = 'discovered',
  options: { simulated?: boolean; event?: RuntimeDeviceSnapshot['latestEvent'] } = {},
): RuntimeDeviceSnapshot {
  const found = discovered(kind, options.simulated)
  return {
    deviceKey: `${found.transportId}::${found.discoveryId}`,
    discovered: found,
    matchedAdapterIds: [kind === 'omi' ? `omi-audio${options.simulated ? '-simulated' : ''}` : `ring${options.simulated ? '-simulated' : ''}`],
    phase,
    ...(phase === 'connected'
      ? {
          normalized: {
            deviceId: `${kind}-normalized-private-id`,
            displayName: found.displayName,
            category: kind === 'ring' ? ('ring' as const) : ('wearable' as const),
            adapterId: kind === 'omi' ? 'omi-audio' : 'ring',
          },
          capabilities,
          sessionId: `${kind}-session-private-id`,
        }
      : {}),
    ...(options.event === undefined ? {} : { latestEvent: options.event }),
    latestValues:
      kind === 'ring' && phase === 'connected'
        ? {
            heart_rate: {
              name: 'heart_rate',
              value: 72,
              unit: 'bpm',
              occurredAt: '2026-08-03T00:00:00.000Z',
              source: options.simulated ? 'simulated' : 'physical',
              privacy: 'normalized',
            },
          }
        : {},
  }
}

function snapshot(overrides: Partial<RuntimeSnapshot> = {}): RuntimeSnapshot {
  return {
    phase: 'ready',
    scanGeneration: 0,
    devices: [],
    sessions: [],
    selectedDeviceIds: [],
    profiles: {},
    preferences: {},
    consent: {
      audioCapture: false,
      sensitiveTelemetryExport: false,
      interactionEvents: false,
    },
    diagnostics: [],
    ...overrides,
  }
}

function createRuntimeHarness(initial = snapshot()) {
  let current = initial
  const listeners = new Set<() => void>()
  const publish = (next: RuntimeSnapshot) => {
    current = next
    for (const listener of listeners) listener()
  }
  const scan = vi.fn(async (): Promise<DeviceResult<RuntimeScanResult>> => {
    publish({ ...current, phase: 'scanning' })
    await Promise.resolve()
    const next = { ...current, phase: 'ready' as const, scanGeneration: current.scanGeneration + 1 }
    publish(next)
    return { ok: true, value: { scanId: `scan-${next.scanGeneration}`, devices: next.devices } } as const
  })
  const connect = vi.fn(async (reference: string | DiscoveredDevice) => {
    const key = typeof reference === 'string' ? reference : `${reference.transportId}::${reference.discoveryId}`
    publish({
      ...current,
      phase: 'connecting',
      devices: current.devices.map((entry) => entry.deviceKey === key ? { ...entry, phase: 'connecting' as const } : entry),
    })
    await Promise.resolve()
    publish({
      ...current,
      phase: 'connected',
      devices: current.devices.map((entry) => entry.deviceKey === key ? device(entry.matchedAdapterIds[0]?.startsWith('omi') ? 'omi' : 'ring', 'connected', { simulated: entry.discovered.transportKind === 'simulated' }) : entry),
    })
    return { ok: false, error: { code: 'connection_failed', message: 'fixture has no session', retryable: true } } as const
  })
  const disconnect = vi.fn(async (reference: string | DiscoveredDevice) => {
    const key = typeof reference === 'string' ? reference : `${reference.transportId}::${reference.discoveryId}`
    publish({
      ...current,
      phase: 'disconnecting',
      devices: current.devices.map((entry) => entry.deviceKey === key ? { ...entry, phase: 'disconnecting' as const } : entry),
    })
    await Promise.resolve()
    publish({
      ...current,
      phase: 'ready',
      devices: current.devices.map((entry) => entry.deviceKey === key ? { ...entry, phase: 'disconnected' as const, sessionId: undefined } : entry),
    })
    return { ok: true, value: undefined } as const
  })
  const reconnect = vi.fn(async (reference: string | DiscoveredDevice) => {
    const key = typeof reference === 'string' ? reference : `${reference.transportId}::${reference.discoveryId}`
    publish({
      ...current,
      phase: 'reconnecting',
      devices: current.devices.map((entry) => entry.deviceKey === key ? { ...entry, phase: 'reconnecting' as const } : entry),
    })
    return { ok: false, error: { code: 'connection_failed', message: 'retrying fixture', retryable: true } } as const
  })
  const setConsent = vi.fn(async (next: Partial<RuntimeSnapshot['consent']>) => {
    publish({ ...current, consent: { ...current.consent, ...next } })
    return { ok: true, value: undefined } as const
  })
  const runtime = {
    ready: vi.fn(async (): Promise<DeviceResult<void>> => ({ ok: true, value: undefined })),
    getSnapshot: () => current,
    getServerSnapshot: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener)
      const remove = (() => {
        listeners.delete(listener)
      }) as unknown as ReturnType<DeviceRuntime['subscribe']>
      remove.unsubscribe = remove
      return remove
    },
    scan,
    cancelScan: vi.fn(async () => {
      publish({ ...current, phase: 'ready' })
      return { ok: true, value: undefined } as const
    }),
    connect,
    reconnect,
    disconnect,
    setConsent,
    setPreferences: vi.fn(async () => ({ ok: true, value: undefined } as const)),
    selectDevice: vi.fn(async () => ({ ok: true, value: undefined } as const)),
    setProfile: vi.fn(async () => ({ ok: true, value: undefined } as const)),
    close: vi.fn(async () => ({ ok: true, value: undefined } as const)),
  } as unknown as DeviceRuntime
  return { runtime, scan, connect, reconnect, disconnect, setConsent, publish }
}

function renderCenter(props: Record<string, unknown>) {
  return render(createElement(DeviceCenterPage, props as never))
}

describe('DeviceCenterPage', () => {
  beforeEach(() => {
    window.location.hash = '#/devices'
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('switches to injected deterministic simulators and labels their source', async () => {
    const physical = createRuntimeHarness()
    const simulated = createRuntimeHarness(snapshot({
      devices: [device('omi', 'discovered', { simulated: true }), device('ring', 'discovered', { simulated: true })],
    }))

    renderCenter({
      runtime: physical.runtime,
      environment: { physicalSupported: false, permission: 'unsupported' },
      simulator: { runtime: simulated.runtime },
    })

    expect(screen.getByText('此环境不能扫描蓝牙设备')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: '使用演示数据' }))

    await waitFor(() => expect(simulated.scan).toHaveBeenCalledTimes(1))
    expect(screen.getAllByText('演示数据').length).toBeGreaterThan(1)
    expect(screen.getByRole('heading', { name: 'OMI' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '智能戒指' })).toBeInTheDocument()
  })

  it('gates OMI connection on explicit audio consent', async () => {
    const omi = device('omi')
    const harness = createRuntimeHarness(snapshot({ devices: [omi], scanGeneration: 1 }))
    renderCenter({
      runtime: harness.runtime,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    const omiSection = screen.getByRole('region', { name: 'OMI' })
    expect(within(omiSection).getByRole('button', { name: /连接 Omi DevKit/ })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: '允许 OMI 音频连接' }))
    await waitFor(() => expect(harness.setConsent).toHaveBeenCalledWith({ audioCapture: true }))
    fireEvent.click(within(omiSection).getByRole('button', { name: /连接 Omi DevKit/ }))
    await waitFor(() => expect(harness.connect).toHaveBeenCalledWith(omi.deviceKey, expect.any(Object)))
  })

  it('wires permission denial, scan, connect, disconnect, and reconnect states', async () => {
    const denied = createRuntimeHarness()
    denied.scan.mockResolvedValueOnce({
      ok: false,
      error: { code: 'permission_denied', message: 'denied', retryable: false },
    })
    renderCenter({
      runtime: denied.runtime,
      environment: { physicalSupported: true, permission: 'prompt' },
    })
    fireEvent.click(screen.getByRole('button', { name: '继续并允许蓝牙' }))
    await screen.findByText('蓝牙权限未开启')
    cleanup()

    const ring = device('ring')
    const harness = createRuntimeHarness(snapshot({ devices: [ring], scanGeneration: 1 }))
    renderCenter({
      runtime: harness.runtime,
      environment: { physicalSupported: true, permission: 'granted' },
    })
    fireEvent.click(screen.getByRole('button', { name: '扫描设备' }))
    await waitFor(() => expect(harness.scan).toHaveBeenCalledTimes(1))

    const ringSection = screen.getByRole('region', { name: '智能戒指' })
    fireEvent.click(within(ringSection).getByRole('button', { name: /连接 Alloop Ring/ }))
    await waitFor(() => expect(within(ringSection).getByText('已连接 · 部分功能暂不可用')).toBeInTheDocument())
    fireEvent.click(within(ringSection).getByRole('button', { name: /断开 Alloop Ring/ }))
    await waitFor(() => expect(harness.disconnect).toHaveBeenCalled())

    act(() => harness.publish(snapshot({ devices: [{ ...ring, phase: 'failed' }], phase: 'failed' })))
    fireEvent.click(within(ringSection).getByRole('button', { name: /重新连接 Alloop Ring/ }))
    await waitFor(() => expect(harness.reconnect).toHaveBeenCalled())
    expect(within(ringSection).getByText('正在重新连接')).toBeInTheDocument()
  })

  it('renders loading, empty, connecting, partial, stale, and disconnecting states without fake zeroes', async () => {
    const harness = createRuntimeHarness(snapshot({ phase: 'opening' }))
    renderCenter({
      runtime: harness.runtime,
      environment: { physicalSupported: true, permission: 'granted' },
      now: () => Date.parse('2026-08-03T00:02:00.000Z'),
    })
    expect(screen.getByText('正在读取本机设备状态')).toBeInTheDocument()

    act(() => harness.publish(snapshot({ scanGeneration: 1 })))
    expect(screen.getByText('没有找到可用的 OMI 或戒指')).toBeInTheDocument()

    act(() => harness.publish(snapshot({ devices: [device('ring', 'connecting')], phase: 'connecting' })))
    expect(screen.getByText('正在连接')).toBeInTheDocument()

    act(() => harness.publish(snapshot({ devices: [device('ring', 'connected')], phase: 'connected' })))
    expect(screen.getByText('已连接 · 部分功能暂不可用')).toBeInTheDocument()
    expect(screen.getByText('数据已过期')).toBeInTheDocument()
    expect(screen.getByText('72 bpm')).toBeInTheDocument()
    expect(screen.queryByText('0 bpm')).not.toBeInTheDocument()

    act(() => harness.publish(snapshot({ devices: [device('ring', 'disconnecting')], phase: 'disconnecting' })))
    expect(screen.getByText('正在断开')).toBeInTheDocument()
  })

  it('keeps redacted diagnostics collapsed until requested', () => {
    const harness = createRuntimeHarness(snapshot({
      diagnostics: [{
        diagnosticId: 'diagnostic-private-id',
        occurredAt: '2026-08-03T00:00:00.000Z',
        operation: 'connect',
        phase: 'failed',
        deviceKey: 'capacitor-ble::full-private-device-identifier',
        adapterId: 'ring',
        code: 'connection_failed',
        message: 'Device session did not connect.',
      }],
    }))
    renderCenter({
      runtime: harness.runtime,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    const details = screen.getByText('诊断信息').closest('details')
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('诊断信息'))
    expect(screen.getByText('connection_failed')).toBeInTheDocument()
    expect(screen.queryByText(/full-private-device-identifier/)).not.toBeInTheDocument()
  })

  it('turns mark_moment into a pending offer and navigates only after explicit action', async () => {
    const mark = {
      eventId: 'mark-event-source-id',
      deviceId: 'ring-normalized-private-id',
      sessionId: 'ring-session-private-id',
      occurredAt: '2026-08-03T00:00:00.000Z',
      source: 'physical' as const,
      kind: 'interaction' as const,
      interaction: 'mark_moment' as const,
    }
    const harness = createRuntimeHarness(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', { event: mark })],
    }))
    renderCenter({
      runtime: harness.runtime,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    expect(await screen.findByRole('dialog', { name: '为这一刻留个位置' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/devices')
    expect(screen.getByText('没有录音、拍摄、播放或分享会自动开始。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '进入记录引导' }))
    expect(window.location.hash).toBe('#/capture/new')
  })

  it('keeps recipient companionship pending, sourced, and user controlled', async () => {
    const touch = {
      eventId: 'touch-event-source-id',
      deviceId: 'ring-normalized-private-id',
      sessionId: 'ring-session-private-id',
      occurredAt: '2026-08-03T00:00:00.000Z',
      source: 'physical' as const,
      kind: 'interaction' as const,
      interaction: 'touch' as const,
    }
    const harness = createRuntimeHarness(snapshot({
      phase: 'connected',
      devices: [device('ring', 'connected')],
    }))
    renderCenter({
      runtime: harness.runtime,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    expect(screen.getByText('我在')).toBeInTheDocument()
    expect(screen.getByText('Loop 提示 · 来源会始终标明')).toBeInTheDocument()

    act(() => harness.publish(snapshot({
      phase: 'connected',
      devices: [device('ring', 'connected', { event: touch })],
    })))

    expect(await screen.findByRole('dialog', { name: '为一段陪伴留出入口' })).toBeInTheDocument()
    expect(screen.getByText(/源自 Alloop Ring · 实体设备/)).toBeInTheDocument()
    expect(screen.getByText('一段经过托付的内容可以由你决定是否打开。')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/devices')

    fireEvent.click(screen.getByRole('button', { name: '确认这是给我的' }))
    expect(window.location.hash).toBe('#/recipient')
  })
})
