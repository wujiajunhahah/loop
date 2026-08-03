import { useEffect, useState } from 'react'
import type {
  EntryEventTransition,
  TriggerSource,
} from '../../adapters/hardware'
import { triggerSources } from '../../adapters/hardware'
import type { TriggerReason } from '../../domain'
import { simulatorBridge, simulatorController } from './simulatorStore'
import { triggerReasons } from './triggerPolicy'
import './hardwareSimulator.css'

export const hardwareSimulatorRoutes = {
  overview: '/hardware-simulator',
  bind: '/hardware-simulator/bind',
  trigger: '/hardware-simulator/trigger',
} as const

const sourceLabels: Record<TriggerSource, string> = {
  touch: '触碰',
  tap: '轻点',
  gesture: '手势',
  nfc: 'NFC',
  ble: '蓝牙按钮',
  software: '软件模拟',
}

const reasonLabels: Record<TriggerReason, string> = {
  user_opened: '由接收者打开',
  scheduled_date: '授权日期',
  milestone: '重要节点',
  weather_context: '天气情境',
  location_context: '地点情境',
  plan_progress: '计划进度',
}

const stateLabels: Record<string, string> = {
  off: '关闭',
  ready: '待命',
  active: '活动',
  error: '错误',
  none: '无',
  acknowledge: '确认',
  attention: '提醒',
  idle: '待命',
  pending: '等待',
  confirmed: '已确认',
  rejected: '已拒绝',
  produced: '已生成',
  verified: '已验证',
  consumed: '已消费',
}

function SimulatorNav() {
  const route = window.location.hash.slice(1)
  return (
    <nav className="sim-nav" aria-label="信物模拟器">
      <a aria-current={route === hardwareSimulatorRoutes.overview ? 'page' : undefined} href={`#${hardwareSimulatorRoutes.overview}`}>概览</a>
      <a aria-current={route === hardwareSimulatorRoutes.bind ? 'page' : undefined} href={`#${hardwareSimulatorRoutes.bind}`}>绑定与托付</a>
      <a aria-current={route === hardwareSimulatorRoutes.trigger ? 'page' : undefined} href={`#${hardwareSimulatorRoutes.trigger}`}>触发检查</a>
    </nav>
  )
}

function FeedbackStrip() {
  const [, refresh] = useState(0)
  useEffect(() => simulatorBridge.subscribeState(() => refresh((value) => value + 1)), [])
  const feedback = simulatorBridge.getFeedback()
  const availability = simulatorBridge.getAvailability()
  return (
    <div className="feedback-strip" aria-label="信物反馈状态">
      <span>桥接 · {availability.available ? '实体设备可用' : '软件模拟'}</span>
      <span>灯光 · {stateLabels[feedback.led]}</span>
      <span>震动 · {stateLabels[feedback.vibration]}</span>
      <span>确认 · {stateLabels[feedback.confirmation]}</span>
    </div>
  )
}

export function HardwareSimulatorPage() {
  const availability = simulatorBridge.getAvailability()
  return (
    <section className="hardware-simulator">
      <header className="sim-header">
        <div>
          <p className="sim-kicker">信物模拟器 · 软件可独立完成</p>
          <h1>检查一次实体入口。</h1>
          <p>先绑定身份并完成托付，再查看一次触碰如何经过验证，进入接收者流程。</p>
        </div>
        <SimulatorNav />
      </header>
      <FeedbackStrip />
      <div className="sim-dashboard">
        <article>
          <span className="sim-number">01</span>
          <h2>身份绑定与托付</h2>
          <p>只有双方身份验证通过后，信物才会与这段关系关联。</p>
          <a className="button button--secondary" href={`#${hardwareSimulatorRoutes.bind}`}>配置身份</a>
        </article>
        <article>
          <span className="sim-number">02</span>
          <h2>统一入口事件</h2>
          <p>实体触碰与软件模拟都会形成同一种入口事件，并经过同一套策略检查。</p>
          <a className="button button--primary" href={`#${hardwareSimulatorRoutes.trigger}`}>检查触发流程</a>
        </article>
      </div>
      {!availability.available && <p className="sim-notice">当前没有实体输入，后续事件将使用软件模拟来源。</p>}
    </section>
  )
}

