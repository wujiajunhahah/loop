import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Interaction, RecipientChoice, RecipientSession } from '../../domain'
import { playbackService } from '../../data/services'
import type { RecipientAgentResult } from '../agent'
import type { SourceBackedInteractionArtifact } from '../artifact'
import {
  chooseRecipientAction,
  standaloneRecipientData,
  type RecipientExperienceData,
} from './session'

type RecipientPath = 'entry' | 'verify' | 'memory' | 'complete'

function getPath(contextId: string): RecipientPath {
  const path = window.location.hash.slice(1).split('?')[0]
  if (path === '/recipient/verify') return 'verify'
  if (path === `/recipient/memory/${contextId}`) return 'memory'
  if (path === '/recipient/complete') return 'complete'
  return 'entry'
}

function go(path: string) {
  window.location.hash = path
}

function getInlineOriginal(uri: string) {
  if (!uri.startsWith('data:text/plain')) return undefined
  const separator = uri.indexOf(',')
  if (separator < 0) return undefined
  try {
    return decodeURIComponent(uri.slice(separator + 1))
  } catch {
    return undefined
  }
}

function Provenance({ result }: { result: RecipientAgentResult }) {
  return (
    <dl className="source-details">
      <div><dt>来源 Context ID</dt><dd>{result.provenance.sourceContextIds.join(', ')}</dd></div>
      <div><dt>来源 Asset ID</dt><dd>{result.provenance.sourceAssetIds.join(', ')}</dd></div>
      <div><dt>生成模式</dt><dd>{result.provenance.generationMode}</dd></div>
      <div><dt>触发策略</dt><dd>pull_only · {result.triggerReason}</dd></div>
      {result.provenance.model && <div><dt>模型</dt><dd>{result.provenance.model}</dd></div>}
    </dl>
  )
}

