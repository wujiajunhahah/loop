import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Memory, RecipientChoice, RecipientSession } from '../../domain'
import type { RecipientAgentView } from '../agent'
import { contextCaptureService, demoMemories, demoRecipientSessions, plannedInteractionService, relationshipAgent, playbackService } from '../../data/services'
import { simulatorBridge } from '../hardware/simulatorStore'
import { chooseRecipientAction, demoPlan, demoRecipient, createRecipientSession } from './session'

type RecipientPath = 'entry' | 'verify' | 'memory' | 'plan' | 'complete'

function getPath(): RecipientPath {
  const path = window.location.hash.slice(1).split('?')[0]
  if (path === '/recipient/verify') return 'verify'
  if (path.startsWith('/recipient/memory/')) return 'memory'
  if (path.startsWith('/recipient/plan/')) return 'plan'
  if (path === '/recipient/complete') return 'complete'
  return 'entry'
}

function go(path: string) {
  window.location.hash = path
}

export function RecipientExperience() {
  const [path, setPath] = useState<RecipientPath>(getPath)
  const [session, setSession] = useState<RecipientSession>(() => createRecipientSession())
  const [presentation, setPresentation] = useState<RecipientAgentView>()
  const [memory, setMemory] = useState<Memory>()
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [response, setResponse] = useState('')
  const [savedResponse, setSavedResponse] = useState(false)

  useEffect(() => {
    const onHashChange = () => setPath(getPath())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => simulatorBridge.subscribe((event) => {
    if ((event.eventType === 'touch' || event.eventType === 'simulated') && event.recipientId === demoRecipient.id) {
      go('/recipient/verify')
    }
  }), [])

  useEffect(() => {
    if (path !== 'memory' || presentation) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const activeSession = demoRecipientSessions.find((item) => item.id === session.id)
      if (!activeSession) demoRecipientSessions.push(session)
      const composed = await relationshipAgent.enter({
        relationshipId: demoRecipient.relationshipId,
        sessionId: session.id,
        delivery: 'recipient_request',
      })
      const memory = demoMemories.find((item) => item.id === composed.content.memoryId)
      if (!cancelled) {
        setPresentation(composed)
        setMemory(memory)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, presentation, session.id])

  const choose = (choice: RecipientChoice, next?: string) => {
    setSession((current) => chooseRecipientAction(current, choice))
    if (choice === 'accept') {
      try {
        plannedInteractionService.transition(
          demoRecipient.relationshipId,
          demoPlan.id,
          'accepted',
        )
      } catch {
        // The session choice remains authoritative if the plan was already advanced.
      }
    }
    if (next) go(next)
  }

  const continuePlan = () => {
    try {
      plannedInteractionService.transition(
        demoRecipient.relationshipId,
        demoPlan.id,
        'completed',
      )
    } catch {
      // The recipient can still continue the visible offline demo state.
    }
    go('/recipient/complete')
  }

  const playOriginal = async () => {
    if (!memory) return
    setPlaying(true)
    await playbackService.play(memory.original)
  }

  const saveResponse = async (event: FormEvent) => {
    event.preventDefault()
    if (!response.trim() || !memory) return
    await contextCaptureService.capture({
      ownerId: demoRecipient.id,
      relationshipId: demoRecipient.relationshipId,
      recipientId: demoRecipient.id,
      topic: 'Lin 的回应',
      meaning: response.trim(),
      visibility: 'relationship_specific',
      original: {
        kind: 'original',
        modality: 'text',
        uri: `memory://recipient-response/${Date.now()}`,
        capturedAt: new Date().toISOString(),
      },
    })
    setSavedResponse(true)
    setResponse('')
  }

  if (path === 'entry') {
    return <section className="recipient-shell"><p className="eyebrow">A private place for you</p><h1>这里有一段只留给你的东西。</h1><p className="recipient-lead">你可以从戒指的触碰进入，也可以在 Demo 中主动打开。什么时候靠近，由你决定。</p><div className="recipient-entry"><div><span className="ring-mark" aria-hidden="true">○</span><p className="micro-label">来自 Mei · {demoRecipient.relationshipLabel}</p><h2>母亲想和你继续做五道菜</h2><p>没有自动播放，也没有必须完成的事情。先确认这是你的入口。</p></div><button className="button button--primary" onClick={() => go('/recipient/verify')}>主动进入 <span aria-hidden="true">→</span></button></div><button className="text-button" onClick={() => choose('close', '/')}>永久关闭这段入口</button></section>
  }

  if (path === 'verify') {
    return <section className="recipient-shell"><p className="eyebrow">Step 01 · Your choice</p><h1>这是给你的吗？</h1><p className="recipient-lead">它来自 Mei，关系标记是“{demoRecipient.relationshipLabel}”。确认后，Loop 才会为你整理这一次进入的内容。</p><div className="choice-list"><button className="choice choice--strong" onClick={() => go('/recipient/memory/memory-tomato-eggs')}><span>是我的，打开看看</span><span aria-hidden="true">→</span></button><button className="choice" onClick={() => choose('postpone', '/')}><span>现在还不想看，稍后再说</span><span aria-hidden="true">↓</span></button><button className="choice" onClick={() => choose('skip', '/')}><span>跳过这次</span><span aria-hidden="true">×</span></button></div><button className="text-button" onClick={() => choose('close', '/')}>永久关闭</button></section>
  }

  if (path === 'memory') {
    if (loading) return <section className="recipient-shell"><p className="eyebrow">Step 02 · A real memory</p><h1>正在准备留给你的内容。</h1><p className="recipient-lead">只从已确认的关系内容中整理，不会替 Mei 生成新的话。</p></section>
    return <section className="recipient-shell"><p className="eyebrow">Step 02 · A real memory</p><h1>{memory?.topic ?? '这段内容暂时无法打开'}</h1><p className="recipient-lead">{memory?.meaning}</p><div className="provenance-grid"><article><span className="tag tag--original">原始内容</span><h2>Mei 真实留下的声音</h2><p>这是一段未经改写的录音。你准备好后，再主动播放。</p><button className="button button--secondary" onClick={() => void playOriginal()} disabled={playing}>{playing ? '正在播放原声' : '播放原声'} <span aria-hidden="true">▶</span></button></article><article><span className="tag tag--organized">AI 整理内容</span><h2>{presentation?.content.provenance === 'ai_organized' ? presentation.content.text : '这条记录未授权 AI 整理'}</h2><p>只帮助你找到入口，来源仍然是 Mei 审核过的真实记录。</p></article></div><div className="recipient-actions"><button className="button button--primary" onClick={() => choose('accept', `/recipient/plan/${demoPlan.id}`)}>接受这段邀请 <span aria-hidden="true">→</span></button><button className="button button--secondary" onClick={() => choose('postpone', '/')}>稍后查看</button><button className="text-button" onClick={() => choose('skip', '/')}>跳过</button></div></section>
  }

  if (path === 'plan') {
    return <section className="recipient-shell"><p className="eyebrow">Step 03 · An invitation</p><h1>{demoPlan.title}</h1><p className="recipient-lead">这不是 Mei 留下的任务，而是一件你可以选择继续的共同小事。</p><div className="plan-progress"><div><strong>第 1 道</strong><span> / {demoPlan.totalSteps} 道</span></div><div className="progress-track"><span /></div><p>番茄炒蛋 · 先从最熟悉的一道开始</p></div><blockquote>“{demoPlan.invitation}”</blockquote><div className="recipient-actions"><button className="button button--primary" onClick={continuePlan}>继续这项计划 <span aria-hidden="true">→</span></button><button className="button button--secondary" onClick={() => choose('postpone', '/')}>以后再决定</button><button className="text-button" onClick={() => choose('close', '/')}>关闭这项计划</button></div></section>
  }

  return <section className="recipient-shell"><p className="eyebrow">Completed for today</p><h1>你们的下一步，已经留出位置。</h1><p className="recipient-lead">第一道菜被点亮了。关系不会因为一次打开就结束，也不需要今天完成全部五道。</p><div className="completion-grid"><div className="completion-number">01<span>/05</span></div><div><h2>番茄炒蛋</h2><p>下一次，你可以从厨房里继续这段共同计划。</p></div></div><form className="response-form" onSubmit={(event) => void saveResponse(event)}><label htmlFor="recipient-response">留下一个回应或记录</label><textarea id="recipient-response" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="今天想记下什么？" rows={4} /><button className="button button--primary" type="submit">保存回应 <span aria-hidden="true">↗</span></button>{savedResponse && <p className="form-note" role="status">已保存到你们的关系记录。</p>}</form><button className="text-button" onClick={() => { setSession(createRecipientSession()); setPresentation(undefined); setMemory(undefined); go('/recipient') }}>回到入口</button><span className="sr-only">Session status: {session.status}</span></section>
}