export function HardwareBindPage() {
  const [deviceId, setDeviceId] = useState('loop-demo-device')
  const [deviceType, setDeviceType] = useState('keepsake-token')
  const [ownerId, setOwnerId] = useState('person-mei')
  const [recipientId, setRecipientId] = useState('person-lin')
  const [message, setMessage] = useState('等待身份验证与绑定。')
  const [hasError, setHasError] = useState(false)
  const [binding, setBinding] = useState(false)
  const [entrusting, setEntrusting] = useState(false)

  async function bind() {
    setBinding(true)
    setHasError(false)
    try {
      await simulatorBridge.bindDevice({
        deviceId,
        deviceType,
        ownerProof: { identityId: ownerId, method: 'mock_code', value: 'LOOP-DEMO' },
      })
      setMessage(`已验证并绑定设备 ${deviceId}。`)
    } catch (error) {
      setHasError(true)
      setMessage(error instanceof Error ? error.message : '设备绑定失败，请重试。')
    } finally {
      setBinding(false)
    }
  }

  async function entrust() {
    setEntrusting(true)
    setHasError(false)
    try {
      await simulatorBridge.entrustDevice({
        deviceId,
        ownerProof: { identityId: ownerId, method: 'mock_code', value: 'LOOP-DEMO' },
        recipientProof: { identityId: recipientId, method: 'mock_confirmation', value: 'LOOP-DEMO' },
      })
      setMessage(`已验证并托付给接收者 ${recipientId}。`)
    } catch (error) {
      setHasError(true)
      setMessage(error instanceof Error ? error.message : '托付验证失败，请重试。')
    } finally {
      setEntrusting(false)
    }
  }

  return (
    <section className="hardware-simulator">
      <header className="sim-header"><div><p className="sim-kicker">身份入口</p><h1>绑定并托付信物。</h1></div><SimulatorNav /></header>
      <FeedbackStrip />
      <div className="sim-form-grid">
        <label>设备 ID<input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} /></label>
        <label>设备类型<input value={deviceType} onChange={(event) => setDeviceType(event.target.value)} /></label>
        <label>所有者身份<input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} /></label>
        <label>接收者身份<input value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /></label>
      </div>
      <div className="sim-actions" aria-busy={binding || entrusting}><button className="button button--secondary" onClick={() => void bind()} disabled={binding || entrusting}>{binding ? '正在绑定...' : '验证并绑定'}</button><button className="button button--primary" onClick={() => void entrust()} disabled={binding || entrusting}>{entrusting ? '正在托付...' : '验证并托付'}</button></div>
      <p className={`sim-notice ${hasError ? 'sim-notice--error' : ''}`} role={hasError ? 'alert' : 'status'}>{message}</p>
    </section>
  )
}

export function HardwareTriggerPage() {
  const binding = simulatorBridge.getBindings().find((item) => item.recipientId)
  const [source, setSource] = useState<TriggerSource>('touch')
  const [triggerReason, setTriggerReason] = useState<TriggerReason>('user_opened')
  const [deviceId, setDeviceId] = useState(binding?.deviceId ?? 'loop-demo-device')
  const [recipientId, setRecipientId] = useState(binding?.recipientId ?? 'person-lin')
  const [transitions, setTransitions] = useState<EntryEventTransition[]>([])
  const [message, setMessage] = useState('可以生成一次入口事件。')
  const [hasError, setHasError] = useState(false)
  const [triggering, setTriggering] = useState(false)

  useEffect(
    () => simulatorBridge.subscribeLifecycle((transition) => {
      setTransitions((current) => [...current, transition])
    }),
    [],
  )

  async function trigger() {
    setTriggering(true)
    setHasError(false)
    try {
      const result = await simulatorController.triggerAndEnterRecipient({
        deviceId,
        recipientId,
        relationshipId: 'relationship-mei-lin',
        source,
        triggerReason,
        allowFallback: true,
        payload: { source: 'hardware-simulator' },
      })
      setMessage(result.outcome === 'accepted' ? `入口事件已验证并消费（${result.policyOutcome}），正在进入接收者流程。` : `入口事件被拒绝：${result.outcome} / ${result.policyOutcome}。`)
    } catch (error) {
      setHasError(true)
      setMessage(error instanceof Error ? error.message : '事件触发失败，请重试。')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <section className="hardware-simulator">
      <header className="sim-header"><div><p className="sim-kicker">入口事件链路</p><h1>触发并检查一次进入。</h1></div><SimulatorNav /></header>
      <FeedbackStrip />
      <div className="sim-trigger-controls">
        <label>触发来源<select value={source} onChange={(event) => setSource(event.target.value as TriggerSource)}>{triggerSources.map((item) => <option key={item} value={item}>{sourceLabels[item]}</option>)}</select></label>
        <label>触发原因<select value={triggerReason} onChange={(event) => setTriggerReason(event.target.value as TriggerReason)}>{triggerReasons.map((reason) => <option key={reason} value={reason}>{reasonLabels[reason]}</option>)}</select></label>
        <label>设备 ID<input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} /></label>
        <label>接收者 ID<input value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /></label>
        <button className="button button--primary" onClick={() => void trigger()} disabled={triggering}>{triggering ? '正在触发...' : '触发入口事件'}</button>
      </div>
      <p className={`sim-notice ${hasError ? 'sim-notice--error' : ''}`} role={hasError ? 'alert' : 'status'}>{message}</p>
      <ol className="event-timeline" aria-label="入口事件生命周期">
        {transitions.length === 0 && <li><strong>还没有事件</strong><span>生成、验证与消费阶段会依次显示在这里。</span></li>}
        {transitions.map((transition, index) => (
          <li key={`${transition.event.id}-${transition.stage}-${index}`}>
            <strong>{stateLabels[transition.stage] ?? transition.stage}</strong>
            <span>{sourceLabels[transition.triggerSource]} / {transition.event.source} / {stateLabels[transition.verificationStatus] ?? transition.verificationStatus}{transition.reason ? ` / ${transition.reason}` : ''}</span>
            <code>{transition.event.id}</code>
          </li>
        ))}
      </ol>
    </section>
  )
}
