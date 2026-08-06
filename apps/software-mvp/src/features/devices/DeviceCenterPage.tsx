import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react'
import type { DeviceCapabilityReport } from '../../devices/contracts'
import type { HardwareBridge } from '../../adapters/hardware'
import type { DeviceInteractionProfileProvenance } from '../../domain'
import type {
  DeviceRuntime,
  RuntimeDeviceSnapshot,
  RuntimeLatestValue,
  RuntimeSnapshot,
} from '../../devices/runtime'
import {
  capabilityLabels,
  capabilityOrder,
  connectionLabel,
  devicesByKind,
  findPendingDeviceEvent,
  freshnessFor,
  freshnessLabel,
  observedTime,
  signalLabel,
  sourceLabel,
  type DeviceKind,
  type PendingDeviceEvent,
} from './deviceCenterSelectors'
import {
  advanceDeterministicSimulator,
  getDefaultDeviceCenterEnvironment,
  getDeterministicSimulatorRuntime,
  getPhysicalDeviceRuntime,
} from './deviceCenterRuntime'
import { simulatorBridge } from '../hardware/simulatorStore'
import {
  clearDeviceInteractionHandoff,
  isDeviceInteractionProcessed,
  markDeviceInteractionProcessed,
  readDeviceInteractionHandoff,
  writeDeviceInteractionHandoff,
  type DeviceInteractionDisposition,
} from './deviceInteractionHandoff'
import './deviceCenter.css'

type PermissionState =
  | 'loading'
  | 'unsupported'
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'restricted'

export interface DeviceCenterEnvironment {
  physicalSupported: boolean
  permission: PermissionState
  bluetoothPowered?: boolean
  appState?: 'foreground' | 'background' | 'resuming'
  openSettings?: () => void
  refreshBluetoothState?: () => Promise<{ bluetoothPowered?: boolean }>
}

export interface DeviceCenterPageProps {
  runtime?: DeviceRuntime
  environment?: DeviceCenterEnvironment
  simulator?: {
    runtime: DeviceRuntime
    advance?(kind: 'omi' | 'ring'): void
  }
  hardwareBridge?: HardwareBridge
  ownerId?: string
  recipientId?: string
  now?: () => number
}

type RoleMode = 'creator' | 'recipient'
type DeviceCenterAppState = NonNullable<DeviceCenterEnvironment['appState']>

function documentIsHidden() {
  return document.visibilityState === 'hidden'
}

function interactionProfile(
  event: PendingDeviceEvent['event'],
): DeviceInteractionProfileProvenance | undefined {
  const value = (event as unknown as { provenance?: unknown }).provenance
  if (value === null || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.profileId !== 'string' ||
    candidate.profileId.trim() === '' ||
    typeof candidate.sourceReference !== 'string' ||
    candidate.sourceReference.trim() === '' ||
    (candidate.validation !== 'fixture_only' &&
      candidate.validation !== 'physical_device')
  ) return undefined
  return {
    profileId: candidate.profileId,
    sourceReference: candidate.sourceReference,
    validation: candidate.validation,
    ...(typeof candidate.model === 'string' && candidate.model.trim() !== ''
      ? { model: candidate.model }
      : {}),
    ...(typeof candidate.firmware === 'string' && candidate.firmware.trim() !== ''
      ? { firmware: candidate.firmware }
      : {}),
  }
}

function interactionSequence(event: PendingDeviceEvent['event']) {
  const value = (event as unknown as { sessionSequence?: unknown }).sessionSequence
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined
}

const metricLabels: Readonly<Record<string, string>> = {
  heart_rate: '心率',
  rr_hrv: '心率变异',
  spo2: '血氧数据',
  temperature: '温度',
  steps_activity: '活动量',
  battery: '电量',
}

function useRuntimeSnapshot(runtime: DeviceRuntime) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getServerSnapshot,
  )

  useEffect(() => {
    void runtime.ready()
  }, [runtime])

  return snapshot
}

function capabilityStatusLabel(
  status: DeviceCapabilityReport[keyof DeviceCapabilityReport]['status'],
) {
  switch (status) {
    case 'implemented':
      return '可用'
    case 'requires_real_device':
      return '需要真机验证'
    case 'requires_vendor_profile':
      return '等待设备协议'
  }
}

function formatMetricValue(value: RuntimeLatestValue) {
  const rendered = Array.isArray(value.value)
    ? `${value.value.length} 项`
    : typeof value.value === 'boolean'
      ? value.value ? '是' : '否'
      : String(value.value)
  return value.unit === undefined ? rendered : `${rendered} ${value.unit}`
}

function RoleModeControl({ mode, onChange }: { mode: RoleMode; onChange(mode: RoleMode): void }) {
  return (
    <fieldset className="device-mode">
      <legend>触碰后的动作</legend>
      <div className="device-mode__options">
        <label>
          <input
            checked={mode === 'creator'}
            name="device-role-mode"
            onChange={() => onChange('creator')}
            type="radio"
          />
          <span>记录这一刻</span>
        </label>
        <label>
          <input
            checked={mode === 'recipient'}
            name="device-role-mode"
            onChange={() => onChange('recipient')}
            type="radio"
          />
          <span>接收陪伴</span>
        </label>
      </div>
      <p>
        这个选择只决定触碰后出现哪一种邀请，不会改变内容归属，也不会授予录音或播放权限。
      </p>
    </fieldset>
  )
}

