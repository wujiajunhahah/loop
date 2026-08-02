import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { RecipientSession } from '../../../domain'
import type { JourneyIntensity } from '../domain'
import type { EchoMapJourneyData } from '../services'
import '../journey.css'

interface JourneyUiData extends EchoMapJourneyData {
  createSession(): RecipientSession
}

const memoryRequests = new WeakMap<
  EchoMapJourneyData,
  Map<string, ReturnType<EchoMapJourneyData['loadJourneyMemory']>>
>()
const postcardRequests = new WeakMap<
  EchoMapJourneyData,
  Map<string, ReturnType<EchoMapJourneyData['createJourneyPostcard']>>
>()

function sharedMemoryRequest(data: EchoMapJourneyData, sessionId: string) {
  let requests = memoryRequests.get(data)
  if (!requests) {
    requests = new Map()
    memoryRequests.set(data, requests)
  }
  let request = requests.get(sessionId)
  if (!request) {
    request = data.loadJourneyMemory(sessionId)
    requests.set(sessionId, request)
    void request.then(
      () => requests?.delete(sessionId),
      () => requests?.delete(sessionId),
    )
  }
  return request
}

function sharedPostcardRequest(data: EchoMapJourneyData, sessionId: string) {
  let requests = postcardRequests.get(data)
  if (!requests) {
    requests = new Map()
    postcardRequests.set(data, requests)
  }
  let request = requests.get(sessionId)
  if (!request) {
    request = data.createJourneyPostcard(sessionId)
    requests.set(sessionId, request)
    void request.then(
      () => requests?.delete(sessionId),
      () => requests?.delete(sessionId),
    )
  }
  return request
}

type JourneyRoute =
  | 'map'
  | 'proposal'
  | 'action'
  | 'memory'
  | 'respond'
  | 'postcard'

function getRoute(): JourneyRoute {
  const path = window.location.hash.slice(1).split('?')[0]
  if (path.endsWith('/proposal')) return 'proposal'
  if (path.endsWith('/action')) return 'action'
  if (path.endsWith('/memory')) return 'memory'
  if (path.endsWith('/respond')) return 'respond'
  if (path.endsWith('/postcard')) return 'postcard'
  return 'map'
}

function go(route: JourneyRoute) {
  const suffix = route === 'map' ? '' : `/${route}`
  window.location.hash = `/recipient/echo-map${suffix}`
}

function resumeRoute(state: string): JourneyRoute | undefined {
  const routes: Partial<Record<string, JourneyRoute>> = {
    proposal_inspected: 'proposal',
    action_accepted: 'action',
    action_completed: 'memory',
    memory_opened: 'memory',
    response_recorded: 'postcard',
    postcard_creating: 'postcard',
    postcard_created: 'postcard',
  }
  return routes[state]
}

function inlineText(uri: string) {
  if (!uri.startsWith('data:text/plain')) return uri
  const separator = uri.indexOf(',')
  if (separator < 0) return uri
  try {
    return decodeURIComponent(uri.slice(separator + 1))
  } catch {
    return uri
  }
}

function SourceDetails({
  label,
  contextIds,
  assetIds,
  mode,
}: {
  label: string
  contextIds: readonly string[]
  assetIds: readonly string[]
  mode: string
}) {
  return (
    <dl className="journey-source">
      <div><dt>Layer</dt><dd>{label}</dd></div>
      <div><dt>Context</dt><dd>{contextIds.join(', ')}</dd></div>
      <div><dt>Asset</dt><dd>{assetIds.join(', ')}</dd></div>
      <div><dt>Mode</dt><dd>{mode}</dd></div>
      <div><dt>Trigger</dt><dd>pull_only / user_opened</dd></div>
    </dl>
  )
}

function MapSurface({ status }: { status: string }) {
  return (
    <div className={`echo-map echo-map--${status}`} aria-label={`Echo Map node: ${status}`}>
      <div className="echo-map__weather" aria-hidden="true">RAIN / 17:40</div>
      <div className="echo-map__line" aria-hidden="true" />
      <div className="echo-map__messenger" aria-label="Traveling Messenger">M</div>
      <div className="echo-map__node" aria-hidden="true"><span /></div>
      <div className="echo-map__label">
        <strong>Rain Under One Umbrella</strong>
        <span>{status === 'lit' ? 'Postcard linked' : status}</span>
      </div>
    </div>
  )
}

