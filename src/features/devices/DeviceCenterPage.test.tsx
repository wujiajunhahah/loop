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
import { MockHardwareBridge } from '../../adapters/hardware'
import { DeviceCenterPage } from './DeviceCenterPage'
import {
  clearDeviceInteractionHandoff,
  clearProcessedDeviceInteractions,
  isDeviceInteractionProcessed,
  readDeviceInteractionHandoff,
  writeDeviceInteractionHandoff,
} from './deviceInteractionHandoff'

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
    discoveryActive: overrides.phase === 'scanning',
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
    publish({ ...current, phase: 'scanning', discoveryActive: true })
    await Promise.resolve()
    const next = {
      ...current,
      phase: 'ready' as const,
      discoveryActive: false,
      scanGeneration: current.scanGeneration + 1,
    }
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
      publish({ ...current, phase: 'ready', discoveryActive: false })
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
  return render(createElement(DeviceCenterPage, {
    now: () => Date.parse('2026-08-03T00:05:00.000Z'),
    ...props,
  } as never))
}

function interactionEvent(
  eventId: string,
  interaction: 'mark_moment' | 'touch',
) {
  return {
    eventId,
    deviceId: 'ring-normalized-private-id',
    sessionId: 'ring-session-private-id',
    occurredAt: '2026-08-03T00:00:00.000Z',
    source: 'physical' as const,
    kind: 'interaction' as const,
    interaction,
  }
}

async function createEntrustedHardwareBridge(deviceId: string) {
  const hardwareBridge = new MockHardwareBridge()
  await hardwareBridge.bindDevice({
    deviceId,
    deviceType: 'ring',
    ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
  })
  await hardwareBridge.entrustDevice({
    deviceId,
    ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
    recipientProof: { identityId: 'person-lin', method: 'mock_confirmation', value: 'LOOP-DEMO' },
  })
  return hardwareBridge
}

