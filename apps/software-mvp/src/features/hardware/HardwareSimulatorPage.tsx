import { useEffect, useState } from 'react'
import type {
  HardwareEventTransition,
  HardwareEventType,
} from '../../adapters/hardware'
import { hardwareEventTypes } from '../../adapters/hardware'
import { simulatorBridge, simulatorController } from './simulatorStore'
import './hardwareSimulator.css'

export const hardwareSimulatorRoutes = {
  overview: '/hardware-simulator',
  bind: '/hardware-simulator/bind',
  trigger: '/hardware-simulator/trigger',
} as const

const DEFAULT_SIMULATED_RING_DEVICE_ID = 'simulator-ring-normalized-device'

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
          <p>All physical and software sources produce the same HardwareEvent shape.</p>
          <a className="button button--primary" href={`#${hardwareSimulatorRoutes.trigger}`}>Open trigger lab</a>
        </article>
      </div>
      {!availability.available && <p className="sim-notice">Physical input is unavailable. Events will use the software simulator source.</p>}
    </section>
  )
}

export function HardwareBindPage() {
  const [deviceId, setDeviceId] = useState(DEFAULT_SIMULATED_RING_DEVICE_ID)
  const [deviceType, setDeviceType] = useState('ring')
  const [ownerId, setOwnerId] = useState('person-mei')
  const [recipientId, setRecipientId] = useState('person-lin')
  const [message, setMessage] = useState('Waiting for verified binding.')

  async function bind() {
    try {
      await simulatorBridge.bindDevice({
        deviceId,
        deviceType,
        ownerProof: { identityId: ownerId, method: 'mock_code', value: 'LOOP-DEMO' },
      })
      setMessage(`Verified binding created for ${deviceId}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Binding failed')
    }
  }

  async function entrust() {
    try {
      await simulatorBridge.entrustDevice({
        deviceId,
        ownerProof: { identityId: ownerId, method: 'mock_code', value: 'LOOP-DEMO' },
        recipientProof: { identityId: recipientId, method: 'mock_confirmation', value: 'LOOP-DEMO' },
      })
      setMessage(`Entrustment verified for recipient ${recipientId}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Entrustment failed')
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
      <div className="sim-actions"><button className="button button--secondary" onClick={bind}>Verify and bind</button><button className="button button--primary" onClick={entrust}>Verify and entrust</button></div>
      <p className="sim-notice" role="status">{message}</p>
    </section>
  )
}

export function HardwareTriggerPage() {
  const binding = simulatorBridge.getBindings().find((item) => item.recipientId)
  const [eventType, setEventType] = useState<HardwareEventType>('touch')
  const [deviceId, setDeviceId] = useState(binding?.deviceId ?? DEFAULT_SIMULATED_RING_DEVICE_ID)
  const [recipientId, setRecipientId] = useState(binding?.recipientId ?? 'person-lin')
  const [transitions, setTransitions] = useState<HardwareEventTransition[]>([])
  const [message, setMessage] = useState('Ready to produce an event.')

  useEffect(
    () => simulatorBridge.subscribeLifecycle((transition) => {
      setTransitions((current) => [...current, transition])
    }),
    [],
  )

  async function trigger() {
    const result = await simulatorController.triggerAndEnterRecipient({
      deviceId,
      recipientId,
      eventType,
      allowFallback: true,
      payload: { source: 'hardware-simulator' },
    })
    setMessage(result.outcome === 'accepted' ? 'Verified event consumed. Entering recipient flow.' : `Event rejected: ${result.outcome}.`)
  }

  return (
    <section className="hardware-simulator">
      <header className="sim-header"><div><p className="sim-kicker">Event pipeline</p><h1>Trigger and inspect</h1></div><SimulatorNav /></header>
      <FeedbackStrip />
      <div className="sim-trigger-controls">
        <label>Event type<select value={eventType} onChange={(event) => setEventType(event.target.value as HardwareEventType)}>{hardwareEventTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Device ID<input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} /></label>
        <label>Recipient ID<input value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /></label>
        <button className="button button--primary" onClick={trigger}>Trigger event</button>
      </div>
      <p className="sim-notice" role="status">{message}</p>
      <ol className="event-timeline" aria-label="Event lifecycle">
        {transitions.length === 0 && <li><strong>No events yet</strong><span>Produced, verification, and consumption stages appear here.</span></li>}
        {transitions.map((transition, index) => (
          <li key={`${transition.event.eventId}-${transition.stage}-${index}`}>
            <strong>{transition.stage}</strong>
            <span>{transition.event.eventType} / {transition.event.verificationStatus}{transition.reason ? ` / ${transition.reason}` : ''}</span>
            <code>{transition.event.eventId}</code>
          </li>
        ))}
      </ol>
    </section>
  )
}