interface BluetoothGateProps {
  environment: DeviceCenterEnvironment
  permission: PermissionState
  runtime: DeviceRuntime
  snapshot: RuntimeSnapshot
  simulated: boolean
  onPermissionChange(permission: PermissionState): void
  onBluetoothPoweredChange(powered: boolean): void
  onError(message?: string): void
}

function BluetoothGate({
  environment,
  permission,
  runtime,
  snapshot,
  simulated,
  onPermissionChange,
  onBluetoothPoweredChange,
  onError,
}: BluetoothGateProps) {
  const visibleDevices = snapshot.devices.filter((device) =>
    device.matchedAdapterIds.length > 0,
  )

  const scan = async () => {
    onError(undefined)
    const result = await runtime.scan({ timeoutMs: 10_000 })
    if (result.ok) {
      if (!simulated) {
        onPermissionChange('granted')
        onBluetoothPoweredChange(true)
      }
      return
    }
    if (result.error.code === 'permission_denied') {
      onPermissionChange('denied')
      return
    }
    if (result.error.code === 'powered_off') {
      onPermissionChange('granted')
      onBluetoothPoweredChange(false)
      return
    }
    onError('扫描没有完成。你可以重试，或在诊断信息中查看安全错误代码。')
  }

  const openSettings = () => {
    if (environment.openSettings !== undefined) {
      environment.openSettings()
      return
    }
    onError('请在系统设置中为 Loop 开启蓝牙权限，然后返回这里重试。')
  }

  let message = '可以开始查找附近设备'
  let description = '扫描只在前台进行，不会承诺后台持续监听。'
  let action: React.ReactNode = (
    <button className="button button--primary" onClick={() => void scan()} type="button">
      扫描设备
    </button>
  )

  if (simulated) {
    if (snapshot.discoveryActive) {
      message = '正在准备演示设备'
      description = '演示数据来自可重复的本地场景，不代表真机验证。'
      action = (
        <button className="button button--secondary" onClick={() => void runtime.cancelScan()} type="button">
          停止扫描
        </button>
      )
    } else if (visibleDevices.length > 0) {
      message = `找到 ${visibleDevices.length} 台演示设备`
      description = '你可以独立连接 OMI 和智能戒指。'
      action = (
        <button className="button button--secondary" onClick={() => void scan()} type="button">
          重新载入演示数据
        </button>
      )
    } else {
      message = '演示设备尚未载入'
      action = (
        <button className="button button--primary" onClick={() => void scan()} type="button">
          载入演示设备
        </button>
      )
    }
  } else if (snapshot.phase === 'opening' || permission === 'loading') {
    message = '正在读取本机设备状态'
    description = '完成前不会请求权限或开始扫描。'
    action = null
  } else if (!environment.physicalSupported || permission === 'unsupported') {
    message = '此环境不能扫描蓝牙设备'
    description = '浏览器和 iOS 模拟器不能代替实体设备验证，你仍可使用演示数据查看流程。'
    action = null
  } else if (environment.appState === 'background') {
    message = '扫描已暂停'
    description = '回到前台后再继续查找设备。'
    action = null
  } else if (environment.appState === 'resuming') {
    message = '正在恢复设备状态'
    description = '正在重新核对权限与已知连接。'
    action = null
  } else if (permission === 'prompt') {
    message = '需要蓝牙权限才能查找附近设备'
    description = 'Loop 只会在你继续后发起一次系统权限请求。'
    action = (
      <button className="button button--primary" onClick={() => void scan()} type="button">
        继续并允许蓝牙
      </button>
    )
  } else if (permission === 'denied') {
    message = '蓝牙权限未开启'
    description = 'Loop 不会反复弹出系统请求。你可以前往设置，或改用演示数据。'
    action = (
      <button className="button button--secondary" onClick={openSettings} type="button">
        前往设置
      </button>
    )
  } else if (permission === 'restricted') {
    message = '此设备限制了蓝牙权限'
    description = '限制可能来自系统或设备管理设置。'
    action = (
      <button className="button button--secondary" onClick={openSettings} type="button">
        查看设置
      </button>
    )
  } else if (environment.bluetoothPowered === false) {
    message = '蓝牙已关闭'
    description = '已知设备会保留，但需要打开蓝牙才能重新连接。'
    action = (
      <button className="button button--secondary" onClick={openSettings} type="button">
        打开系统设置
      </button>
    )
  } else if (snapshot.discoveryActive) {
    message = visibleDevices.length === 0
      ? '正在查找附近设备'
      : `找到 ${visibleDevices.length} 台设备`
    description = '结果会保留在各自的设备区域中。'
    action = (
      <button className="button button--secondary" onClick={() => void runtime.cancelScan()} type="button">
        停止扫描
      </button>
    )
  } else if (snapshot.scanGeneration > 0 && visibleDevices.length === 0) {
    message = '没有找到可用的 OMI 或戒指'
    description = '确认设备靠近、已充电且可被发现，然后重新扫描。'
    action = (
      <button className="button button--primary" onClick={() => void scan()} type="button">
        重新扫描
      </button>
    )
  } else if (visibleDevices.length > 0) {
    message = `${visibleDevices.length} 台设备可用`
    description = 'OMI 与智能戒指可以分别连接或断开。'
  }

  const busy = snapshot.phase === 'opening' || snapshot.discoveryActive
  return (
    <section className="bluetooth-gate" aria-busy={busy} aria-labelledby="bluetooth-heading">
      <div>
        <p className="device-kicker">蓝牙与前台状态</p>
        <h2 id="bluetooth-heading">{message}</h2>
        <p>{description}</p>
      </div>
      {action}
    </section>
  )
}

