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

function SimulatorNav() {
  return (
    <nav className="sim-nav" aria-label="Hardware simulator">
      <a href={`#${hardwareSimulatorRoutes.overview}`}>Overview</a>
      <a href={`#${hardwareSimulatorRoutes.bind}`}>Bind</a>
      <a href={`#${hardwareSimulatorRoutes.trigger}`}>Trigger</a>
    </nav>
  )
}

function FeedbackStrip() {
  const [, refresh] = useState(0)
  useEffect(() => simulatorBridge.subscribeState(() => refresh((value) => value + 1)), [])
  const feedback = simulatorBridge.getFeedback()
  const availability = simulatorBridge.getAvailability()
  return (
    <div className="feedback-strip" aria-label="Abstract hardware feedback">
      <span>Bridge: {availability.available ? 'available' : 'software fallback'}</span>
      <span>LED: {feedback.led}</span>
      <span>Vibration: {feedback.vibration}</span>
      <span>Confirmation: {feedback.confirmation}</span>
    </div>
  )
}

export function HardwareSimulatorPage() {
  const availability = simulatorBridge.getAvailability()
  return (
    <section className="hardware-simulator">
      <header className="sim-header">
        <div>
          <p className="sim-kicker">Hardware-neutral test bench</p>
          <h1>Hardware Simulator</h1>
          <p>Bind a device, entrust it with verification, then inspect one standard event pipeline.</p>
        </div>
        <SimulatorNav />
      </header>
      <FeedbackStrip />
      <div className="sim-dashboard">
        <article>
          <span className="sim-number">01</span>
          <h2>Verified binding</h2>
          <p>No device becomes associated with an identity until its proof succeeds.</p>
          <a className="button button--secondary" href={`#${hardwareSimulatorRoutes.bind}`}>Configure</a>
        </article>
        <article>
          <span className="sim-number">02</span>
          <h2>Standard event</h2>
          <p>All physical and software sources produce the same EntryEvent shape.</p>
          <a className="button button--primary" href={`#${hardwareSimulatorRoutes.trigger}`}>Open trigger lab</a>
        </article>
      </div>
      {!availability.available && <p className="sim-notice">Physical input is unavailable. Events will use the software simulator source.</p>}
    </section>
  )
}

export function HardwareBindPage() {
  const [deviceId, setDeviceId] = useState('loop-demo-device')
  const [deviceType, setDeviceType] = useState('keepsake-token')
  const [ownerId, setOwnerId] = useState('person-mei')
  const [recipientId, setRecipientId] = useState('person-lin')
  const [message, setMessage] = useState('Waiting for verified binding.')
  const [binding, setBinding] = useState(false)
  const [entrusting, setEntrusting] = useState(false)

  async function bind() {
    setBinding(true)
    try {
      await simulatorBridge.bindDevice({
        deviceId,
        deviceType,
        ownerProof: { identityId: ownerId, method: 'mock_code', value: 'LOOP-DEMO' },
      })
      setMessage(`Verified binding created for ${deviceId}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Binding failed')
    } finally {
      setBinding(false)
    }
  }

  async function entrust() {
    setEntrusting(true)
    try {
      await simulatorBridge.entrustDevice({
        deviceId,
        ownerProof: { identityId: ownerId, method: 'mock_code', value: 'LOOP-DEMO' },
        recipientProof: { identityId: recipientId, method: 'mock_confirmation', value: 'LOOP-DEMO' },
      })
      setMessage(`Entrustment verified for recipient ${recipientId}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Entrustment failed')
    } finally {
      setEntrusting(false)
    }
  }

  return (
    <section className="hardware-simulator">
      <header className="sim-header"><div><p className="sim-kicker">Identity gate</p><h1>Bind and entrust</h1></div><SimulatorNav /></header>
      <FeedbackStrip />
      <div className="sim-form-grid">
        <label>Device ID<input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} /></label>
        <label>Device type<input value={deviceType} onChange={(event) => setDeviceType(event.target.value)} /></label>
        <label>Owner identity<input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} /></label>
        <label>Recipient identity<input value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /></label>
      </div>
      <div className="sim-actions"><button className="button button--secondary" onClick={() => void bind()} disabled={binding || entrusting}>{binding ? 'Binding...' : 'Verify and bind'}</button><button className="button button--primary" onClick={() => void entrust()} disabled={binding || entrusting}>{entrusting ? 'Entrusting...' : 'Verify and entrust'}</button></div>
      <p className="sim-notice" role="status">{message}</p>
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
  const [message, setMessage] = useState('Ready to produce an event.')
  const [triggering, setTriggering] = useState(false)

  useEffect(
    () => simulatorBridge.subscribeLifecycle((transition) => {
      setTransitions((current) => [...current, transition])
    }),
    [],
  )

  async function trigger() {
    setTriggering(true)
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
      setMessage(result.outcome === 'accepted' ? `Verified event consumed (${result.policyOutcome}). Entering recipient flow.` : `Event rejected: ${result.outcome} / ${result.policyOutcome}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Trigger failed')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <section className="hardware-simulator">
      <header className="sim-header"><div><p className="sim-kicker">Event pipeline</p><h1>Trigger and inspect</h1></div><SimulatorNav /></header>
      <FeedbackStrip />
      <div className="sim-trigger-controls">
        <label>Trigger source<select value={source} onChange={(event) => setSource(event.target.value as TriggerSource)}>{triggerSources.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Trigger reason<select value={triggerReason} onChange={(event) => setTriggerReason(event.target.value as TriggerReason)}>{triggerReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
        <label>Device ID<input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} /></label>
        <label>Recipient ID<input value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /></label>
        <button className="button button--primary" onClick={() => void trigger()} disabled={triggering}>{triggering ? 'Triggering...' : 'Trigger event'}</button>
      </div>
      <p className="sim-notice" role="status">{message}</p>
      <ol className="event-timeline" aria-label="Event lifecycle">
        {transitions.length === 0 && <li><strong>No events yet</strong><span>Produced, verification, and consumption stages appear here.</span></li>}
        {transitions.map((transition, index) => (
          <li key={`${transition.event.id}-${transition.stage}-${index}`}>
            <strong>{transition.stage}</strong>
            <span>{transition.triggerSource} / {transition.event.source} / {transition.verificationStatus}{transition.reason ? ` / ${transition.reason}` : ''}</span>
            <code>{transition.event.id}</code>
          </li>
        ))}
      </ol>
    </section>
  )
}