export function EchoMapJourneyExperience({ data }: { data: JourneyUiData }) {
  const [route, setRoute] = useState<JourneyRoute>(getRoute)
  const [intensity, setIntensity] = useState<JourneyIntensity>('quiet')
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [originalOpen, setOriginalOpen] = useState(false)
  const [nodeError, setNodeError] = useState('')
  const [confirmHide, setConfirmHide] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const dialogRef = useRef<HTMLDivElement>(null)
  const hideReturnFocusRef = useRef<HTMLElement | null>(null)
  const snapshot = data.getJourneySnapshot()
  const session = snapshot.session
  const proposal = snapshot.proposal

  const refresh = () => setVersion((value) => value + 1)
  void version

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      setLoading(false)
      setRoute(getRoute())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!confirmHide) return
    const dialog = dialogRef.current
    const controls = dialog?.querySelectorAll<HTMLElement>('button')
    controls?.[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setConfirmHide(false)
        return
      }
      if (event.key !== 'Tab' || !controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog?.addEventListener('keydown', onKeyDown)
    return () => {
      dialog?.removeEventListener('keydown', onKeyDown)
      hideReturnFocusRef.current?.focus()
    }
  }, [confirmHide])

  useEffect(() => {
    headingRef.current?.focus()
  }, [route])

  const focusAlert = (node: HTMLDivElement | null) => {
    alertRef.current = node
    node?.focus()
  }

  useEffect(() => {
    if (route !== 'memory' || !session || snapshot.presentation || error) return
    if (session.state !== 'action_completed') return
    setLoading(true)
    void sharedMemoryRequest(data, session.id)
      .then(() => {
        if (mountedRef.current) {
          setLoading(false)
          refresh()
        }
      })
      .catch((reason: unknown) => {
        if (mountedRef.current) {
          setLoading(false)
          setError(reason instanceof Error ? reason.message : 'Memory unavailable.')
        }
      })
  }, [data, error, route, session?.id])

  useEffect(() => {
    if (route !== 'postcard' || !session || snapshot.artifact || error) return
    if (session.state !== 'response_recorded' && session.state !== 'postcard_creating') return
    setLoading(true)
    void sharedPostcardRequest(data, session.id)
      .then(() => {
        if (mountedRef.current) {
          setLoading(false)
          refresh()
        }
      })
      .catch((reason: unknown) => {
        if (mountedRef.current) {
          setLoading(false)
          setError(reason instanceof Error ? reason.message : 'Postcard unavailable.')
        }
      })
  }, [data, error, route, session?.id])

  const beginAndInspect = () => {
    setError('')
    try {
      let current = session
      if (
        current &&
        ['node_lit', 'skipped', 'stopped', 'rejected', 'hidden', 'closed'].includes(current.state)
      ) {
        current = undefined
      }
      if (!current) current = data.startJourney(data.createSession())
      if (current.state === 'map_ready') {
        current = data.selectJourneyIntensity(current.id, intensity)
      }
      if (current.state === 'intensity_selected') {
        data.inspectJourneyProposal(current.id)
      }
      refresh()
      go('proposal')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Journey unavailable.')
    }
  }

  const exit = (choice: 'skip' | 'stop' | 'reject' | 'hide' | 'close') => {
    setError('')
    try {
      let current = session
      if (!current && choice === 'hide') current = data.startJourney(data.createSession())
      if (current) data.exitJourney(current.id, choice)
      refresh()
      if (choice === 'close') window.location.hash = '/recipient'
      else go('map')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Exit unavailable.')
    }
  }

  const acceptAction = () => {
    if (!session || !proposal) return
    try {
      data.acceptJourneyAction(session.id, proposal.fallbackAction.id)
      refresh()
      go('action')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action unavailable.')
    }
  }

  const completeAction = () => {
    if (!session) return
    try {
      data.completeJourneyAction(session.id)
      refresh()
      setError('')
      go('memory')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action completion unavailable.')
    }
  }

  const saveResponse = (event?: FormEvent, omitted = false) => {
    event?.preventDefault()
    if (!session) return
    try {
      data.saveJourneyResponse(session.id, omitted ? undefined : draft)
      setDraft('')
      refresh()
      setError('')
      go('postcard')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Response unavailable.')
    }
  }

  const lightNode = async () => {
    if (!session) return
    setLoading(true)
    setError('')
    setNodeError('')
    try {
      await data.lightJourneyNode(session.id)
      if (mountedRef.current) {
        refresh()
        if (getRoute() === 'postcard') go('map')
      }
    } catch (reason) {
      if (mountedRef.current) {
        setNodeError(reason instanceof Error ? reason.message : 'Node completion unavailable.')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  const retry = () => {
    setError('')
    refresh()
  }

  const openHideDialog = () => {
    hideReturnFocusRef.current = document.activeElement as HTMLElement | null
    setConfirmHide(true)
  }

  const hideDialog = confirmHide ? (
    <div className="journey-dialog-backdrop">
      <div ref={dialogRef} className="journey-dialog" role="dialog" aria-modal="true" aria-labelledby="hide-title">
        <p className="eyebrow">Current Demo lifetime</p>
        <h2 id="hide-title">Hide this journey?</h2>
        <p>It stays hidden for this relationship until the in-memory Demo is reset.</p>
        <div className="journey-actions">
          <button className="button button--primary" onClick={() => { setConfirmHide(false); exit('hide') }}>Confirm hide</button>
          <button className="button button--secondary" onClick={() => setConfirmHide(false)}>Cancel</button>
        </div>
      </div>
    </div>
  ) : null

  if (route !== 'map' && !session) {
    return (
      <section className="journey-restart">
        <p className="eyebrow">Echo Map / restart required</p>
        <h1 ref={headingRef} tabIndex={-1}>This journey needs a fresh entry.</h1>
        <p>In-memory permission was not restored from the URL. No action, postcard, or node was completed.</p>
        <button className="button button--primary" onClick={() => go('map')}>Return to Echo Map</button>
      </section>
    )
  }

  const mapStatus = snapshot.node.status

  if (route === 'map') {
    const mapComplete = mapStatus === 'lit'
    const unavailable = mapStatus === 'hidden' || mapStatus === 'rejected'
    return (
      <section className="journey-shell journey-shell--map">
        <MapSurface status={mapStatus} />
        <div className="journey-panel">
          <p className="eyebrow">Echo Map / Mei to Lin / pull_only</p>
          <h1 ref={headingRef} tabIndex={-1}>Rain Under One Umbrella</h1>
          {mapComplete ? (
            <>
              <p className="journey-lead">One sourced memory, one present-life response, and one postcard are linked here.</p>
              <div className="journey-complete-mark" role="status">Node lit / journey complete</div>
              <button className="button button--secondary" onClick={() => go('postcard')}>Open postcard</button>
            </>
          ) : unavailable ? (
            <>
              <p className="journey-lead">This proposal is {mapStatus} for the current in-memory Demo.</p>
              <button className="button button--secondary" disabled>Available after Demo reset</button>
            </>
          ) : session && resumeRoute(session.state) ? (
            <>
              <p className="journey-lead">This journey remains in progress. No route change will mark it complete.</p>
              <button className="button button--primary" onClick={() => go(resumeRoute(session.state)!)}>Continue journey</button>
            </>
          ) : (
            <>
              <p className="journey-lead">A neutral messenger has one approved rainy-day source ready. Nothing opens automatically.</p>
              <fieldset className="intensity-control">
                <legend>Journey intensity</legend>
                {(['quiet', 'glimmer', 'deep'] as const).map((value) => (
                  <label key={value} className={intensity === value ? 'is-selected' : undefined}>
                    <input
                      type="radio"
                      name="journey-intensity"
                      value={value}
                      checked={intensity === value}
                      onChange={() => setIntensity(value)}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </fieldset>
              <div className="journey-actions">
                <button className="button button--primary" onClick={beginAndInspect}>Inspect journey</button>
                <button className="text-button" onClick={openHideDialog}>Hide for this Demo</button>
                <button className="text-button" onClick={() => exit('close')}>Close</button>
              </div>
            </>
          )}
          {error && <div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{error}</div>}
        </div>
        {hideDialog}
      </section>
    )
  }

  if (route === 'proposal' && proposal && session?.state === 'proposal_inspected') {
    return (
      <section className="journey-shell">
        <MapSurface status={mapStatus} />
        <div className="journey-panel">
          <p className="eyebrow">Proposal / inspected / {proposal.intensity}</p>
          <h1 ref={headingRef} tabIndex={-1}>{proposal.title}</h1>
          <p className="journey-lead">{proposal.rationale}</p>
          <div className="proposal-evidence">
            <span>Loop-authored neutral action</span>
            <strong>{proposal.fallbackAction.text}</strong>
            <small>Not a message from Mei / not AI-generated</small>
          </div>
          <SourceDetails
            label="Approved source"
            contextIds={proposal.sourceSelection.sourceContextIds}
            assetIds={proposal.sourceSelection.sourceAssetIds}
            mode={proposal.sourceSelection.requestedModes.join(' + ')}
          />
          <div className="journey-actions">
            <button className="button button--primary" onClick={acceptAction}>Use neutral action</button>
            <button className="button button--secondary" onClick={() => go('map')}>Back to map</button>
            <button className="text-button" onClick={() => exit('skip')}>Skip this time</button>
            <button className="text-button" onClick={() => exit('reject')}>Reject proposal</button>
            <button className="text-button" onClick={openHideDialog}>Hide for this Demo</button>
          </div>
          {error && <div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{error}</div>}
        </div>
        {hideDialog}
      </section>
    )
  }

  if (route === 'action' && session?.state === 'action_accepted') {
    return (
      <section className="journey-shell">
        <div className="journey-action-visual" aria-label="Rain at a window"><span>17:42</span><strong>RAIN</strong></div>
        <div className="journey-panel">
          <p className="eyebrow">Simulated action / declared by recipient</p>
          <h1 ref={headingRef} tabIndex={-1}>Pause by a window.</h1>
          <p className="journey-lead">Notice the rain or the light for one moment.</p>
          <p className="journey-attribution">Suggested by Loop / not a message from Mei</p>
          <div className="journey-actions">
            <button className="button button--primary" onClick={completeAction}>I did this</button>
            <button className="text-button" onClick={() => exit('stop')}>Stop journey</button>
          </div>
          {error && <div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{error}</div>}
        </div>
      </section>
    )
  }

  if (route === 'memory' && session && ['action_completed', 'memory_opened'].includes(session.state)) {
    const presentation = snapshot.presentation
    if (error) return <JourneyRecovery title="Memory unavailable" error={error} retry={retry} stop={() => exit('stop')} headingRef={headingRef} focusAlert={focusAlert} />
    if (loading || !presentation) return <JourneyLoading title="Preparing the approved source" headingRef={headingRef} stop={() => exit('stop')} />
    return (
      <section className="journey-memory">
        <p className="eyebrow">Sourced memory / {session.intensity}</p>
        <h1 ref={headingRef} tabIndex={-1}>The rainy walk home</h1>
        <div className="memory-layers">
          <article className="memory-layer memory-layer--original">
            <span className="tag tag--original">Original source</span>
            <h2>Mei's approved record</h2>
            <button className="button button--secondary" onClick={() => setOriginalOpen((value) => !value)}>
              {originalOpen ? 'Close original' : 'Open original'}
            </button>
            {originalOpen && <blockquote>{inlineText(presentation.original.content)}</blockquote>}
            <SourceDetails
              label={presentation.original.aiLabel}
              contextIds={presentation.original.provenance.sourceContextIds}
              assetIds={presentation.original.provenance.sourceAssetIds}
              mode={presentation.original.outputMode}
            />
          </article>
          {presentation.composition && (
            <article className="memory-layer memory-layer--composition">
              <span className="tag tag--organized">AI-generated</span>
              <h2>Approved source composition</h2>
              <p>{presentation.composition.content}</p>
              <p className="journey-attribution">This is not Mei's original wording.</p>
              <SourceDetails
                label={presentation.composition.aiLabel}
                contextIds={presentation.composition.provenance.sourceContextIds}
                assetIds={presentation.composition.provenance.sourceAssetIds}
                mode={presentation.composition.outputMode}
              />
            </article>
          )}
        </div>
        <div className="journey-actions">
          <button className="button button--primary" onClick={() => go('respond')}>Continue</button>
          <button className="text-button" onClick={() => exit('stop')}>Stop journey</button>
        </div>
      </section>
    )
  }

  if (route === 'respond' && session?.state === 'memory_opened') {
    return (
      <section className="journey-response">
        <p className="eyebrow">Present life / written by Lin</p>
        <h1 ref={headingRef} tabIndex={-1}>Leave today beside the memory.</h1>
        <p className="journey-lead">This stays recipient-authored and never becomes Mei's Context.</p>
        {error && <div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{error}</div>}
        <form onSubmit={(event) => saveResponse(event)}>
          <label htmlFor="journey-response">Lin's response today</label>
          <textarea id="journey-response" rows={5} value={draft} onChange={(event) => setDraft(event.target.value)} />
          <div className="journey-actions">
            <button className="button button--primary" type="submit" disabled={!draft.trim()}>Save and make postcard</button>
            <button className="button button--secondary" type="button" onClick={() => saveResponse(undefined, true)}>Continue without a note</button>
            <button className="text-button" type="button" onClick={() => go('memory')}>Back to memory</button>
            <button className="text-button" type="button" onClick={() => exit('stop')}>Stop journey</button>
          </div>
        </form>
      </section>
    )
  }

  if (route === 'postcard' && session && ['response_recorded', 'postcard_creating', 'postcard_created', 'node_lit', 'stopped'].includes(session.state)) {
    if (error) return <JourneyRecovery title="Postcard unavailable" error={error} retry={retry} stop={() => exit('stop')} headingRef={headingRef} focusAlert={focusAlert} />
    if (loading || !snapshot.artifact) return <JourneyLoading title="Composing the postcard" headingRef={headingRef} />
    const artifact = snapshot.artifact
    return (
      <section className="journey-postcard-page">
        <p className="eyebrow">InteractionArtifact / postcard</p>
        <h1 ref={headingRef} tabIndex={-1}>Rain, carried forward.</h1>
        <article className="journey-postcard">
          <header><span>LOOP / 01</span><span>{artifact.generationLabel}</span></header>
          <blockquote>{artifact.generatedSummary}</blockquote>
          {snapshot.presentation && (
            <div className="postcard-layers">
              <div>
                <p><strong>Original source</strong><span>{inlineText(snapshot.presentation.original.content)}</span></p>
                <SourceDetails label="Original source" contextIds={snapshot.presentation.original.provenance.sourceContextIds} assetIds={snapshot.presentation.original.provenance.sourceAssetIds} mode={snapshot.presentation.original.outputMode} />
              </div>
              {snapshot.presentation.composition && <div><p><strong>AI-generated composition</strong><span>{snapshot.presentation.composition.content}</span></p><SourceDetails label="AI-generated" contextIds={snapshot.presentation.composition.provenance.sourceContextIds} assetIds={snapshot.presentation.composition.provenance.sourceAssetIds} mode={snapshot.presentation.composition.outputMode} /></div>}
            </div>
          )}
          {artifact.recipientResponse && <p className="postcard-response">Lin today / {artifact.recipientResponse}</p>}
          <footer>
            <span>{artifact.sourceContextIds.join(', ')}</span>
            <span>{artifact.id}</span>
          </footer>
        </article>
        {nodeError && <div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{nodeError}</div>}
        <div className="journey-actions">
          {session.state === 'node_lit' || session.state === 'stopped' ? (
            <button className="button button--primary" onClick={() => go('map')}>{session.state === 'node_lit' ? 'Return to lit node' : 'Return to map'}</button>
          ) : (
            <>
              <button className="button button--primary" onClick={() => void lightNode()} disabled={loading}>{loading ? 'Lighting node...' : nodeError ? 'Retry lighting node' : 'Keep postcard and light node'}</button>
              {session.state === 'postcard_created' && <button className="text-button" onClick={() => exit('stop')}>Stop without lighting</button>}
            </>
          )}
        </div>
      </section>
    )
  }

  return <JourneyRecovery title="Journey state unavailable" error="The current route does not match the stored journey state." retry={() => go('map')} headingRef={headingRef} focusAlert={focusAlert} />
}

function JourneyLoading({ title, headingRef, stop }: { title: string; headingRef: React.RefObject<HTMLHeadingElement | null>; stop?: () => void }) {
  return <section className="journey-restart" aria-busy="true"><p className="eyebrow">Echo Map / source-backed</p><h1 ref={headingRef} tabIndex={-1}>{title}</h1><div className="journey-loading" role="status">Traveling Messenger is checking the approved source.</div><p className="journey-attribution">This request will not mark the journey complete on its own.</p>{stop && <button className="text-button" onClick={stop}>Stop journey</button>}</section>
}

function JourneyRecovery({ title, error, retry, stop, headingRef, focusAlert }: { title: string; error: string; retry: () => void; stop?: () => void; headingRef: React.RefObject<HTMLHeadingElement | null>; focusAlert: (node: HTMLDivElement | null) => void }) {
  return <section className="journey-restart"><p className="eyebrow">Echo Map / recovery</p><h1 ref={headingRef} tabIndex={-1}>{title}</h1><div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{error}</div><div className="journey-actions"><button className="button button--primary" onClick={retry}>Retry</button>{stop && <button className="text-button" onClick={stop}>Stop journey</button>}</div></section>
}
