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

const intensityLabels: Record<JourneyIntensity, string> = {
  quiet: '安静',
  glimmer: '微光',
  deep: '深入',
}

const nodeStatusLabels: Record<string, string> = {
  available: '可进入',
  lit: '旅程已连接',
  hidden: '已隐藏',
  rejected: '已拒绝',
}

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
      <div><dt>内容层</dt><dd>{label}</dd></div>
      <div><dt>Context</dt><dd>{contextIds.join(', ')}</dd></div>
      <div><dt>Asset</dt><dd>{assetIds.join(', ')}</dd></div>
      <div><dt>生成模式</dt><dd>{mode}</dd></div>
      <div><dt>触发方式</dt><dd>仅主动进入 / 由接收者打开</dd></div>
    </dl>
  )
}

function MapSurface({ status }: { status: string }) {
  return (
    <div className={`echo-map echo-map--${status}`} aria-label={`Echo Map 记忆节点：${nodeStatusLabels[status] ?? status}`}>
      <div className="echo-map__weather" aria-hidden="true">雨 / 17:40</div>
      <div className="echo-map__line" aria-hidden="true" />
      <div className="echo-map__messenger" aria-label="中立信使">信</div>
      <div className="echo-map__node" aria-hidden="true"><span /></div>
      <div className="echo-map__label">
        <strong>同一把伞下的雨</strong>
        <span>{nodeStatusLabels[status] ?? status}</span>
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
          setError(reason instanceof Error ? reason.message : '记忆暂时不可用。')
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
          setError(reason instanceof Error ? reason.message : '明信片暂时不可用。')
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
        <p className="eyebrow">本次 Demo · 关系范围</p>
        <h2 id="hide-title">隐藏这段旅程？</h2>
        <p>隐藏后，这段关系在本次 Demo 重置前不会再看到它。</p>
        <div className="journey-actions">
          <button className="button button--primary" onClick={() => { setConfirmHide(false); exit('hide') }}>确认隐藏</button>
          <button className="button button--secondary" onClick={() => setConfirmHide(false)}>取消</button>
        </div>
      </div>
    </div>
  ) : null

  if (route !== 'map' && !session) {
    return (
      <section className="journey-restart">
        <p className="eyebrow">Echo Map · 需要重新进入</p>
        <h1 ref={headingRef} tabIndex={-1}>这段旅程需要重新确认。</h1>
        <p>页面地址不会恢复内存中的授权。当前没有完成动作、明信片或记忆节点。</p>
        <button className="button button--primary" onClick={() => go('map')}>返回 Echo Map</button>
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
          <p className="eyebrow">Echo Map · Mei 留给 Lin · 仅主动进入</p>
          <h1 ref={headingRef} tabIndex={-1}>同一把伞下的雨</h1>
          {mapComplete ? (
            <>
              <p className="journey-lead">一段真实来源、一句今天的回应和一张明信片，已经连接在这里。</p>
              <div className="journey-complete-mark" role="status">记忆节点已点亮 · 旅程完成</div>
              <button className="button button--secondary" onClick={() => go('postcard')}>打开明信片</button>
            </>
          ) : unavailable ? (
            <>
              <p className="journey-lead">这段旅程在当前 Demo 中{mapStatus === 'hidden' ? '已被隐藏' : '已被拒绝'}。</p>
              <button className="button button--secondary" onClick={() => window.location.hash = '/recipient'}>返回接收者入口</button>
            </>
          ) : session && resumeRoute(session.state) ? (
            <>
              <p className="journey-lead">这段旅程仍在进行中。切换页面不会把它误标为完成。</p>
              <button className="button button--primary" onClick={() => go(resumeRoute(session.state)!)}>继续旅程</button>
            </>
          ) : (
            <>
              <p className="journey-lead">中立信使找到了一段经过确认的雨天记忆。任何内容都不会自动打开。</p>
              <fieldset className="intensity-control">
                <legend>旅程强度</legend>
                {(['quiet', 'glimmer', 'deep'] as const).map((value) => (
                  <label key={value} className={intensity === value ? 'is-selected' : undefined}>
                    <input
                      type="radio"
                      name="journey-intensity"
                      value={value}
                      checked={intensity === value}
                      onChange={() => setIntensity(value)}
                    />
                    <span>{intensityLabels[value]}</span>
                  </label>
                ))}
              </fieldset>
              <div className="journey-actions">
                <button className="button button--primary" onClick={beginAndInspect}>查看这段旅程</button>
                <button className="text-button" onClick={openHideDialog}>在本次 Demo 中隐藏</button>
                <button className="text-button" onClick={() => exit('close')}>关闭</button>
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
          <p className="eyebrow">旅程建议 · 已查看 · {intensityLabels[proposal.intensity]}</p>
          <h1 ref={headingRef} tabIndex={-1}>同一把伞下的雨</h1>
          <p className="journey-lead">W·HERE 为这次由你主动打开的旅程，找到了一段经过确认的雨天记忆。</p>
          <div className="proposal-evidence">
            <span>W·HERE 提供的中立动作</span>
            <strong>在窗边停一会儿，看看雨，或者此刻落进来的光。</strong>
            <small>不是 Mei 的留言 · 不是 AI 生成内容</small>
          </div>
          <SourceDetails
            label="经过确认的来源"
            contextIds={proposal.sourceSelection.sourceContextIds}
            assetIds={proposal.sourceSelection.sourceAssetIds}
            mode={proposal.sourceSelection.requestedModes.join(' + ')}
          />
          <div className="journey-actions">
            <button className="button button--primary" onClick={acceptAction}>采用中立动作</button>
            <button className="button button--secondary" onClick={() => go('map')}>返回地图</button>
            <button className="text-button" onClick={() => exit('skip')}>这次跳过</button>
            <button className="text-button" onClick={() => exit('reject')}>拒绝这条建议</button>
            <button className="text-button" onClick={openHideDialog}>在本次 Demo 中隐藏</button>
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
        <div className="journey-action-visual" aria-label="窗边的雨"><span>17:42</span><strong>雨</strong></div>
        <div className="journey-panel">
          <p className="eyebrow">模拟动作 · 由接收者确认</p>
          <h1 ref={headingRef} tabIndex={-1}>在窗边停一会儿。</h1>
          <p className="journey-lead">看一眼雨，或者此刻落进来的光。</p>
          <p className="journey-attribution">由 W·HERE 建议 · 不是 Mei 的留言</p>
          <div className="journey-actions">
            <button className="button button--primary" onClick={completeAction}>我已经做了</button>
            <button className="text-button" onClick={() => exit('stop')}>结束旅程</button>
          </div>
          {error && <div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{error}</div>}
        </div>
      </section>
    )
  }

  if (route === 'memory' && session && ['action_completed', 'memory_opened'].includes(session.state)) {
    const presentation = snapshot.presentation
    if (error) return <JourneyRecovery title="记忆暂时无法打开" error={error} retry={retry} stop={() => exit('stop')} headingRef={headingRef} focusAlert={focusAlert} />
    if (loading || !presentation) return <JourneyLoading title="正在准备经过确认的来源" headingRef={headingRef} stop={() => exit('stop')} />
    return (
      <section className="journey-memory">
        <p className="eyebrow">有来源的记忆 · {intensityLabels[session.intensity!]}</p>
        <h1 ref={headingRef} tabIndex={-1}>那次雨中回家。</h1>
        <div className="memory-layers">
          <article className="memory-layer memory-layer--original">
            <span className="tag tag--original">真实原始来源</span>
            <h2>Mei 确认过的记录</h2>
            <button className="button button--secondary" onClick={() => setOriginalOpen((value) => !value)}>
              {originalOpen ? '收起原始内容' : '打开原始内容'}
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
              <span className="tag tag--organized">AI 生成 · 明确标记</span>
              <h2>基于授权来源的整理</h2>
              <p>{presentation.composition.content}</p>
              <p className="journey-attribution">这不是 Mei 的原话。</p>
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
          <button className="button button--primary" onClick={() => go('respond')}>继续</button>
          <button className="text-button" onClick={() => exit('stop')}>结束旅程</button>
        </div>
      </section>
    )
  }

  if (route === 'respond' && session?.state === 'memory_opened') {
    return (
      <section className="journey-response">
        <p className="eyebrow">今天 · 由 Lin 写下</p>
        <h1 ref={headingRef} tabIndex={-1}>把今天，放在记忆旁边。</h1>
        <p className="journey-lead">这段话始终属于接收者，不会成为 Mei 的 Context。</p>
        {error && <div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{error}</div>}
        <form onSubmit={(event) => saveResponse(event)}>
          <label htmlFor="journey-response">Lin 今天的回应</label>
          <textarea id="journey-response" rows={5} value={draft} onChange={(event) => setDraft(event.target.value)} />
          <div className="journey-actions">
            <button className="button button--primary" type="submit" disabled={!draft.trim()}>保存并生成明信片</button>
            <button className="button button--secondary" type="button" onClick={() => saveResponse(undefined, true)}>不写回应，继续</button>
            <button className="text-button" type="button" onClick={() => go('memory')}>返回记忆</button>
            <button className="text-button" type="button" onClick={() => exit('stop')}>结束旅程</button>
          </div>
        </form>
      </section>
    )
  }

  if (route === 'postcard' && session && ['response_recorded', 'postcard_creating', 'postcard_created', 'node_lit', 'stopped'].includes(session.state)) {
    if (error) return <JourneyRecovery title="明信片暂时无法生成" error={error} retry={retry} stop={() => exit('stop')} headingRef={headingRef} focusAlert={focusAlert} />
    if (loading || !snapshot.artifact) return <JourneyLoading title="正在整理这张明信片" headingRef={headingRef} />
    const artifact = snapshot.artifact
    return (
      <section className="journey-postcard-page">
        <p className="eyebrow">互动纪念物 · 明信片</p>
        <h1 ref={headingRef} tabIndex={-1}>雨，被带到了今天。</h1>
        <article className="journey-postcard">
          <header><span>W·HERE / 01</span><span>{artifact.generationLabel}</span></header>
          <blockquote>{artifact.generatedSummary}</blockquote>
          {snapshot.presentation && (
            <div className="postcard-layers">
              <div>
                 <p><strong>真实原始来源</strong><span>{inlineText(snapshot.presentation.original.content)}</span></p>
                 <SourceDetails label="真实原始来源" contextIds={snapshot.presentation.original.provenance.sourceContextIds} assetIds={snapshot.presentation.original.provenance.sourceAssetIds} mode={snapshot.presentation.original.outputMode} />
              </div>
               {snapshot.presentation.composition && <div><p><strong>AI 生成整理</strong><span>{snapshot.presentation.composition.content}</span></p><SourceDetails label="AI 生成 · 明确标记" contextIds={snapshot.presentation.composition.provenance.sourceContextIds} assetIds={snapshot.presentation.composition.provenance.sourceAssetIds} mode={snapshot.presentation.composition.outputMode} /></div>}
            </div>
          )}
          {artifact.recipientResponse && <p className="postcard-response">Lin 今天 · {artifact.recipientResponse}</p>}
          <footer>
            <span>{artifact.sourceContextIds.join(', ')}</span>
            <span>{artifact.id}</span>
          </footer>
        </article>
        {nodeError && <div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{nodeError}</div>}
        <div className="journey-actions">
          {session.state === 'node_lit' || session.state === 'stopped' ? (
            <button className="button button--primary" onClick={() => go('map')}>{session.state === 'node_lit' ? '返回已点亮的节点' : '返回地图'}</button>
          ) : (
            <>
              <button className="button button--primary" onClick={() => void lightNode()} disabled={loading}>{loading ? '正在点亮节点...' : nodeError ? '重试点亮节点' : '收藏明信片并点亮节点'}</button>
              {session.state === 'postcard_created' && <button className="text-button" onClick={() => exit('stop')}>保留明信片，不点亮</button>}
            </>
          )}
        </div>
      </section>
    )
  }

  return <JourneyRecovery title="旅程状态暂时不可用" error="当前页面与已保存的旅程状态不一致。" retry={() => go('map')} headingRef={headingRef} focusAlert={focusAlert} />
}

function JourneyLoading({ title, headingRef, stop }: { title: string; headingRef: React.RefObject<HTMLHeadingElement | null>; stop?: () => void }) {
  return <section className="journey-restart" aria-busy="true"><p className="eyebrow">Echo Map · 有来源</p><h1 ref={headingRef} tabIndex={-1}>{title}</h1><div className="journey-loading" role="status">中立信使正在检查经过确认的来源。</div><p className="journey-attribution">仅加载内容不会把这段旅程标记为完成。</p>{stop && <button className="text-button" onClick={stop}>结束旅程</button>}</section>
}

function JourneyRecovery({ title, error, retry, stop, headingRef, focusAlert }: { title: string; error: string; retry: () => void; stop?: () => void; headingRef: React.RefObject<HTMLHeadingElement | null>; focusAlert: (node: HTMLDivElement | null) => void }) {
  return <section className="journey-restart"><p className="eyebrow">Echo Map · 恢复</p><h1 ref={headingRef} tabIndex={-1}>{title}</h1><div ref={focusAlert} className="journey-error" role="alert" tabIndex={-1}>{error}</div><div className="journey-actions"><button className="button button--primary" onClick={retry}>重试</button>{stop && <button className="text-button" onClick={stop}>结束旅程</button>}</div></section>
}
