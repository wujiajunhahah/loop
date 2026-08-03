import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react'
import type { DeviceCapabilityReport } from '../../devices/contracts'
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
  getDeterministicSimulatorRuntime,
  getFallbackDeviceRuntime,
} from './deviceCenterRuntime'
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
}

export interface DeviceCenterPageProps {
  runtime?: DeviceRuntime
  environment?: DeviceCenterEnvironment
  simulator?: { runtime: DeviceRuntime }
  now?: () => number
}

type RoleMode = 'creator' | 'recipient'

const defaultEnvironment: DeviceCenterEnvironment = {
  physicalSupported: false,
  permission: 'unsupported',
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
  onError(message?: string): void
}

function BluetoothGate({
  environment,
  permission,
  runtime,
  snapshot,
  simulated,
  onPermissionChange,
  onError,
}: BluetoothGateProps) {
  const visibleDevices = snapshot.devices.filter((device) =>
    device.matchedAdapterIds.length > 0,
  )

  const scan = async () => {
    onError(undefined)
    const result = await runtime.scan()
    if (result.ok) return
    if (result.error.code === 'permission_denied') {
      onPermissionChange('denied')
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
    if (snapshot.phase === 'scanning') {
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
  } else if (snapshot.phase === 'scanning') {
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

  const busy = snapshot.phase === 'opening' || snapshot.phase === 'scanning'
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
          const freshness = freshnessFor(value, now)
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
}

function DeviceCard({
  device,
  kind,
  runtime,
  audioConsent,
  now,
  onError,
  onConnected,
}: DeviceCardProps) {
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

      {device.phase === 'connected' && device.capabilities !== undefined && (
        <div className="device-card__detail">
          <section aria-labelledby={`${kind}-capabilities-heading`}>
            <p className="device-kicker">设备能力</p>
            <h4 id={`${kind}-capabilities-heading`}>已观察到的支持范围</h4>
            <CapabilityList capabilities={device.capabilities} />
          </section>
          <section aria-labelledby={`${kind}-live-heading`}>
            <p className="device-kicker">实时数据</p>
            <h4 id={`${kind}-live-heading`}>{kind === 'omi' ? '音频状态' : '最近观察值'}</h4>
            <LiveData device={device} kind={kind} now={now} />
          </section>
          <section aria-labelledby={`${kind}-status-heading`}>
            <p className="device-kicker">连接信息</p>
            <h4 id={`${kind}-status-heading`}>设备状态</h4>
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
}

function DeviceSlot({ kind, snapshot, runtime, now, onError, onConnected }: DeviceSlotProps) {
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
          runtime={runtime}
        />
      ))}
    </section>
  )
}

function ConsentSummary({
  audioConsent,
  mode,
  runtime,
  onError,
}: {
  audioConsent: boolean
  mode: RoleMode
  runtime: DeviceRuntime
  onError(message?: string): void
}) {
  const changeConsent = async (checked: boolean) => {
    onError(undefined)
    const result = await runtime.setConsent({ audioCapture: checked })
    if (!result.ok) onError('音频连接同意状态未能保存，请重试。')
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
          onChange={(event) => void changeConsent(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>
          <strong>允许 OMI 音频连接</strong>
          <small>这只允许建立音频能力连接，不会开始录音或保存内容。</small>
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
  onClose,
}: {
  pending: PendingDeviceEvent
  mode: RoleMode
  onClose(): void
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled])',
    )
    if (controls === undefined || controls.length === 0) return
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

  const enter = () => {
    window.location.hash = creator ? '#/capture/new' : '#/recipient'
  }

  return (
    <div className="pending-prompt" role="presentation">
      <div
        aria-describedby="pending-prompt-description"
        aria-labelledby="pending-prompt-title"
        aria-modal="true"
        className="pending-prompt__sheet"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label="关闭提示"
          className="pending-prompt__close"
          onClick={onClose}
          ref={closeRef}
          title="关闭提示"
          type="button"
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
        <div className="pending-prompt__actions">
          <button className="button button--primary" onClick={enter} type="button">
            {creator ? '进入记录引导' : '确认这是给我的'}
          </button>
          <button className="button button--secondary" onClick={onClose} type="button">稍后</button>
          <button className="text-button" onClick={onClose} type="button">忽略</button>
        </div>
      </div>
    </div>
  )
}

export function DeviceCenterPage({
  runtime: injectedRuntime,
  environment = defaultEnvironment,
  simulator,
  now = Date.now,
}: DeviceCenterPageProps = {}) {
  const physicalRuntime = injectedRuntime ?? getFallbackDeviceRuntime()
  const demoRuntime = simulator?.runtime ?? getDeterministicSimulatorRuntime()
  const [simulationEnabled, setSimulationEnabled] = useState(false)
  const [permission, setPermission] = useState<PermissionState>(environment.permission)
  const [mode, setMode] = useState<RoleMode>('creator')
  const [handledEventId, setHandledEventId] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const runtime = simulationEnabled ? demoRuntime : physicalRuntime
  const snapshot = useRuntimeSnapshot(runtime)
  const pending = findPendingDeviceEvent(snapshot)
  const visiblePending = pending?.event.eventId === handledEventId ? undefined : pending
  const connectedCount = snapshot.devices.filter((device) => device.phase === 'connected').length

  useEffect(() => {
    setPermission(environment.permission)
  }, [environment.permission])

  useEffect(() => {
    document.title = '设备 | Loop'
    headingRef.current?.focus()
  }, [])

  const toggleSimulation = async (enabled: boolean) => {
    if (
      enabled &&
      physicalRuntime.getSnapshot().devices.some((device) => device.phase === 'connected') &&
      !window.confirm('实体设备仍保持连接。切换后只会隐藏其界面，不会把演示数据当作实体数据。继续吗？')
    ) return

    setActionError(undefined)
    setHandledEventId(undefined)
    setSimulationEnabled(enabled)
    if (!enabled) return
    await demoRuntime.ready()
    const result = await demoRuntime.scan()
    if (!result.ok) setActionError('演示设备没有载入，请重试。')
  }

  const dismissPending = () => {
    if (visiblePending !== undefined) setHandledEventId(visiblePending.event.eventId)
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

      <RoleModeControl mode={mode} onChange={setMode} />

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
        {snapshot.phase === 'scanning' ? '正在扫描设备' : `${connectedCount} 台设备已连接`}
      </div>

      {actionError !== undefined && <p className="device-center__alert" role="alert">{actionError}</p>}

      <BluetoothGate
        environment={environment}
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
          now={now()}
          onConnected={simulationEnabled ? () => advanceDeterministicSimulator('omi') : undefined}
          onError={setActionError}
          runtime={runtime}
          snapshot={snapshot}
        />
        <DeviceSlot
          kind="ring"
          now={now()}
          onConnected={simulationEnabled ? () => advanceDeterministicSimulator('ring') : undefined}
          onError={setActionError}
          runtime={runtime}
          snapshot={snapshot}
        />
      </div>

      <ConsentSummary
        audioConsent={snapshot.consent.audioCapture}
        mode={mode}
        onError={setActionError}
        runtime={runtime}
      />
      <DiagnosticsDisclosure simulated={simulationEnabled} snapshot={snapshot} />

      {visiblePending !== undefined && (
        <PendingHardwarePrompt mode={mode} onClose={dismissPending} pending={visiblePending} />
      )}
    </div>
  )
}
