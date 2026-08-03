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

type RecipientPath = 'entry' | 'verify' | 'share' | 'memory' | 'complete'

let echoMapEntryAuthorized = false

export function authorizeEchoMapEntry() {
  echoMapEntryAuthorized = true
}

export function clearEchoMapEntryAuthorization() {
  echoMapEntryAuthorized = false
}

export function isEchoMapEntryAuthorized() {
  return echoMapEntryAuthorized
}

function getPath(contextId: string): RecipientPath {
  const path = window.location.hash.slice(1).split('?')[0]
  if (path === '/recipient/verify') return 'verify'
  if (path === '/recipient/share') return 'share'
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
  const relationshipLabel = snapshot.recipient.relationshipLabel === 'Mother and daughter' ? '母女' : snapshot.recipient.relationshipLabel
  const contextTopic = snapshot.context.id === 'context-rainy-day' ? '那次雨中回家' : snapshot.context.topic
  const inlineOriginal = getInlineOriginal(snapshot.asset.uri)
  const [path, setPath] = useState<RecipientPath>(() => getPath(snapshot.context.id))
  const [session, setSession] = useState<RecipientSession>(() => data.createSession())
  const [interaction, setInteraction] = useState<Interaction>()
  const [presentation, setPresentation] = useState<{ original: RecipientAgentResult; derived?: RecipientAgentResult }>()
  const [artifact, setArtifact] = useState<SourceBackedInteractionArtifact>()
  const [loading, setLoading] = useState(false)
  const [presentationError, setPresentationError] = useState('')
  const [artifactError, setArtifactError] = useState('')
  const [savingArtifact, setSavingArtifact] = useState(false)
  const [savingResponse, setSavingResponse] = useState(false)
  const [playbackError, setPlaybackError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [response, setResponse] = useState('')
  const [savedResponse, setSavedResponse] = useState(false)
  const [presentModality, setPresentModality] = useState<'text' | 'image'>('text')
  const [presentContent, setPresentContent] = useState('')

  useEffect(() => {
    const onHashChange = () => setPath(getPath(data.getSnapshot().context.id))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [data])

  useEffect(() => {
    if (path !== 'memory' || presentation || presentationError || !interaction) return
    let cancelled = false
    setLoading(true)
    void data.loadPresentation(interaction)
      .then((next) => {
        if (!cancelled) setPresentation(next)
      })
      .catch((error: unknown) => {
        if (!cancelled) setPresentationError(error instanceof Error ? error.message : '内容加载失败，请重试。')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [data, interaction, path, presentationError])

  const choose = (choice: RecipientChoice, next?: string) => {
    setSession((current) => chooseRecipientAction(current, choice))
    if (next) go(next)
  }

  const enterMemory = (event: FormEvent) => {
    event.preventDefault()
    if (!presentContent.trim()) return
    setPresentationError('')
    setArtifactError('')
    setPlaybackError('')
    setInteraction(data.createInteraction(session, {
      modality: presentModality,
      content: presentContent,
    }))
    go(`/recipient/memory/${snapshot.context.id}`)
  }

  const accept = async () => {
    if (!presentation || !interaction) return
    setSavingArtifact(true)
    setArtifactError('')
    try {
      const nextArtifact = await data.createArtifact(interaction, presentation.derived ?? presentation.original)
      setArtifact(nextArtifact)
      setSession((current) => chooseRecipientAction(current, 'accept'))
      go('/recipient/complete')
    } catch (error) {
      setArtifactError(error instanceof Error ? error.message : '明信片保存失败，请重试。')
    } finally {
      setSavingArtifact(false)
    }
  }

  const playOriginal = async () => {
    setPlaying(true)
    setPlaybackError('')
    try {
      await playbackService.play({ kind: 'original', modality: snapshot.asset.modality, uri: snapshot.asset.uri, capturedAt: snapshot.asset.capturedAt })
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : '原始内容播放失败，请重试。')
    } finally {
      setPlaying(false)
    }
  }

  const saveResponse = async (event: FormEvent) => {
    event.preventDefault()
    if (!response.trim() || !interaction || !presentation) return
    setSavingResponse(true)
    setArtifactError('')
    try {
      const nextArtifact = await data.createArtifact(interaction, presentation.derived ?? presentation.original, response)
      setArtifact(nextArtifact)
      setSavedResponse(true)
      setResponse('')
    } catch (error) {
      setArtifactError(error instanceof Error ? error.message : '回应保存失败，请重试。')
    } finally {
      setSavingResponse(false)
    }
  }

  const restart = () => {
    setSession(data.createSession())
    setInteraction(undefined)
    setPresentation(undefined)
    setArtifact(undefined)
    setSavedResponse(false)
    setPresentModality('text')
    setPresentContent('')
    go('/recipient')
  }

  if (path === 'entry') {
    return <section className="recipient-shell"><p className="eyebrow">W·HERE · 仅主动进入</p><h1>你想说话的时候，记忆仍在这里。</h1><p className="recipient-lead">这里保存着 {snapshot.recipient.subjectName} 留给你的一段真实记录。它不会主动播放，也不会在你没有进入前出现。</p><div className="recipient-entry"><div><p className="micro-label">留给 · {snapshot.recipient.name} · {relationshipLabel}</p><h2>{contextTopic}</h2><p>由你决定是否确认身份、分享此刻、查看来源和继续。</p></div><button className="button button--primary" onClick={() => go('/recipient/verify')}>主动进入 <span aria-hidden="true">→</span></button></div><button className="text-button" onClick={() => choose('close', '/')}>暂时离开</button></section>
  }

  if (path === 'verify') {
    return <section className="recipient-shell"><p className="eyebrow">身份确认 · 由你发起</p><h1>这是留给你的吗？</h1><p className="recipient-lead">它来自 {snapshot.recipient.subjectName}，关系标记为“{relationshipLabel}”。确认后才会开始这次互动。</p><div className="choice-list"><button className="choice choice--strong" onClick={() => { authorizeEchoMapEntry(); go('/recipient/echo-map') }}><span>进入 Echo Map 旅程</span><span aria-hidden="true">→</span></button><button className="choice" onClick={() => go('/recipient/share')}><span>继续到今天的回应</span><span aria-hidden="true">→</span></button><button className="choice" onClick={() => choose('postpone', '/')}><span>现在不看，稍后再说</span><span aria-hidden="true">↓</span></button><button className="choice" onClick={() => choose('skip', '/')}><span>跳过这次</span><span aria-hidden="true">×</span></button></div><button className="text-button" onClick={() => choose('close', '/')}>关闭</button></section>
  }

  if (path === 'share') {
    return <section className="recipient-shell"><p className="eyebrow">今天 · 由接收者提供</p><h1>今天发生了什么？</h1><p className="recipient-lead">说一句此刻想说的话，W·HERE 会在经过本人确认的记忆里寻找回应。你的内容始终属于你，不会被写成 {snapshot.recipient.subjectName} 的经历。</p><form className="present-form" onSubmit={enterMemory}><fieldset className="moment-mode"><legend className="sr-only">内容类型</legend><label className={presentModality === 'text' ? 'selected' : ''}><input type="radio" name="present-modality" value="text" checked={presentModality === 'text'} onChange={() => setPresentModality('text')} />文字</label><label className={presentModality === 'image' ? 'selected' : ''}><input type="radio" name="present-modality" value="image" checked={presentModality === 'image'} onChange={() => setPresentModality('image')} />照片描述</label></fieldset><label className="field" htmlFor="present-context"><span>今天发生了什么？</span><textarea id="present-context" value={presentContent} onChange={(event) => setPresentContent(event.target.value)} placeholder={presentModality === 'image' ? '描述这张照片，例如：下雨了，我站在公司门口，没有带伞。' : '例如：今天下雨，我又忘记带伞了。'} rows={5} required /></label><button className="sample-button" type="button" onClick={() => setPresentContent('今天下雨，我又忘记带伞了。')}>使用雨天 Demo 内容</button><div className="recipient-actions"><button className="button button--primary" type="submit" disabled={!presentContent.trim()}>让过去的记忆回应现在 <span aria-hidden="true">→</span></button><button className="text-button" type="button" onClick={() => choose('close', '/')}>不继续</button></div></form></section>
  }

  if (path === 'memory') {
    if (!interaction) return <section className="recipient-shell"><p className="eyebrow">接收者请求 · 需要重新进入</p><h1>这次查看需要重新确认。</h1><p className="recipient-lead">页面刷新后不会恢复接收者授权状态。请从入口重新主动进入，系统不会绕过身份确认。</p><button className="button button--primary" onClick={restart}>回到接收者入口</button></section>
    if (presentationError) return <section className="recipient-shell"><p className="eyebrow">接收者请求 · 恢复</p><h1>内容暂时无法打开。</h1><p className="recipient-lead">Agent 没有返回可验证内容，当前互动仍未完成。</p><div className="form-errors" role="alert">{presentationError}</div><button className="button button--primary" onClick={() => { setPresentationError(''); setLoading(true) }}>重试加载</button><button className="text-button" onClick={() => choose('close', '/')}>关闭</button></section>
    if (loading || !presentation) return <section className="recipient-shell" aria-busy="true"><p className="eyebrow">接收者请求 · 有来源</p><h1>正在准备留给你的内容。</h1><p className="recipient-lead" role="status">只整理已授权来源，不会替 Mei 生成新的事实、决定或自由对话。</p></section>
    return <section className="recipient-shell"><p className="eyebrow">过去回应现在 · 有来源</p><h1>一份给今天的回应。</h1><p className="recipient-lead">先看你刚刚分享的此刻，再检查它连接了哪段真实记忆。</p>{artifactError && <div className="form-errors" role="alert">{artifactError}</div>}{playbackError && <div className="form-errors" role="alert">{playbackError}</div>}<div className="present-moment"><span className="tag tag--present">今天 · {interaction.presentContext?.modality === 'image' ? '照片描述' : '文字'}</span><p>{interaction.presentContext?.content}</p><small>由接收者写下 · 不会写入 {snapshot.recipient.subjectName} 的 Context</small></div><div className="provenance-grid"><article><span className="tag tag--original">真实原始来源</span><h2>{snapshot.asset.modality === 'audio' ? '本人留下的声音' : '本人留下的话'}</h2><p>原始素材保持不变，下面内容来自 {snapshot.recipient.subjectName} 本人的记录。</p>{inlineOriginal && <blockquote className="original-content">{inlineOriginal}</blockquote>}<button className="button button--secondary" onClick={() => void playOriginal()} disabled={playing}>{playing ? '正在播放原声' : snapshot.asset.modality === 'audio' ? '播放原声' : '查看原始内容'} <span aria-hidden="true">▶</span></button><Provenance result={presentation.original} /></article>{presentation.derived && <article><span className="tag tag--organized">AI 生成 · 明确标记</span><h2>{presentation.derived.content}</h2><p>这是连接今天与授权来源的有限生成，不是 {snapshot.recipient.subjectName} 的原话，也没有新增事实。</p><Provenance result={presentation.derived} /></article>}</div><div className="recipient-actions"><button className="button button--primary" onClick={() => void accept()} disabled={savingArtifact}>{savingArtifact ? '回信保存中...' : '收藏这封远方回信'} <span aria-hidden="true">→</span></button><button className="button button--secondary" onClick={() => choose('postpone', '/')}>稍后查看</button><button className="text-button" onClick={() => choose('skip', '/')}>跳过</button><button className="text-button" onClick={() => choose('close', '/')}>关闭</button></div></section>
  }

  if (!artifact) return <section className="recipient-shell"><p className="eyebrow">互动纪念物 · 需要重新进入</p><h1>这次明信片尚未生成。</h1><p className="recipient-lead">页面刷新后不会伪造已完成的互动。请重新主动进入并选择保存明信片。</p><button className="button button--primary" onClick={restart}>回到接收者入口</button></section>

  return <section className="recipient-shell"><p className="eyebrow">远方回信 · 已收藏</p><h1>今天与过去，都被好好放在这里。</h1><p className="recipient-lead">这件纪念物只记录本次互动。你今天的内容仍属于你，不会自动回写为 {snapshot.recipient.subjectName} 的内容。</p>{artifactError && <div className="form-errors" role="alert">{artifactError}</div>}<div className="completion-grid"><div className="completion-number">01<span>/ 回信</span></div><div>{artifact.presentContext && <p className="postcard-now">今天 · {artifact.presentContext.content}</p>}<span className="tag tag--organized">{artifact.generationLabel}</span><h2>{artifact.generatedSummary}</h2><p>Artifact ID · {artifact.id}<br />真实来源 Context ID · {artifact.sourceContextIds.join(', ')}</p></div></div><form className="response-form" onSubmit={(event) => void saveResponse(event)}><label htmlFor="recipient-response">为今天再留一句话</label><textarea id="recipient-response" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="今天还想记下什么？" rows={4} /><button className="button button--primary" type="submit" disabled={!response.trim() || savingResponse}>{savingResponse ? '正在保存...' : '保存我的话'} <span aria-hidden="true">↗</span></button>{savedResponse && <p className="form-note" role="status">已独立保存为接收者内容，不会成为记录者生前事实。</p>}</form><button className="text-button" onClick={restart}>回到入口</button></section>
}