export function RecipientExperience({ data = standaloneRecipientData }: { data?: RecipientExperienceData }) {
  const snapshot = data.getSnapshot()
  const inlineOriginal = getInlineOriginal(snapshot.asset.uri)
  const [path, setPath] = useState<RecipientPath>(() => getPath(snapshot.context.id))
  const [session, setSession] = useState<RecipientSession>(() => data.createSession())
  const [interaction, setInteraction] = useState<Interaction>()
  const [presentation, setPresentation] = useState<{ original: RecipientAgentResult; derived?: RecipientAgentResult }>()
  const [artifact, setArtifact] = useState<SourceBackedInteractionArtifact>()
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [response, setResponse] = useState('')
  const [savedResponse, setSavedResponse] = useState(false)

  useEffect(() => {
    const onHashChange = () => setPath(getPath(data.getSnapshot().context.id))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [data])

  useEffect(() => {
    if (path !== 'memory' || presentation || !interaction) return
    let cancelled = false
    setLoading(true)
    void data.loadPresentation(interaction).then((next) => {
      if (!cancelled) {
        setPresentation(next)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [data, interaction, path, presentation])

  const choose = (choice: RecipientChoice, next?: string) => {
    setSession((current) => chooseRecipientAction(current, choice))
    if (next) go(next)
  }

  const enterMemory = () => {
    setInteraction(data.createInteraction(session))
    go(`/recipient/memory/${snapshot.context.id}`)
  }

  const accept = async () => {
    if (!presentation || !interaction) return
    const nextArtifact = await data.createArtifact(interaction, presentation.derived ?? presentation.original)
    setArtifact(nextArtifact)
    setSession((current) => chooseRecipientAction(current, 'accept'))
    go('/recipient/complete')
  }

  const playOriginal = async () => {
    setPlaying(true)
    await playbackService.play({ kind: 'original', modality: snapshot.asset.modality, uri: snapshot.asset.uri, capturedAt: snapshot.asset.capturedAt })
    setPlaying(false)
  }

  const saveResponse = async (event: FormEvent) => {
    event.preventDefault()
    if (!response.trim() || !interaction || !presentation) return
    const nextArtifact = await data.createArtifact(interaction, presentation.derived ?? presentation.original, response)
    setArtifact(nextArtifact)
    setSavedResponse(true)
    setResponse('')
  }

  const restart = () => {
    setSession(data.createSession())
    setInteraction(undefined)
    setPresentation(undefined)
    setArtifact(undefined)
    setSavedResponse(false)
    go('/recipient')
  }

  if (path === 'entry') {
    return <section className="recipient-shell"><p className="eyebrow">Recipient request · pull_only</p><h1>这里有一段只留给你的东西。</h1><p className="recipient-lead">来自 {snapshot.recipient.subjectName} 的一段已授权记录。不会自动播放，也不会在你没有进入前主动送达。</p><div className="recipient-entry"><div><p className="micro-label">来源 · {snapshot.recipient.name} · {snapshot.recipient.relationshipLabel}</p><h2>{snapshot.context.topic}</h2><p>由你决定是否确认身份、查看来源和继续。硬件与共同计划都不是进入条件。</p></div><button className="button button--primary" onClick={() => go('/recipient/verify')}>主动进入 <span aria-hidden="true">→</span></button></div><button className="text-button" onClick={() => choose('close', '/')}>关闭这段入口</button></section>
  }

  if (path === 'verify') {
    return <section className="recipient-shell"><p className="eyebrow">Identity check · user initiated</p><h1>这是给你的吗？</h1><p className="recipient-lead">它来自 {snapshot.recipient.subjectName}，关系标记为“{snapshot.recipient.relationshipLabel}”。确认后才会建立这次接收者主动进入。</p><div className="choice-list"><button className="choice choice--strong" onClick={enterMemory}><span>是我的，打开看看</span><span aria-hidden="true">→</span></button><button className="choice" onClick={() => choose('postpone', '/')}><span>现在不看，稍后再说</span><span aria-hidden="true">↓</span></button><button className="choice" onClick={() => choose('skip', '/')}><span>跳过这次</span><span aria-hidden="true">×</span></button></div><button className="text-button" onClick={() => choose('close', '/')}>关闭</button></section>
  }

  if (path === 'memory') {
    if (!interaction) return <section className="recipient-shell"><p className="eyebrow">Recipient request · restart required</p><h1>这次查看需要重新确认。</h1><p className="recipient-lead">页面刷新后不会恢复接收者授权状态。请从入口重新主动进入，系统不会绕过身份确认。</p><button className="button button--primary" onClick={restart}>回到接收者入口</button></section>
    if (loading || !presentation) return <section className="recipient-shell"><p className="eyebrow">Recipient request · source-backed</p><h1>正在准备留给你的内容。</h1><p className="recipient-lead">只整理已授权来源，不会替 Mei 生成新的事实、决定或自由对话。</p></section>
    return <section className="recipient-shell"><p className="eyebrow">Source-backed interaction</p><h1>{snapshot.context.topic}</h1><p className="recipient-lead">来源、生成模式和 AI 状态都可以在下方检查。</p><div className="provenance-grid"><article><span className="tag tag--original">Original source</span><h2>{snapshot.asset.modality === 'audio' ? '真实留下的声音' : '真实留下的原始内容'}</h2><p>原始素材保持不变。你准备好后，再主动查看或播放。</p>{inlineOriginal && <blockquote className="original-content">{inlineOriginal}</blockquote>}<button className="button button--secondary" onClick={() => void playOriginal()} disabled={playing}>{playing ? '正在播放原声' : snapshot.asset.modality === 'audio' ? '播放原声' : '查看原始内容'} <span aria-hidden="true">▶</span></button><Provenance result={presentation.original} /></article>{presentation.derived && <article><span className="tag tag--organized">AI-generated</span><h2>{presentation.derived.content}</h2><p>这是基于已授权 Context 的整理内容，不是 {snapshot.recipient.subjectName} 的原话。</p><Provenance result={presentation.derived} /></article>}</div><div className="recipient-actions"><button className="button button--primary" onClick={() => void accept()}>接受并保存明信片 <span aria-hidden="true">→</span></button><button className="button button--secondary" onClick={() => choose('postpone', '/')}>稍后查看</button><button className="text-button" onClick={() => choose('skip', '/')}>跳过</button><button className="text-button" onClick={() => choose('close', '/')}>关闭</button></div></section>
  }

  if (!artifact) return <section className="recipient-shell"><p className="eyebrow">InteractionArtifact · restart required</p><h1>这次明信片尚未生成。</h1><p className="recipient-lead">页面刷新后不会伪造已完成的互动。请重新主动进入并选择保存明信片。</p><button className="button button--primary" onClick={restart}>回到接收者入口</button></section>

  return <section className="recipient-shell"><p className="eyebrow">InteractionArtifact · postcard</p><h1>这张远行明信片已经为你留存。</h1><p className="recipient-lead">它只记录这次接收者主动进入的结果，不会自动回写为 {snapshot.recipient.subjectName} 的内容。</p><div className="completion-grid"><div className="completion-number">01</div><div><span className="tag tag--organized">{artifact.generationLabel}</span><h2>{artifact.generatedSummary}</h2><p>Artifact ID · {artifact.id}<br />来源 Context ID · {artifact.sourceContextIds.join(', ')}</p></div></div><form className="response-form" onSubmit={(event) => void saveResponse(event)}><label htmlFor="recipient-response">留下一个接收者回应</label><textarea id="recipient-response" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="今天想记下什么？" rows={4} /><button className="button button--primary" type="submit">保存回应 <span aria-hidden="true">↗</span></button>{savedResponse && <p className="form-note" role="status">已保存为 recipient-authored response。</p>}</form><button className="text-button" onClick={restart}>回到入口</button></section>
}