function CapabilityList({ capabilities }: { capabilities: DeviceCapabilityReport }) {
  return (
    <dl className="capability-list">
      {capabilityOrder.map((capabilityId) => {
        const capability = capabilities[capabilityId]
        return (
          <div key={capabilityId}>
            <dt>{capabilityLabels[capabilityId]}</dt>
            <dd>
              <strong>{capabilityStatusLabel(capability.status)}</strong>
              {'reason' in capability && <span>{capability.reason}</span>}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function LiveData({ device, kind, now }: { device: RuntimeDeviceSnapshot; kind: DeviceKind; now: number }) {
  if (kind === 'omi') {
    return (
      <div className="device-empty-value">
        <strong>未在录音</strong>
        <span>连接音频能力不会自动开始录音、转写、保存或播放。</span>
      </div>
    )
  }

  const values = Object.values(device.latestValues).filter(
    (value) => value.privacy === 'normalized',
  )
  if (values.length === 0) {
    return (
      <div className="device-empty-value">
        <strong>暂无数据</strong>
        <span>未观察到的数值不会用 0 或“正常”代替。</span>
      </div>
    )
  }

  return (
    <>
      <dl className="device-values">
        {values.map((value) => {
          const freshness = device.phase === 'connected' ? freshnessFor(value, now) : 'stale'
          return (
            <div key={value.name} className={freshness === 'stale' ? 'is-stale' : undefined}>
              <dt>{metricLabels[value.name] ?? value.name}</dt>
              <dd>
                <strong>{formatMetricValue(value)}</strong>
                <span>{freshnessLabel(freshness)}</span>
                <time dateTime={value.occurredAt}>{observedTime(value.occurredAt)}</time>
                <span className="source-badge">{sourceLabel(value.source)}</span>
              </dd>
            </div>
          )
        })}
      </dl>
      <p className="weak-context-note">弱情境 · 不用于判断情绪、悲伤或健康</p>
    </>
  )
}

interface DeviceCardProps {
  device: RuntimeDeviceSnapshot
  kind: DeviceKind
  runtime: DeviceRuntime
  audioConsent: boolean
  now: number
  onError(message?: string): void
  onConnected?(): void
  onAdvance?(): void
}

function DeviceCard({
  device,
  kind,
  runtime,
  audioConsent,
  now,
  onError,
  onConnected,
  onAdvance,
}: DeviceCardProps) {
  const headingId = useId()
  const name = device.discovered.displayName ?? (kind === 'omi' ? '未命名 OMI' : '未命名戒指')
  const simulated = device.discovered.transportKind === 'simulated'
  const connect = async () => {
    onError(undefined)
    const result = await runtime.connect(
      device.deviceKey,
      kind === 'omi' ? { consent: { audioCapture: audioConsent } } : {},
    )
    const current = runtime.getSnapshot().devices.find(
      (entry) => entry.deviceKey === device.deviceKey,
    )
    if (!result.ok && current?.phase !== 'connected') {
      onError('暂时无法连接这台设备。请重试，安全错误代码已写入诊断信息。')
      return
    }
    if (result.ok) onConnected?.()
  }
  const reconnect = async () => {
    onError(undefined)
    await runtime.reconnect(
      device.deviceKey,
      kind === 'omi' ? { consent: { audioCapture: audioConsent } } : {},
    )
  }

  let action: React.ReactNode
  switch (device.phase) {
    case 'discovered':
    case 'disconnected':
      action = (
        <button
          className="button button--primary device-card__action"
          disabled={kind === 'omi' && !audioConsent}
          onClick={() => void connect()}
          type="button"
        >
          连接 {name}
        </button>
      )
      break
    case 'connecting':
      action = <button className="button device-card__action" disabled type="button">连接中</button>
      break
    case 'connected':
      action = (
        <button
          className="button button--secondary device-card__action"
          onClick={() => void runtime.disconnect(device.deviceKey)}
          type="button"
        >
          断开 {name}
        </button>
      )
      break
    case 'disconnecting':
      action = <button className="button device-card__action" disabled type="button">断开中</button>
      break
    case 'reconnecting':
      action = <button className="button device-card__action" disabled type="button">重新连接中</button>
      break
    case 'failed':
      action = (
        <button
          className="button button--primary device-card__action"
          onClick={() => void reconnect()}
          type="button"
        >
          重新连接 {name}
        </button>
      )
      break
  }

  return (
    <article className="device-card">
      <div className="device-card__row">
        <div className="device-card__identity">
          <div className="device-card__name-line">
            <h3>{name}</h3>
            {simulated && <span className="source-badge">演示数据</span>}
          </div>
          <p>{kind === 'omi' ? '音频穿戴设备' : '智能戒指'}</p>
          <strong className={`connection-state connection-state--${device.phase}`}>
            {connectionLabel(device)}
          </strong>
        </div>
        {action}
      </div>

      {device.capabilities !== undefined && (
        <div className="device-card__detail">
          <section aria-labelledby={`${headingId}-capabilities`}>
            <p className="device-kicker">设备能力</p>
            <h4 id={`${headingId}-capabilities`}>已观察到的支持范围</h4>
            <CapabilityList capabilities={device.capabilities} />
          </section>
          <section aria-labelledby={`${headingId}-live`}>
            <p className="device-kicker">实时数据</p>
            <h4 id={`${headingId}-live`}>{kind === 'omi' ? '音频状态' : '最近观察值'}</h4>
            <LiveData device={device} kind={kind} now={now} />
          </section>
          <section aria-labelledby={`${headingId}-status`}>
            <p className="device-kicker">连接信息</p>
            <h4 id={`${headingId}-status`}>设备状态</h4>
            <dl className="device-status-list">
              <div>
                <dt>来源</dt>
                <dd>{simulated ? '确定性演示场景' : '实体设备 · 尚需真机验证'}</dd>
              </div>
              <div>
                <dt>信号</dt>
                <dd>
                  {device.discovered.signalStrength === undefined
                    ? '暂无数据'
                    : `${device.discovered.signalStrength} dBm · ${signalLabel(device.discovered.signalStrength)}`}
                </dd>
              </div>
              <div>
                <dt>传输</dt>
                <dd>{simulated ? '本地模拟' : '低功耗蓝牙'}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
      {simulated && device.phase === 'connected' && onAdvance !== undefined && (
        <button
          className="text-button device-card__demo-action"
          onClick={onAdvance}
          type="button"
        >
          发送下一个演示事件
        </button>
      )}
    </article>
  )
}

interface DeviceSlotProps {
  kind: DeviceKind
  snapshot: RuntimeSnapshot
  runtime: DeviceRuntime
  now: number
  onError(message?: string): void
  onConnected?(): void
  onAdvance?(): void
}

function DeviceSlot({ kind, snapshot, runtime, now, onError, onConnected, onAdvance }: DeviceSlotProps) {
  const heading = kind === 'omi' ? 'OMI' : '智能戒指'
  const devices = devicesByKind(snapshot, kind)
  return (
    <section className="device-slot" aria-labelledby={`${kind}-slot-heading`}>
      <div className="device-slot__heading">
        <div>
          <p className="device-kicker">{kind === 'omi' ? '音频来源' : '触碰与弱情境'}</p>
          <h2 id={`${kind}-slot-heading`}>{heading}</h2>
        </div>
        <span>{devices.filter((device) => device.phase === 'connected').length} 台已连接</span>
      </div>
      {devices.length === 0 ? (
        <div className="device-slot__empty">
          <p>{kind === 'omi' ? '尚未发现 OMI。' : '尚未发现智能戒指。'}</p>
          <span>扫描后，可用设备会出现在这里。</span>
        </div>
      ) : devices.map((device) => (
        <DeviceCard
          audioConsent={snapshot.consent.audioCapture}
          device={device}
          key={device.deviceKey}
          kind={kind}
          now={now}
          onError={onError}
          onConnected={onConnected}
          onAdvance={onAdvance}
          runtime={runtime}
        />
      ))}
    </section>
  )
}

function ConsentSummary({
  audioConsent,
  interactionConsent,
  mode,
  runtime,
  onInteractionConsentChange,
  onError,
}: {
  audioConsent: boolean
  interactionConsent: boolean
  mode: RoleMode
  runtime: DeviceRuntime
  onInteractionConsentChange(checked: boolean): void
  onError(message?: string): void
}) {
  const changeAudioConsent = async (checked: boolean) => {
    onError(undefined)
    const result = await runtime.setConsent({ audioCapture: checked })
    if (!result.ok) onError('音频连接同意状态未能保存，请重试。')
  }
  const changeInteractionConsent = async (checked: boolean) => {
    onError(undefined)
    const result = await runtime.setConsent({ interactionEvents: checked })
    if (!result.ok) {
      onError('触碰事件同意状态未能保存，请重试。')
      return
    }
    onInteractionConsentChange(checked)
  }
  return (
    <section className="consent-summary" aria-labelledby="consent-heading">
      <div>
        <p className="device-kicker">同意与交接</p>
        <h2 id="consent-heading">每一步都由人发起</h2>
        <p>蓝牙连接、音频来源、内容播放和分享是彼此独立的决定。</p>
      </div>
      <label className="consent-check">
        <input
          aria-label="允许 OMI 音频连接"
          checked={audioConsent}
          onChange={(event) => void changeAudioConsent(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>
          <strong>允许 OMI 音频连接</strong>
          <small>这只允许建立音频能力连接，不会开始录音或保存内容。</small>
        </span>
      </label>
      <label className="consent-check">
        <input
          aria-label="允许设备触碰事件"
          checked={interactionConsent}
          onChange={(event) => void changeInteractionConsent(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>
          <strong>允许设备触碰事件</strong>
          <small>事件只能创建待确认入口，不能授予录音、播放、拍摄或内容访问权限。</small>
        </span>
      </label>
      <dl className="consent-policies">
        <div><dt>麦克风</dt><dd>仅在你点击开始录音时询问</dd></div>
        <div><dt>自动播放</dt><dd>关闭</dd></div>
        <div><dt>分享</dt><dd>每次确认</dd></div>
      </dl>
      {mode === 'recipient' && (
        <div className="identity-cue" aria-label="Loop 身份提示">
          <strong>我在</strong>
          <span>Loop 提示 · 来源会始终标明</span>
        </div>
      )}
    </section>
  )
}

function DiagnosticsDisclosure({ snapshot, simulated }: { snapshot: RuntimeSnapshot; simulated: boolean }) {
  return (
    <details className="device-diagnostics">
      <summary>
        <span>诊断信息</span>
        <small>{snapshot.diagnostics.length} 条安全记录</small>
      </summary>
      <div className="device-diagnostics__body">
        <p>设备标识、会话标识、原始音频、数据包和生理历史均已隐藏。</p>
        {snapshot.diagnostics.length === 0 ? (
          <p>暂无诊断记录。</p>
        ) : (
          <ul>
            {snapshot.diagnostics.map((diagnostic) => (
              <li key={diagnostic.diagnosticId}>
                <div>
                  <strong>{diagnostic.operation}</strong>
                  {diagnostic.code !== undefined && <code>{diagnostic.code}</code>}
                </div>
                <span>{diagnostic.phase} · {observedTime(diagnostic.occurredAt)}</span>
                <small>{simulated ? '演示验证' : '尚需实体设备验证'}</small>
              </li>
            ))}
          </ul>
        )}
        <a href="#/hardware-simulator">打开开发者触发实验室</a>
      </div>
    </details>
  )
}

function PendingHardwarePrompt({
  pending,
  mode,
  busy,
  onDefer,
  onDismiss,
  onEnter,
}: {
  pending: PendingDeviceEvent
  mode: RoleMode
  busy: boolean
  onDefer(): void
  onDismiss(): void
  onEnter(): void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const creator = mode === 'creator'
  const title = creator ? '为这一刻留个位置' : '为一段陪伴留出入口'
  const description = creator
    ? '戒指记录到一次标记。要为这一刻留个位置吗？'
    : '一段经过托付的内容可以由你决定是否打开。'
  const deviceName = pending.device.discovered.displayName ?? '已连接设备'

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previousFocus.current?.focus()
  }, [])

  useEffect(() => {
    if (busy) dialogRef.current?.focus()
  }, [busy])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (!busy) onDefer()
      return
    }
    if (event.key !== 'Tab') return
    if (busy) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled])',
    )
    if (controls === undefined || controls.length === 0) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="pending-prompt" role="presentation">
      <div
        aria-describedby="pending-prompt-description"
        aria-labelledby="pending-prompt-title"
        aria-modal="true"
        aria-busy={busy}
        className="pending-prompt__sheet"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="关闭提示"
          className="pending-prompt__close"
          onClick={onDefer}
          ref={closeRef}
          title="关闭提示"
          type="button"
          disabled={busy}
        >
          关闭
        </button>
        <p className="device-kicker">{creator ? '记录这一刻' : '接收陪伴'}</p>
        <h2 id="pending-prompt-title">{title}</h2>
        <p id="pending-prompt-description">{description}</p>
        <p className="pending-prompt__source">
          源自 {deviceName} · {sourceLabel(pending.event.source)} · {observedTime(pending.event.occurredAt)}
        </p>
        <p className="pending-prompt__safety">没有录音、拍摄、播放或分享会自动开始。</p>
        <p aria-live="polite" className="sr-only" role="status">
          {busy ? '正在确认设备事件' : ''}
        </p>
        <div className="pending-prompt__actions">
          <button className="button button--primary" disabled={busy} onClick={onEnter} type="button">
            {creator ? '进入记录引导' : '确认这是给我的'}
          </button>
          <button className="button button--secondary" disabled={busy} onClick={onDefer} type="button">稍后</button>
          <button className="text-button" disabled={busy} onClick={onDismiss} type="button">忽略</button>
        </div>
      </div>
    </div>
  )
}

export function DeviceCenterPage({
  runtime: injectedRuntime,
  environment = getDefaultDeviceCenterEnvironment(),
  simulator,
  hardwareBridge = simulatorBridge,
  ownerId = 'person-mei',
  recipientId = 'person-lin',
  now = Date.now,
}: DeviceCenterPageProps = {}) {
  const physicalRuntime = injectedRuntime ?? getPhysicalDeviceRuntime()
  const demoRuntime = simulator?.runtime ?? getDeterministicSimulatorRuntime()
  const advanceSimulator = simulator?.advance ?? advanceDeterministicSimulator
  const [simulationEnabled, setSimulationEnabled] = useState(false)
  const [permission, setPermission] = useState<PermissionState>(environment.permission)
  const [bluetoothPowered, setBluetoothPowered] = useState(environment.bluetoothPowered)
  const [mode, setMode] = useState<RoleMode>('creator')
  const [verifiedPending, setVerifiedPending] = useState<{
    mode: RoleMode
    ownerId: string
    pending: PendingDeviceEvent
    verification: 'binding_verified' | 'entrustment_verified'
  }>()
  const [pendingActionEventId, setPendingActionEventId] = useState<string>()
  const [deferredEventIds, setDeferredEventIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [verificationRetryEventId, setVerificationRetryEventId] = useState<string>()
  const [verificationAttempt, setVerificationAttempt] = useState(0)
  const [actionError, setActionError] = useState<string>()
  const [currentTime, setCurrentTime] = useState(() => now())
  const [appState, setAppState] = useState<DeviceCenterAppState>(() =>
    environment.appState ?? (documentIsHidden() ? 'background' : 'foreground'),
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const refreshBluetoothStateRef = useRef(environment.refreshBluetoothState)
  const operationGenerationRef = useRef(0)
  const runtime = simulationEnabled ? demoRuntime : physicalRuntime
  const snapshot = useRuntimeSnapshot(runtime)
  const pending = findPendingDeviceEvent(snapshot)
  const visiblePending = verifiedPending !== undefined &&
    verifiedPending.mode === mode &&
    verifiedPending.ownerId === ownerId &&
    !deferredEventIds.has(verifiedPending.pending.event.eventId) &&
    !isDeviceInteractionProcessed(verifiedPending.pending.event.eventId)
    ? verifiedPending
    : undefined
  const connectedCount = snapshot.devices.filter((device) => device.phase === 'connected').length

  useEffect(() => {
    operationGenerationRef.current += 1
    setPendingActionEventId(undefined)
    setVerificationRetryEventId(undefined)
    return () => {
      operationGenerationRef.current += 1
    }
  }, [
    hardwareBridge,
    mode,
    ownerId,
    recipientId,
    runtime,
    snapshot.consent.interactionEvents,
  ])

  useEffect(() => {
    setPermission(environment.permission)
  }, [environment.permission])

  useEffect(() => {
    setBluetoothPowered(environment.bluetoothPowered)
  }, [environment.bluetoothPowered])

  useEffect(() => {
    refreshBluetoothStateRef.current = environment.refreshBluetoothState
  }, [environment.refreshBluetoothState])

  useEffect(() => {
    setAppState(
      environment.appState ?? (documentIsHidden() ? 'background' : 'foreground'),
    )
  }, [environment.appState])

  useEffect(() => {
    let active = true
    const syncVisibility = async () => {
      if (documentIsHidden()) {
        setAppState('background')
        if (runtime.getSnapshot().discoveryActive) await runtime.cancelScan()
        return
      }

      setAppState('resuming')
      const refreshed = await refreshBluetoothStateRef.current?.()
      if (active && refreshed?.bluetoothPowered !== undefined) {
        setBluetoothPowered(refreshed.bluetoothPowered)
      }
      await runtime.ready()
      if (active && !documentIsHidden()) setAppState('foreground')
    }
    const handleVisibilityChange = () => {
      void syncVisibility()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    if (documentIsHidden()) void syncVisibility()
    return () => {
      active = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [runtime])

  useEffect(() => {
    document.title = '设备 | Loop'
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    setCurrentTime(now())
    const timer = window.setInterval(() => setCurrentTime(now()), 5_000)
    return () => window.clearInterval(timer)
  }, [now])

  useEffect(() => {
    if (
      pending === undefined ||
      deferredEventIds.has(pending.event.eventId) ||
      isDeviceInteractionProcessed(pending.event.eventId) ||
      !snapshot.consent.interactionEvents
    ) {
      setVerifiedPending(undefined)
      if (!snapshot.consent.interactionEvents) setPendingActionEventId(undefined)
      return
    }

    let active = true
    const operationGeneration = ++operationGenerationRef.current
    const operationIsCurrent = () =>
      active && operationGeneration === operationGenerationRef.current
    const verify = async () => {
      const binding = hardwareBridge.getBindings().find(
        (candidate) =>
          candidate.deviceId === pending.event.deviceId &&
          candidate.ownerId === ownerId,
      )
      if (mode === 'creator') {
        if (pending.event.interaction !== 'mark_moment' || binding === undefined) {
          if (operationIsCurrent()) {
            setVerificationRetryEventId(undefined)
            markDeviceInteractionProcessed({
              version: 1,
              eventId: pending.event.eventId,
              disposition: 'dismissed',
              processedAt: new Date(now()).toISOString(),
            })
            setVerifiedPending(undefined)
            setActionError('设备尚未完成验证绑定，或绑定不属于当前创建者。')
          }
          return
        }
        if (operationIsCurrent()) {
          setVerificationRetryEventId(undefined)
          setActionError(undefined)
          setVerifiedPending({
            mode,
            ownerId,
            pending,
            verification: 'binding_verified',
          })
        }
        return
      }

      if (pending.event.interaction !== 'touch' || binding === undefined) {
        if (operationIsCurrent()) {
          setVerificationRetryEventId(undefined)
          markDeviceInteractionProcessed({
            version: 1,
            eventId: pending.event.eventId,
            disposition: 'dismissed',
            processedAt: new Date(now()).toISOString(),
          })
          setVerifiedPending(undefined)
          setActionError('触碰事件与当前托付关系的设备绑定不匹配。')
        }
        return
      }

      let result: Awaited<ReturnType<HardwareBridge['trigger']>>
      try {
        result = await hardwareBridge.trigger({
          eventId: pending.event.eventId,
          deviceId: pending.event.deviceId,
          eventType: 'touch',
          recipientId,
          occurredAt: pending.event.occurredAt,
          allowFallback: pending.event.source === 'simulated',
          payload: { interaction: pending.event.interaction },
        })
      } catch {
        if (!operationIsCurrent()) return
        setVerifiedPending(undefined)
        setVerificationRetryEventId(pending.event.eventId)
        setActionError('设备事件验证暂时未完成。')
        return
      }
      if (!operationIsCurrent()) return
      if (
        (result.outcome !== 'accepted' && result.outcome !== 'duplicate') ||
        result.event.verificationStatus !== 'verified'
      ) {
        setVerificationRetryEventId(undefined)
        markDeviceInteractionProcessed({
          version: 1,
          eventId: pending.event.eventId,
          disposition: 'dismissed',
          processedAt: new Date(now()).toISOString(),
        })
        setVerifiedPending(undefined)
        setActionError('触碰事件未通过设备托付与接收者身份验证。')
        return
      }
      setVerificationRetryEventId(undefined)
      setActionError(undefined)
      setVerifiedPending({
        mode,
        ownerId,
        pending,
        verification: 'entrustment_verified',
      })
    }
    void verify()
    return () => {
      active = false
      if (operationGenerationRef.current === operationGeneration) {
        operationGenerationRef.current += 1
      }
    }
  }, [
    deferredEventIds,
    hardwareBridge,
    mode,
    now,
    ownerId,
    pending?.event.eventId,
    recipientId,
    runtime,
    snapshot.consent.interactionEvents,
    verificationAttempt,
  ])

  const toggleSimulation = async (enabled: boolean) => {
    if (
      enabled &&
      physicalRuntime.getSnapshot().devices.some((device) => device.phase === 'connected')
    ) {
      setActionError('请先断开实体设备，再切换到演示数据。')
      return
    }

    setActionError(undefined)
    operationGenerationRef.current += 1
    setSimulationEnabled(enabled)
    if (!enabled) return
    await demoRuntime.ready()
    const result = await demoRuntime.scan()
    if (!result.ok) setActionError('演示设备没有载入，请重试。')
  }

  const markProcessed = (
    eventId: string,
    disposition: DeviceInteractionDisposition,
  ) => {
    markDeviceInteractionProcessed({
      version: 1,
      eventId,
      disposition,
      processedAt: new Date(now()).toISOString(),
    })
  }

  const consumeRecipientInteraction = async (
    eventId: string,
    operationGeneration: number,
  ): Promise<'consumed' | 'failed' | 'stale'> => {
    try {
      await hardwareBridge.consume(eventId)
      return operationGeneration === operationGenerationRef.current
        ? 'consumed'
        : 'stale'
    } catch (error) {
      if (operationGeneration !== operationGenerationRef.current) return 'stale'
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('already been consumed')
      ) {
        return 'consumed'
      }
      if (runtime.getSnapshot().consent.interactionEvents) {
        setActionError('设备事件未能完成确认，请重试。')
      }
      return 'failed'
    }
  }

  const dismissPending = async () => {
    if (visiblePending === undefined || pendingActionEventId !== undefined) return
    const eventId = visiblePending.pending.event.eventId
    const operationGeneration = ++operationGenerationRef.current
    setPendingActionEventId(eventId)
    if (visiblePending.verification === 'entrustment_verified') {
      const result = await consumeRecipientInteraction(eventId, operationGeneration)
      if (result === 'stale') return
      if (result === 'failed') {
        setPendingActionEventId(undefined)
        return
      }
      if (!runtime.getSnapshot().consent.interactionEvents) {
        setPendingActionEventId(undefined)
        return
      }
    }
    markProcessed(eventId, 'dismissed')
    setActionError(undefined)
    setVerifiedPending(undefined)
    setPendingActionEventId(undefined)
  }

  const enterPending = async () => {
    if (visiblePending === undefined || pendingActionEventId !== undefined) return
    const {
      mode: verifiedMode,
      ownerId: verifiedOwnerId,
      pending: verified,
      verification,
    } = visiblePending
    if (mode !== verifiedMode || ownerId !== verifiedOwnerId) return
    const operationGeneration = ++operationGenerationRef.current
    setPendingActionEventId(verified.event.eventId)
    if (verifiedMode === 'recipient') {
      const result = await consumeRecipientInteraction(
        verified.event.eventId,
        operationGeneration,
      )
      if (result === 'stale') return
      if (result === 'failed') {
        setPendingActionEventId(undefined)
        return
      }
    }
    if (
      operationGeneration !== operationGenerationRef.current ||
      (verifiedMode === 'recipient' &&
        !runtime.getSnapshot().consent.interactionEvents)
    ) {
      setPendingActionEventId(undefined)
      return
    }
    const common = {
      version: 2 as const,
      eventId: verified.event.eventId,
      deviceId: verified.event.deviceId,
      deviceName: verified.device.discovered.displayName ?? '已验证设备',
      source: verified.event.source,
      occurredAt: verified.event.occurredAt,
      ownerId: verifiedOwnerId,
      sessionId: verified.event.sessionId,
      ...(interactionSequence(verified.event) === undefined
        ? {}
        : { sessionSequence: interactionSequence(verified.event) }),
      ...(interactionProfile(verified.event) === undefined
        ? {}
        : { profile: interactionProfile(verified.event) }),
    }
    const handoffWritten = verifiedMode === 'creator' && verification === 'binding_verified'
      ? writeDeviceInteractionHandoff({
          ...common,
          purpose: 'creator_capture',
          interaction: 'mark_moment',
          verification: 'binding_verified',
        }, now())
      : verifiedMode === 'recipient' && verification === 'entrustment_verified'
        ? writeDeviceInteractionHandoff({
            ...common,
            purpose: 'recipient_entry',
            interaction: 'touch',
            verification: 'entrustment_verified',
            recipientId,
          }, now())
        : false
    if (!handoffWritten) {
      markProcessed(verified.event.eventId, 'dismissed')
      setVerifiedPending(undefined)
      setPendingActionEventId(undefined)
      setActionError('设备事件已过期或来源证明不完整，请重新触碰设备。')
      return
    }
    markProcessed(
      verified.event.eventId,
      verifiedMode === 'creator' ? 'entered_creator' : 'entered_recipient',
    )
    setActionError(undefined)
    setVerifiedPending(undefined)
    setPendingActionEventId(undefined)
    window.location.hash = verifiedMode === 'creator' ? '#/capture/new' : '#/recipient/verify'
  }

  const deferPending = () => {
    if (visiblePending === undefined || pendingActionEventId !== undefined) return
    const eventId = visiblePending.pending.event.eventId
    operationGenerationRef.current += 1
    setDeferredEventIds((current) => new Set(current).add(eventId))
    setVerificationRetryEventId(undefined)
    setActionError(undefined)
    setVerifiedPending(undefined)
  }

  const retryVerification = () => {
    if (
      verificationRetryEventId === undefined ||
      pending?.event.eventId !== verificationRetryEventId ||
      !snapshot.consent.interactionEvents
    ) return
    operationGenerationRef.current += 1
    setVerificationRetryEventId(undefined)
    setActionError(undefined)
    setVerificationAttempt((attempt) => attempt + 1)
  }

  const handleInteractionConsentChange = (checked: boolean) => {
    if (checked) return
    operationGenerationRef.current += 1
    const eventId = visiblePending?.pending.event.eventId ?? pending?.event.eventId
    const handoff = readDeviceInteractionHandoff()
    if (handoff !== undefined) clearDeviceInteractionHandoff(handoff.eventId)
    if (eventId !== undefined) markProcessed(eventId, 'consent_revoked')
    setVerifiedPending(undefined)
    setPendingActionEventId(undefined)
  }

  const changeMode = (nextMode: RoleMode) => {
    operationGenerationRef.current += 1
    setVerifiedPending(undefined)
    setPendingActionEventId(undefined)
    setActionError(undefined)
    setMode(nextMode)
  }

  return (
    <div className="device-center">
      <header className="device-center__header">
        <div>
          <p className="eyebrow">OMI 与智能戒指</p>
          <h1 ref={headingRef} tabIndex={-1}>设备</h1>
          <p className="device-center__lead">连接、能力、同意和来源保持清楚分开。</p>
        </div>
        <div className="device-center__summary" aria-label="设备总览">
          <strong>{connectedCount} 台已连接</strong>
          <span>{simulationEnabled ? '演示数据开启' : '演示数据关闭'}</span>
        </div>
      </header>

      <RoleModeControl mode={mode} onChange={changeMode} />

      <section className={`simulation-strip${simulationEnabled ? ' is-active' : ''}`} aria-label="演示数据设置">
        <div>
          <strong>{simulationEnabled ? '演示数据' : '实体设备模式'}</strong>
          <span>{simulationEnabled ? '确定性基线场景 · 不代表真机验证' : '仅显示运行时观察到的实体连接'}</span>
        </div>
        <label className="simulation-switch">
          <input
            checked={simulationEnabled}
            onChange={(event) => void toggleSimulation(event.currentTarget.checked)}
            role="switch"
            type="checkbox"
          />
          <span aria-hidden="true" className="simulation-switch__track" />
          <span>使用演示数据</span>
        </label>
      </section>

      <div className="sr-only" aria-atomic="true" aria-live="polite" role="status">
        {snapshot.discoveryActive ? '正在扫描设备' : `${connectedCount} 台设备已连接`}
      </div>

      {actionError !== undefined && <p className="device-center__alert" role="alert">{actionError}</p>}
      {verificationRetryEventId !== undefined && (
        <button className="text-button" onClick={retryVerification} type="button">
          重试验证
        </button>
      )}

      <BluetoothGate
        environment={{ ...environment, appState, bluetoothPowered }}
        onBluetoothPoweredChange={setBluetoothPowered}
        onError={setActionError}
        onPermissionChange={setPermission}
        permission={permission}
        runtime={runtime}
        simulated={simulationEnabled}
        snapshot={snapshot}
      />

      <div className="device-slots" aria-label="可连接设备">
        <DeviceSlot
          kind="omi"
          now={currentTime}
          onConnected={simulationEnabled ? () => advanceSimulator('omi') : undefined}
          onAdvance={simulationEnabled ? () => advanceSimulator('omi') : undefined}
          onError={setActionError}
          runtime={runtime}
          snapshot={snapshot}
        />
        <DeviceSlot
          kind="ring"
          now={currentTime}
          onConnected={simulationEnabled ? () => advanceSimulator('ring') : undefined}
          onAdvance={simulationEnabled ? () => advanceSimulator('ring') : undefined}
          onError={setActionError}
          runtime={runtime}
          snapshot={snapshot}
        />
      </div>

      <ConsentSummary
        audioConsent={snapshot.consent.audioCapture}
        interactionConsent={snapshot.consent.interactionEvents}
        mode={mode}
        onInteractionConsentChange={handleInteractionConsentChange}
        onError={setActionError}
        runtime={runtime}
      />
      <DiagnosticsDisclosure simulated={simulationEnabled} snapshot={snapshot} />

      {visiblePending !== undefined && (
        <PendingHardwarePrompt
          busy={pendingActionEventId === visiblePending.pending.event.eventId}
          mode={mode}
          onDefer={deferPending}
          onDismiss={() => void dismissPending()}
          onEnter={() => void enterPending()}
          pending={visiblePending.pending}
        />
      )}
    </div>
  )
}
