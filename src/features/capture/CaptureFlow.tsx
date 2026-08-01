import { useEffect, useState } from 'react'
import type { AgentPolicy, MemoryModality, Relationship } from '../../domain'
import { contextCaptureService, relationshipStore } from '../../data/services'

type CaptureKind = 'memory' | 'blessing' | 'plan' | 'original-only' | 'ai-organized'
type InputMode = 'text' | 'audio' | 'image'

interface CaptureDraft {
  inputMode: InputMode
  text: string
  topic: string
  recipientId: string
  meaning: string
  kind: CaptureKind
  allowAiOrganization: boolean
  confirmed: boolean
  planTitle: string
  planInvitation: string
}

const emptyDraft: CaptureDraft = {
  inputMode: 'text',
  text: '',
  topic: '',
  recipientId: '',
  meaning: '',
  kind: 'memory',
  allowAiOrganization: false,
  confirmed: false,
  planTitle: '',
  planInvitation: '',
}

const kindLabels: Record<CaptureKind, string> = {
  memory: '真实回忆',
  blessing: '未来祝福',
  plan: '共同计划',
  'original-only': '只允许原样播放',
  'ai-organized': '允许 AI 整理',
}

export function CaptureFlow({ route }: { route: string }) {
  const [draft, setDraft] = useState<CaptureDraft>(emptyDraft)
  const [relationship, setRelationship] = useState<Relationship>()
  const [errors, setErrors] = useState<string[]>([])
  const [savedId, setSavedId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    relationshipStore.getRelationship('relationship-mei-lin').then((value) => {
      if (active) {
        setRelationship(value)
        setDraft((current) => ({ ...current, recipientId: value?.recipientId ?? '' }))
      }
    })
    return () => {
      active = false
    }
  }, [])

  const setField = <K extends keyof CaptureDraft>(field: K, value: CaptureDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors([])
  }

  const validateDraft = () => {
    const nextErrors: string[] = []
    if (!draft.text.trim()) nextErrors.push('请先写下内容，语音和图片在 Demo 中也用文字模拟。')
    if (!draft.topic.trim()) nextErrors.push('请给这条记录一个主题。')
    if (!draft.recipientId) nextErrors.push('请选择这条记录留给谁。')
    if (!draft.meaning.trim()) nextErrors.push('请说明为什么要留给这个人。')
    if (draft.kind === 'plan' && !draft.planTitle.trim()) nextErrors.push('请填写共同计划的名称。')
    return nextErrors
  }

  const goToReview = (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = validateDraft()
    if (nextErrors.length) {
      setErrors(nextErrors)
      return
    }
    window.location.hash = '#/capture/review'
  }

  const save = async () => {
    if (!draft.confirmed) {
      setErrors(['请确认 AI 使用边界后再保存。'])
      return
    }
    setSaving(true)
    const memory = await contextCaptureService.capture({
      ownerId: relationship?.ownerId ?? 'person-mei',
      relationshipId: relationship?.id,
      recipientId: draft.recipientId,
      topic: `[${kindLabels[draft.kind]}] ${draft.topic.trim()}`,
      meaning: draft.meaning.trim(),
      visibility: 'relationship_specific',
      original: {
        kind: 'original',
        modality: draft.inputMode as MemoryModality,
        uri: draft.inputMode === 'text' ? `memory://text/${draft.topic.trim()}` : `memory://${draft.inputMode}-demo/${draft.topic.trim()}`,
        capturedAt: new Date().toISOString(),
      },
    })
    setSavedId(memory.id)
    setSaving(false)
    window.location.hash = '#/capture/success'
  }

  if (route === '/capture/success') {
    return (
      <section className="capture-success">
        <p className="eyebrow">Record saved</p>
        <h1>This moment has a place.</h1>
        <p className="page-header__description">The original record is saved only for {relationship?.label ?? 'this relationship'}. {draft.kind === 'plan' && draft.planTitle ? `${draft.planTitle} is ready as a future invitation.` : 'The recipient can decide when to open it.'}</p>
        <p className="capture-meta">Memory ID: {savedId || 'saved locally'}</p>
        <div className="capture-actions"><a className="button button--primary" href="#/capture/new">Capture another</a><a className="button button--secondary" href="#/">Return home</a></div>
      </section>
    )
  }

  if (route === '/capture/review') {
    const organizedPreview = `整理预览：${draft.topic.trim()}。${draft.meaning.trim()}`
    const policy: AgentPolicy = {
      relationshipId: relationship?.id ?? '', allowAiOrganization: draft.allowAiOrganization,
      allowParaphrase: draft.allowAiOrganization, allowNewMemoryGeneration: false,
      allowedMemoryIds: [], blockedTopics: [], proactiveDelivery: 'after_recipient_entry',
    }
    const policyText = draft.allowAiOrganization ? 'AI 可以整理这条真实素材，但不能生成新的记忆、替你表达未说过的意志。' : 'AI 不会整理、改写或生成这条记录；只保留原始内容。'
    const policyValid = policy.allowNewMemoryGeneration === false && (!draft.allowAiOrganization || policy.allowParaphrase)
    return (
      <div className="capture-page">
        <header className="page-header"><div><p className="eyebrow">Step 3 / Review</p><h1>Review before it travels.</h1><p className="page-header__description">先看原始内容，再确认整理边界。记录只会留给 {relationship?.label ?? '选定的关系'}。</p></div><span className="step-count">03 / 03</span></header>
        <div className="review-grid">
          <section className="review-panel"><div className="panel-heading"><span>Original</span><strong>{kindLabels[draft.kind]}</strong></div><h2>{draft.topic}</h2><p>{draft.text}</p><p className="capture-meta">输入方式：{draft.inputMode === 'audio' ? '模拟语音' : draft.inputMode === 'image' ? '图片占位' : '文字'}</p></section>
          <section className="review-panel review-panel--organized"><div className="panel-heading"><span>AI organized</span><strong>{draft.allowAiOrganization ? '可审核' : '未授权'}</strong></div><p>{draft.allowAiOrganization ? organizedPreview : '这条记录不会被 AI 整理。启用后才会生成整理预览。'}</p><p className="capture-meta">整理内容不会替代原始记录。</p></section>
        </div>
        <section className="policy-panel"><p className="eyebrow">AI boundary</p><h2>你决定它能做什么。</h2><p>{policyText}</p><label className={`check-row ${draft.kind === 'original-only' ? 'check-row--disabled' : ''}`}><input type="checkbox" checked={draft.allowAiOrganization} disabled={draft.kind === 'original-only'} onChange={(event) => setField('allowAiOrganization', event.target.checked)} />允许 AI 整理这条记录</label><label className="check-row"><input type="checkbox" checked={draft.confirmed} onChange={(event) => setField('confirmed', event.target.checked)} />我已审核原始内容、整理预览和使用边界</label>{!policyValid && <p className="form-error">策略不完整，不能提交。</p>}</section>
        {errors.length > 0 && <ErrorList errors={errors} />}
        <div className="capture-actions"><a className="button button--secondary" href="#/capture/new">返回修改</a><button className="button button--primary" type="button" disabled={saving} onClick={save}>{saving ? '保存中...' : '确认并保存'}</button></div>
      </div>
    )
  }

  return (
    <div className="capture-page">
      <header className="page-header"><div><p className="eyebrow">Recorder / Capture</p><h1>Leave something true.</h1><p className="page-header__description">给一个具体的人，留下一段以后仍然能被触碰的真实内容。</p></div><span className="step-count">01 / 03</span></header>
      <form className="capture-form" onSubmit={goToReview}>
        <fieldset><legend>1. Choose an input</legend><div className="mode-grid">{([['text', '文字', '直接写下这一刻'], ['audio', '模拟语音', '用文字模拟一段声音'], ['image', '图片占位', '先留下图片位置']] as const).map(([value, label, description]) => <label className={`mode-option ${draft.inputMode === value ? 'mode-option--selected' : ''}`} key={value}><input type="radio" name="inputMode" value={value} checked={draft.inputMode === value} onChange={() => setField('inputMode', value)} /><strong>{label}</strong><span>{description}</span></label>)}</div><label className="field"><span>内容</span><textarea value={draft.text} onChange={(event) => setField('text', event.target.value)} placeholder={draft.inputMode === 'audio' ? '例如：今天想录下我第一次教你做番茄炒蛋的声音...' : '写下想留给对方的内容...'} rows={6} /></label></fieldset>
        <fieldset><legend>2. Give it a relationship</legend><label className="field"><span>留给谁</span><select value={draft.recipientId} onChange={(event) => setField('recipientId', event.target.value)}><option value="">请选择一个关系</option>{relationship && <option value={relationship.recipientId}>Lin · {relationship.label}</option>}</select></label><label className="field"><span>主题</span><input value={draft.topic} onChange={(event) => setField('topic', event.target.value)} placeholder="例如：五道家庭菜的第一道" /></label><label className="field"><span>为什么要留给这个人</span><textarea value={draft.meaning} onChange={(event) => setField('meaning', event.target.value)} placeholder="这段内容和你们的关系有什么特别之处？" rows={4} /></label></fieldset>
        <fieldset><legend>3. Mark the content</legend><div className="kind-grid">{(Object.keys(kindLabels) as CaptureKind[]).map((kind) => <label className={`kind-option ${draft.kind === kind ? 'kind-option--selected' : ''}`} key={kind}><input type="radio" name="kind" value={kind} checked={draft.kind === kind} onChange={() => { setField('kind', kind); if (kind === 'original-only') setField('allowAiOrganization', false) }} /><span>{kindLabels[kind]}</span></label>)}</div>{draft.kind === 'plan' && <div className="plan-fields"><label className="field"><span>计划名称</span><input value={draft.planTitle} onChange={(event) => setField('planTitle', event.target.value)} placeholder="例如：一起完成五道菜" /></label><label className="field"><span>未来邀请</span><textarea value={draft.planInvitation} onChange={(event) => setField('planInvitation', event.target.value)} placeholder="例如：等你准备好时，我们一起做下一道。" rows={3} /></label></div>}</fieldset>
        {errors.length > 0 && <ErrorList errors={errors} />}
        <div className="capture-actions"><a className="button button--secondary" href="#/capture">取消</a><button className="button button--primary" type="submit">查看审核内容</button></div>
      </form>
    </div>
  )
}

function ErrorList({ errors }: { errors: string[] }) {
  return <div className="form-errors" role="alert"><strong>提交前还需要补充：</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>
}