describe('DeviceCenterPage', () => {
  beforeEach(() => {
    window.location.hash = '#/devices'
    clearDeviceInteractionHandoff()
    clearProcessedDeviceInteractions()
    sessionStorage.clear()
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

  it('keeps a connected physical session visible until it is disconnected', async () => {
    const physical = createRuntimeHarness(snapshot({
      phase: 'connected',
      devices: [device('ring', 'connected')],
    }))
    const simulated = createRuntimeHarness(snapshot({
      devices: [device('ring', 'discovered', { simulated: true })],
    }))

    renderCenter({
      runtime: physical.runtime,
      environment: { physicalSupported: true, permission: 'granted' },
      simulator: { runtime: simulated.runtime },
    })

    fireEvent.click(screen.getByRole('switch', { name: '使用演示数据' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('请先断开实体设备，再切换到演示数据。')
    expect(screen.getByRole('switch', { name: '使用演示数据' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: '断开 Alloop Ring' })).toBeInTheDocument()
    expect(simulated.scan).not.toHaveBeenCalled()
  })

  it('pauses foreground scanning while hidden and verifies state on resume', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const harness = createRuntimeHarness(snapshot({ phase: 'scanning' }))
    let finishResume: ((result: DeviceResult<void>) => void) | undefined
    vi.mocked(harness.runtime.ready)
      .mockResolvedValueOnce({ ok: true, value: undefined })
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishResume = resolve
      }))

    const refreshBluetoothState = vi.fn(async () => ({ bluetoothPowered: false }))
    renderCenter({
      runtime: harness.runtime,
      environment: {
        physicalSupported: true,
        permission: 'granted',
        refreshBluetoothState,
      },
    })

    visibility.mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(await screen.findByText('扫描已暂停')).toBeInTheDocument()
    expect(harness.runtime.cancelScan).toHaveBeenCalledTimes(1)

    visibility.mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange'))
    expect(await screen.findByText('正在恢复设备状态')).toBeInTheDocument()
    await act(async () => {
      finishResume?.({ ok: true, value: undefined })
    })
    expect(refreshBluetoothState).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('蓝牙已关闭')).toBeInTheDocument()
  })

  it('synchronizes granted permission and powered-off state from scan results', async () => {
    const granted = createRuntimeHarness()
    renderCenter({
      runtime: granted.runtime,
      environment: { physicalSupported: true, permission: 'prompt' },
    })
    fireEvent.click(screen.getByRole('button', { name: '继续并允许蓝牙' }))
    await waitFor(() => expect(granted.scan).toHaveBeenCalledWith({ timeoutMs: 10_000 }))
    expect(screen.queryByText('需要蓝牙权限才能查找附近设备')).not.toBeInTheDocument()
    cleanup()

    const poweredOff = createRuntimeHarness()
    poweredOff.scan.mockResolvedValueOnce({
      ok: false,
      error: { code: 'powered_off', message: 'off', retryable: true },
    })
    renderCenter({
      runtime: poweredOff.runtime,
      environment: { physicalSupported: true, permission: 'prompt' },
    })
    fireEvent.click(screen.getByRole('button', { name: '继续并允许蓝牙' }))
    expect(await screen.findByText('蓝牙已关闭')).toBeInTheDocument()
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
      now: () => Date.parse('2026-08-03T00:00:00.000Z'),
    })
    fireEvent.click(screen.getByRole('button', { name: '扫描设备' }))
    await waitFor(() => expect(harness.scan).toHaveBeenCalledTimes(1))

    const ringSection = screen.getByRole('region', { name: '智能戒指' })
    fireEvent.click(within(ringSection).getByRole('button', { name: /连接 Alloop Ring/ }))
    await waitFor(() => expect(within(ringSection).getByText('已连接 · 部分功能暂不可用')).toBeInTheDocument())
    fireEvent.click(within(ringSection).getByRole('button', { name: /断开 Alloop Ring/ }))
    await waitFor(() => expect(harness.disconnect).toHaveBeenCalled())

    const failedWithLastValue = { ...device('ring', 'connected'), phase: 'failed' as const }
    act(() => harness.publish(snapshot({ devices: [failedWithLastValue], phase: 'failed' })))
    expect(within(ringSection).getByText('暂时无法恢复连接')).toBeInTheDocument()
    expect(within(ringSection).getByText('72 bpm')).toBeInTheDocument()
    expect(within(ringSection).getByText('数据已过期')).toBeInTheDocument()
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
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: mark.deviceId,
      deviceType: 'ring',
      ownerProof: {
        identityId: 'person-mei',
        method: 'mock_code',
        value: 'LOOP-DEMO',
      },
    })
    const props = {
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' },
    }
    const firstRender = renderCenter(props)

    expect(await screen.findByRole('dialog', { name: '为这一刻留个位置' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/devices')
    expect(screen.getByText('没有录音、拍摄、播放或分享会自动开始。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '进入记录引导' }))
    expect(window.location.hash).toBe('#/capture/new')

    firstRender.unmount()
    window.location.hash = '#/devices'
    renderCenter(props)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not repeat a dismissed event after remount and still offers a new event', async () => {
    const mark = {
      eventId: 'dismissed-mark-event',
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
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: mark.deviceId,
      deviceType: 'ring',
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
    })
    const props = {
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' as const },
    }
    const firstRender = renderCenter(props)

    await screen.findByRole('dialog', { name: '为这一刻留个位置' })
    fireEvent.click(screen.getByRole('button', { name: '忽略' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(isDeviceInteractionProcessed(mark.eventId)).toBe(true)

    firstRender.unmount()
    renderCenter(props)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => harness.publish(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', {
        event: { ...mark, eventId: 'new-mark-event' },
      })],
    })))
    expect(await screen.findByRole('dialog', { name: '为这一刻留个位置' })).toBeInTheDocument()
  })

  it('does not open a creator prompt for an unbound device event', async () => {
    const mark = {
      eventId: 'unbound-mark-event',
      deviceId: 'unbound-ring-id',
      sessionId: 'unbound-ring-session',
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
      hardwareBridge: new MockHardwareBridge(),
      environment: { physicalSupported: true, permission: 'granted' },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('设备尚未完成验证绑定')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#/devices')
  })

  it('does not reuse creator verification after switching to recipient mode', async () => {
    const mark = {
      eventId: 'mode-race-mark-event',
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
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: mark.deviceId,
      deviceType: 'ring',
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
    })
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    const creatorEntry = await screen.findByRole('button', { name: '进入记录引导' })
    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    fireEvent.click(creatorEntry)

    expect(window.location.hash).toBe('#/devices')
    expect(readDeviceInteractionHandoff(undefined, {
      now: Date.parse('2026-08-03T00:05:00.000Z'),
    })).toBeUndefined()
  })

  it('rejects a device bound to a different owner', async () => {
    const mark = {
      eventId: 'wrong-owner-mark-event',
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
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: mark.deviceId,
      deviceType: 'ring',
      ownerProof: { identityId: 'person-other', method: 'mock_code', value: 'LOOP-DEMO' },
    })
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      ownerId: 'person-mei',
      environment: { physicalSupported: true, permission: 'granted' },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('绑定不属于当前创建者')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(readDeviceInteractionHandoff(undefined, {
      now: Date.parse('2026-08-03T00:05:00.000Z'),
    })).toBeUndefined()
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
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: touch.deviceId,
      deviceType: 'ring',
      ownerProof: {
        identityId: 'person-mei',
        method: 'mock_code',
        value: 'LOOP-DEMO',
      },
    })
    await hardwareBridge.entrustDevice({
      deviceId: touch.deviceId,
      ownerProof: {
        identityId: 'person-mei',
        method: 'mock_code',
        value: 'LOOP-DEMO',
      },
      recipientProof: {
        identityId: 'person-lin',
        method: 'mock_confirmation',
        value: 'LOOP-DEMO',
      },
    })
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    expect(screen.getByText('我在')).toBeInTheDocument()
    expect(screen.getByText('Loop 提示 · 来源会始终标明')).toBeInTheDocument()

    act(() => harness.publish(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', { event: touch })],
    })))

    expect(await screen.findByRole('dialog', { name: '为一段陪伴留出入口' })).toBeInTheDocument()
    expect(screen.getByText(/源自 Alloop Ring · 实体设备/)).toBeInTheDocument()
    expect(screen.getByText('一段经过托付的内容可以由你决定是否打开。')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/devices')

    fireEvent.click(screen.getByRole('button', { name: '确认这是给我的' }))
    await waitFor(() => expect(window.location.hash).toBe('#/recipient/verify'))
  })

  it('allows recipient verification to recover after a temporary trigger failure', async () => {
    const touch = interactionEvent('retry-trigger-touch-event', 'touch')
    const harness = createRuntimeHarness(snapshot({
      phase: 'connected',
      devices: [device('ring', 'connected')],
    }))
    const hardwareBridge = await createEntrustedHardwareBridge(touch.deviceId)
    const trigger = vi.spyOn(hardwareBridge, 'trigger')
      .mockRejectedValueOnce(new Error('temporary bridge failure'))
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    act(() => harness.publish(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', { event: touch })],
    })))

    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(isDeviceInteractionProcessed(touch.eventId)).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '重试验证' }))

    expect(await screen.findByRole('dialog', { name: '为一段陪伴留出入口' })).toBeInTheDocument()
    expect(trigger).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not complete a recipient handoff after switching mode during consumption', async () => {
    const touch = interactionEvent('mode-switch-during-consume-event', 'touch')
    const harness = createRuntimeHarness(snapshot({
      phase: 'connected',
      devices: [device('ring', 'connected')],
    }))
    const hardwareBridge = await createEntrustedHardwareBridge(touch.deviceId)
    const originalConsume = hardwareBridge.consume.bind(hardwareBridge)
    let releaseConsume!: () => void
    let notifyStarted!: () => void
    const consumeStarted = new Promise<void>((resolve) => {
      notifyStarted = resolve
    })
    const consumeBlocked = new Promise<void>((resolve) => {
      releaseConsume = resolve
    })
    vi.spyOn(hardwareBridge, 'consume').mockImplementationOnce(async (eventId) => {
      notifyStarted()
      await consumeBlocked
      return originalConsume(eventId)
    })
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    act(() => harness.publish(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', { event: touch })],
    })))
    await screen.findByRole('dialog', { name: '为一段陪伴留出入口' })
    fireEvent.click(screen.getByRole('button', { name: '确认这是给我的' }))
    await consumeStarted
    fireEvent.click(screen.getByRole('radio', { name: '记录这一刻' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await act(async () => {
      releaseConsume()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(window.location.hash).toBe('#/devices')
    expect(readDeviceInteractionHandoff()).toBeUndefined()
  })

  it('defers without processing and offers the same event after remount', async () => {
    const mark = interactionEvent('deferred-mark-event', 'mark_moment')
    const harness = createRuntimeHarness(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', { event: mark })],
    }))
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: mark.deviceId,
      deviceType: 'ring',
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
    })
    const props = {
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' as const },
    }
    const firstRender = renderCenter(props)

    const dialog = await screen.findByRole('dialog', { name: '为这一刻留个位置' })
    fireEvent.click(within(dialog).getByRole('button', { name: '稍后' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(isDeviceInteractionProcessed(mark.eventId)).toBe(false)

    firstRender.unmount()
    renderCenter(props)
    expect(await screen.findByRole('dialog', { name: '为这一刻留个位置' })).toBeInTheDocument()
  })

  it('keeps keyboard focus and Escape inside a busy prompt with no enabled buttons', async () => {
    const touch = interactionEvent('busy-prompt-touch-event', 'touch')
    const harness = createRuntimeHarness(snapshot({
      phase: 'connected',
      devices: [device('ring', 'connected')],
    }))
    const hardwareBridge = await createEntrustedHardwareBridge(touch.deviceId)
    const originalConsume = hardwareBridge.consume.bind(hardwareBridge)
    let releaseConsume!: () => void
    const consumeBlocked = new Promise<void>((resolve) => {
      releaseConsume = resolve
    })
    vi.spyOn(hardwareBridge, 'consume').mockImplementationOnce(async (eventId) => {
      await consumeBlocked
      return originalConsume(eventId)
    })
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    act(() => harness.publish(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', { event: touch })],
    })))
    const dialog = await screen.findByRole('dialog', { name: '为一段陪伴留出入口' })
    fireEvent.click(within(dialog).getByRole('button', { name: '确认这是给我的' }))
    await waitFor(() => expect(dialog).toHaveAttribute('aria-busy', 'true'))
    expect(within(dialog).getAllByRole('button').every((button) => button.hasAttribute('disabled')))
      .toBe(true)

    const outsideControl = screen.getByRole('radio', { name: '记录这一刻' })
    outsideControl.focus()
    expect(outsideControl).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(dialog).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: '为一段陪伴留出入口' })).toBeInTheDocument()

    await act(async () => {
      releaseConsume()
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  it('keeps the recipient prompt open when bridge consumption fails', async () => {
    const touch = {
      eventId: 'consume-failure-touch-event',
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
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: touch.deviceId,
      deviceType: 'ring',
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
    })
    await hardwareBridge.entrustDevice({
      deviceId: touch.deviceId,
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
      recipientProof: { identityId: 'person-lin', method: 'mock_confirmation', value: 'LOOP-DEMO' },
    })
    vi.spyOn(hardwareBridge, 'consume').mockRejectedValueOnce(new Error('bridge unavailable'))
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    act(() => harness.publish(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', { event: touch })],
    })))
    await screen.findByRole('dialog', { name: '为一段陪伴留出入口' })
    fireEvent.click(screen.getByRole('button', { name: '确认这是给我的' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('设备事件未能完成确认，请重试')
    expect(screen.getByRole('dialog', { name: '为一段陪伴留出入口' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/devices')
    expect(readDeviceInteractionHandoff()).toBeUndefined()
    expect(isDeviceInteractionProcessed(touch.eventId)).toBe(false)
  })

  it('clears the pending handoff on consent revocation without replaying the old event', async () => {
    const mark = {
      eventId: 'revoked-mark-event',
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
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: mark.deviceId,
      deviceType: 'ring',
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
    })
    writeDeviceInteractionHandoff({
      version: 2,
      purpose: 'creator_capture',
      eventId: mark.eventId,
      interaction: mark.interaction,
      deviceId: mark.deviceId,
      deviceName: 'Alloop Ring',
      source: mark.source,
      occurredAt: mark.occurredAt,
      verification: 'binding_verified',
      ownerId: 'person-mei',
      sessionId: mark.sessionId,
    }, Date.parse('2026-08-03T00:05:00.000Z'))
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    await screen.findByRole('dialog', { name: '为这一刻留个位置' })
    fireEvent.click(screen.getByRole('checkbox', { name: '允许设备触碰事件' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(readDeviceInteractionHandoff()).toBeUndefined()
    expect(isDeviceInteractionProcessed(mark.eventId)).toBe(true)

    fireEvent.click(screen.getByRole('checkbox', { name: '允许设备触碰事件' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not navigate when consent is revoked during recipient consumption', async () => {
    const touch = {
      eventId: 'revoked-during-consume-event',
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
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: touch.deviceId,
      deviceType: 'ring',
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
    })
    await hardwareBridge.entrustDevice({
      deviceId: touch.deviceId,
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
      recipientProof: { identityId: 'person-lin', method: 'mock_confirmation', value: 'LOOP-DEMO' },
    })
    const originalConsume = hardwareBridge.consume.bind(hardwareBridge)
    let releaseConsume: (() => void) | undefined
    vi.spyOn(hardwareBridge, 'consume').mockImplementationOnce(async (eventId) => {
      await new Promise<void>((resolve) => {
        releaseConsume = resolve
      })
      return originalConsume(eventId)
    })
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      environment: { physicalSupported: true, permission: 'granted' },
    })

    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    act(() => harness.publish(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', { event: touch })],
    })))
    await screen.findByRole('dialog', { name: '为一段陪伴留出入口' })
    fireEvent.click(screen.getByRole('button', { name: '确认这是给我的' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '允许设备触碰事件' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await act(async () => {
      releaseConsume?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(window.location.hash).toBe('#/devices')
    expect(readDeviceInteractionHandoff()).toBeUndefined()
    expect(isDeviceInteractionProcessed(touch.eventId)).toBe(true)
  })

  it('does not open a recipient prompt when the entrusted identity is different', async () => {
    const touch = {
      eventId: 'wrong-recipient-touch-event',
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
    const hardwareBridge = new MockHardwareBridge()
    await hardwareBridge.bindDevice({
      deviceId: touch.deviceId,
      deviceType: 'ring',
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
    })
    await hardwareBridge.entrustDevice({
      deviceId: touch.deviceId,
      ownerProof: { identityId: 'person-mei', method: 'mock_code', value: 'LOOP-DEMO' },
      recipientProof: { identityId: 'person-other', method: 'mock_confirmation', value: 'LOOP-DEMO' },
    })
    renderCenter({
      runtime: harness.runtime,
      hardwareBridge,
      recipientId: 'person-lin',
      environment: { physicalSupported: true, permission: 'granted' },
    })

    fireEvent.click(screen.getByRole('radio', { name: '接收陪伴' }))
    act(() => harness.publish(snapshot({
      phase: 'connected',
      consent: { audioCapture: false, sensitiveTelemetryExport: false, interactionEvents: true },
      devices: [device('ring', 'connected', { event: touch })],
    })))

    expect(await screen.findByRole('alert')).toHaveTextContent('未通过设备托付与接收者身份验证')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#/devices')
  })
})
