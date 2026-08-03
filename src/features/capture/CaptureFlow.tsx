import { useEffect, useState } from 'react'
import {
  createDefaultGenerationPolicy,
  createDefaultTriggerPolicy,
  type ContextModality,
  type DerivedContent,
  type SensitivityLevel,
} from '../../domain'
import { guidedCaptureService } from './captureService'
import type { CaptureRelationship, GuidedCapturePort } from './captureTypes'
import './capture.css'

type InputMode = Extract<ContextModality, 'text' | 'audio' | 'image'>
type EmotionOrigin = 'owner' | 'model'
type SuggestionStatus = 'pending' | 'editing' | 'approved' | 'edited' | 'removed' | 'rejected'

interface CaptureDraft {
  relationshipId: string
  recorderId: string
  inputMode: InputMode
  originalText: string
  topic: string
  meaning: string
  scenarios: string[]
  emotionLabel: string
  emotionIntensity: number
  emotionOrigin: EmotionOrigin
  emotionReviewed: boolean
  importanceWeight: number
  sensitivityLevel: SensitivityLevel
  allowAiOrganization: boolean
  boundaryConfirmed: boolean
}

interface ReviewSuggestion {
  id: string
  content: string
  editedContent: string
  status: SuggestionStatus
}

const scenarioOptions = ['想念时', '纪念日', '需要鼓励时', '回顾家庭故事时']
const statusLabels: Record<SuggestionStatus, string> = {
  pending: '等待审核',
  editing: '正在编辑',
  approved: '已批准',
  edited: '已编辑并批准',
  removed: '已移除',
  rejected: '已拒绝',
}

const emptyDraft: CaptureDraft = {
  relationshipId: '',
  recorderId: '',
  inputMode: 'text',
  originalText: '',
  topic: '',
  meaning: '',
  scenarios: [],
  emotionLabel: '',
  emotionIntensity: 50,
  emotionOrigin: 'owner',
  emotionReviewed: false,
  importanceWeight: 3,
  sensitivityLevel: 'medium',
  allowAiOrganization: false,
  boundaryConfirmed: false,
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function CaptureFlow({
  route,
  service = guidedCaptureService,
}: {
  route: string
  service?: GuidedCapturePort
}) {
  const [draft, setDraft] = useState<CaptureDraft>(emptyDraft)
  const [relationships, setRelationships] = useState<readonly CaptureRelationship[]>([])
  const [suggestions, setSuggestions] = useState<ReviewSuggestion[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [savedId, setSavedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingRelationships, setLoadingRelationships] = useState(true)
  const [relationshipLoadError, setRelationshipLoadError] = useState('')
  const [relationshipLoadAttempt, setRelationshipLoadAttempt] = useState(0)
  const [contextId] = useState(() => newId('context'))
  const [assetId] = useState(() => newId('asset'))

  const selected = relationships.find(
    ({ relationship }) => relationship.id === draft.relationshipId,
  )

  useEffect(() => {
    let active = true
    setLoadingRelationships(true)
    setRelationshipLoadError('')
    void service.listRelationships()
      .then((items) => {
        if (!active) return
        setRelationships(items)
        const first = items[0]
        if (first) {
          setDraft((current) => ({
            ...current,
            relationshipId: current.relationshipId || first.relationship.id,
            recorderId: current.recorderId || first.recorders[0]?.id || '',
          }))
        }
      })
      .catch((error: unknown) => {
        if (active) setRelationshipLoadError(error instanceof Error ? error.message : '关系目录加载失败，请重试。')
      })
      .finally(() => {
        if (active) setLoadingRelationships(false)
      })
    return () => {
      active = false
    }
  }, [relationshipLoadAttempt, service])

  useEffect(() => {
    if (errors.length > 0) document.getElementById('capture-error-summary')?.focus()
  }, [errors])

  const setField = <K extends keyof CaptureDraft>(field: K, value: CaptureDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors([])
  }

  const selectRelationship = (relationshipId: string) => {
    const option = relationships.find((item) => item.relationship.id === relationshipId)
    setDraft((current) => ({
      ...current,
      relationshipId,
      recorderId: option?.recorders[0]?.id ?? '',
      boundaryConfirmed: false,
    }))
    setErrors([])
  }

  const toggleScenario = (scenario: string) => {
    setField(
      'scenarios',
      draft.scenarios.includes(scenario)
        ? draft.scenarios.filter((item) => item !== scenario)
        : [...draft.scenarios, scenario],
    )
  }

  const validateDraft = () => {
    const nextErrors: string[] = []
    if (!selected) nextErrors.push('请选择一段关系。')
    if (!draft.recorderId) nextErrors.push('请选择记录者。')
    if (!draft.originalText.trim()) nextErrors.push('请先写下原始内容，语音和图片在 Demo 中用文字模拟。')
    if (!draft.topic.trim()) nextErrors.push('请给这条 Context 一个主题。')
    if (!draft.meaning.trim()) nextErrors.push('请说明这条内容为什么重要。')
    if (draft.scenarios.length === 0) nextErrors.push('请至少选择一个使用场景。')
    return nextErrors
  }

  const goToReview = (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = validateDraft()
    if (nextErrors.length) {
      setErrors(nextErrors)
      return
    }
    setSuggestions(
      draft.allowAiOrganization
        ? [{
            id: newId('derived'),
            content: `${draft.topic.trim()}：${draft.meaning.trim()} 原始素材记录了“${draft.originalText.trim()}”。`,
            editedContent: `${draft.topic.trim()}：${draft.meaning.trim()} 原始素材记录了“${draft.originalText.trim()}”。`,
            status: 'pending',
          }]
        : [],
    )
    setField('boundaryConfirmed', false)
    window.location.hash = '#/capture/review'
  }

  const updateSuggestion = (id: string, update: Partial<ReviewSuggestion>) => {
    setSuggestions((current) =>
      current.map((suggestion) => suggestion.id === id ? { ...suggestion, ...update } : suggestion),
    )
    setErrors([])
  }

  const save = async () => {
    const draftErrors = validateDraft()
    if (draftErrors.length) {
      setErrors(draftErrors)
      return
    }
    if (!selected) {
      setErrors(['关系资料尚未载入，请返回重新选择。'])
      return
    }
    if (suggestions.some(({ status }) => status === 'pending' || status === 'editing')) {
      setErrors(['请逐条批准、编辑、移除或拒绝 AI 建议后再保存。'])
      return
    }
    if (draft.emotionOrigin === 'model' && draft.emotionLabel.trim() && !draft.emotionReviewed) {
      setErrors(['请确认模型建议的情绪权重；它不是可靠的情绪检测。'])
      return
    }
    if (!draft.boundaryConfirmed) {
      setErrors(['请确认已审核原始内容、AI 建议和使用边界。'])
      return
    }

    setSaving(true)
    setErrors([])
    const now = new Date().toISOString()
    const approvedSuggestions = suggestions.filter(
      ({ status }) => status === 'approved' || status === 'edited',
    )
    const derivedContent: DerivedContent[] = approvedSuggestions.map((suggestion) => ({
      id: suggestion.id,
      contextId,
      kind: 'summary',
      content: suggestion.status === 'edited' ? suggestion.editedContent.trim() : suggestion.content,
      provenance: {
        sourceContextIds: [contextId],
        sourceAssetIds: [assetId],
        generationMode: 'source_composition',
        aiGenerated: true,
        model: 'simulated-demo-organizer',
        createdAt: now,
      },
      reviewedByUserId: selected.relationship.ownerId,
      reviewedAt: now,
    }))
    const generationPolicy = createDefaultGenerationPolicy(selected.relationship.id)
    const originalUri = `data:text/plain;charset=utf-8,${encodeURIComponent(draft.originalText.trim())}`

    try {
      const saved = await service.saveReviewedCapture({
        context: {
          id: contextId,
          subjectId: selected.relationship.subjectId,
          recorderId: draft.recorderId,
          recipientId: selected.relationship.recipientId,
          relationshipId: selected.relationship.id,
          sourceType: draft.inputMode === 'text' ? 'user_written' : draft.inputMode === 'audio' ? 'user_recorded' : 'user_uploaded',
          modality: draft.inputMode,
          captureMode: 'guided',
          originalAssetId: assetId,
          derivedContentIds: derivedContent.map(({ id }) => id),
          topic: draft.topic.trim(),
          meaning: draft.meaning.trim(),
          emotionLabel: draft.emotionLabel.trim() || undefined,
          emotionIntensity: draft.emotionLabel.trim() ? draft.emotionIntensity / 100 : undefined,
          importanceWeight: draft.importanceWeight / 5,
          sensitivityLevel: draft.sensitivityLevel,
          visibility: 'relationship_specific',
          intendedScenarios: draft.scenarios,
          createdAt: now,
          updatedAt: now,
        },
        originalAsset: {
          id: assetId,
          contextId,
          modality: draft.inputMode,
          uri: originalUri,
          capturedAt: now,
        },
        derivedContent,
        generationPolicy: {
          ...generationPolicy,
          allowedContextIds: [contextId],
          allowedModes: derivedContent.length > 0
            ? ['source_replay', 'source_composition']
            : ['source_replay'],
          allowedTopics: derivedContent.length > 0 ? [draft.topic.trim()] : [],
        },
        triggerPolicy: createDefaultTriggerPolicy(selected.relationship.id),
      })
      setSavedId(saved.id)
      window.location.hash = '#/capture/success'
    } catch (error) {
      setErrors([error instanceof Error ? error.message : '保存失败，请重试。'])
    } finally {
      setSaving(false)
    }
  }

  if (route === '/capture/success') {
    if (!savedId) {
      return (
        <section className="capture-success">
          <p className="eyebrow">保存结果 · 需要重新开始</p>
          <h1>没有可恢复的保存结果。</h1>
          <p className="page-header__description">离线 Demo 刷新后不会伪造已保存状态。请重新录入并完成所有者审核。</p>
          <a className="button button--primary" href="#/capture/new">重新录入记忆</a>
        </section>
      )
    }
    return (
      <section className="capture-success">
        <p className="eyebrow">记忆已保存</p>
        <h1>这一刻，有了安放的地方。</h1>
        <p className="page-header__description">
          原始素材与已审核的派生内容已分别保存，并限定给 {selected?.recipient.displayName ?? '选定的接收者'}。
        </p>
        <p className="capture-meta">Context ID · {savedId || '已保存到本地'}</p>
        <div className="capture-actions">
          <a className="button button--primary" href="#/capture/new">继续记录</a>
          <a className="button button--secondary" href="#/">返回首页</a>
        </div>
      </section>
    )
  }

  if (route === '/capture/review') {
    const draftErrors = validateDraft()
    if (draftErrors.length) {
      return (
        <section className="capture-success">
          <p className="eyebrow">所有者审核 · 需要重新开始</p>
          <h1>记录草稿需要重新开始。</h1>
          <p className="page-header__description">页面刷新后，未保存草稿不会被恢复或当作已审核内容。请返回编辑器重新填写。</p>
          <a className="button button--primary" href="#/capture/new">返回记忆编辑器</a>
        </section>
      )
    }
    return (
      <div className="capture-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">第 2 步 · 所有者审核</p>
            <h1>逐层确认，再保存。</h1>
            <p className="page-header__description">原始素材不会被 AI 内容覆盖。只有明确批准或编辑后的建议会保存。</p>
          </div>
          <span className="step-count">02 / 02</span>
        </header>

        {selected && (
          <dl className="review-context">
            <div><dt>记忆主体</dt><dd>{selected.subject.displayName}</dd></div>
            <div><dt>记录与编辑</dt><dd>{selected.recorders.find(({ id }) => id === draft.recorderId)?.displayName}</dd></div>
            <div><dt>接收者</dt><dd>{selected.recipient.displayName} · {displayRelationshipLabel(selected.relationship.label)}</dd></div>
          </dl>
        )}

        <div className="review-grid">
          <section className="review-panel">
            <div className="panel-heading"><span>原始素材</span><strong>始终保留</strong></div>
            <h2>{draft.topic || '未填写主题'}</h2>
            <p>{draft.originalText || '没有可审核的原始内容。'}</p>
            <p className="capture-meta">{inputModeLabel(draft.inputMode)} · 为什么重要：{draft.meaning || '未填写'}</p>
          </section>
          <section className="review-panel">
            <div className="panel-heading"><span>内容权重</span><strong>由所有者设定</strong></div>
            <p>使用场景：{draft.scenarios.join('、') || '未选择'}</p>
            <p>重要性权重：{draft.importanceWeight} / 5</p>
            <p>情绪权重：{draft.emotionLabel ? `${draft.emotionLabel} ${draft.emotionIntensity}%` : '未设置'}</p>
            {draft.emotionOrigin === 'model' && draft.emotionLabel && (
              <label className="check-row">
                <input type="checkbox" checked={draft.emotionReviewed} onChange={(event) => setField('emotionReviewed', event.target.checked)} />
                我确认这只是可编辑的模型建议权重，不是情绪检测结果
              </label>
            )}
          </section>
        </div>

        <section aria-labelledby="ai-review-heading">
          <p className="eyebrow">AI 派生内容 · 逐条审核</p>
          <h2 id="ai-review-heading">逐条决定，不默认接受。</h2>
          {suggestions.length === 0 ? (
            <p className="form-note">未请求 AI 整理；本次只保存原始素材。</p>
          ) : (
            <div className="suggestion-list">
              {suggestions.map((suggestion) => (
                <article className={`suggestion-card ${suggestion.status !== 'pending' && suggestion.status !== 'editing' ? 'suggestion-card--resolved' : ''}`} key={suggestion.id}>
                  <div className="suggestion-card__heading">
                    <div><span className="tag tag--organized">AI 建议摘要</span><h3>基于这一条原始素材</h3></div>
                    <span className="suggestion-status">{statusLabels[suggestion.status]}</span>
                  </div>
                  {suggestion.status === 'editing' ? (
                    <label className="field">
                      <span>编辑建议内容</span>
                      <textarea aria-label="编辑 AI 建议" value={suggestion.editedContent} onChange={(event) => updateSuggestion(suggestion.id, { editedContent: event.target.value })} rows={4} />
                    </label>
                  ) : (
                    <p>{suggestion.status === 'removed' ? '该建议已从本次记录中移除。' : suggestion.status === 'rejected' ? '该建议已拒绝，不会保存。' : suggestion.status === 'edited' ? suggestion.editedContent : suggestion.content}</p>
                  )}
                  {(suggestion.status === 'pending' || suggestion.status === 'editing') && (
                    <div className="suggestion-actions">
                      {suggestion.status === 'pending' && <button type="button" onClick={() => updateSuggestion(suggestion.id, { status: 'approved' })}>批准</button>}
                      {suggestion.status === 'pending' && <button type="button" onClick={() => updateSuggestion(suggestion.id, { status: 'editing' })}>编辑</button>}
                      {suggestion.status === 'editing' && <button type="button" onClick={() => updateSuggestion(suggestion.id, { status: 'edited' })}>保存修改并批准</button>}
                      <button type="button" onClick={() => updateSuggestion(suggestion.id, { status: 'removed' })}>移除</button>
                      <button type="button" onClick={() => updateSuggestion(suggestion.id, { status: 'rejected' })}>拒绝</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="policy-panel">
          <p className="eyebrow">使用边界</p>
          <h2>来源必需，AI 必须标记。</h2>
          <p>禁止新增事实、代做重大决定和高风险输出。接收者主动打开时才可呈现。</p>
          <label className="check-row">
            <input type="checkbox" checked={draft.boundaryConfirmed} onChange={(event) => setField('boundaryConfirmed', event.target.checked)} />
            我已审核原始素材、每条 AI 建议、情绪权重和关系范围
          </label>
        </section>
        {errors.length > 0 && <ErrorList errors={errors} />}
        <div className="capture-actions">
          <a className="button button--secondary" href="#/capture/new">返回修改</a>
          <button className="button button--primary" type="button" disabled={saving} onClick={save}>{saving ? '保存中...' : '保存已审核 Context'}</button>
        </div>
      </div>
    )
  }

  if (loadingRelationships) {
    return <section className="capture-success" aria-busy="true"><p className="eyebrow">关系记忆编辑器</p><h1>正在准备关系入口。</h1><p className="page-header__description" role="status">正在加载可用的接收者关系。</p></section>
  }

  if (relationshipLoadError) {
    return <section className="capture-success"><p className="eyebrow">关系记忆编辑器 · 恢复</p><h1>关系入口暂时不可用。</h1><p className="page-header__description">没有载入接收者关系，因此不会创建或保存 Context。</p><div className="form-errors" role="alert">{relationshipLoadError}</div><button className="button button--primary" type="button" onClick={() => setRelationshipLoadAttempt((attempt) => attempt + 1)}>重试加载关系</button></section>
  }

  if (relationships.length === 0) {
    return <section className="capture-success"><p className="eyebrow">关系记忆编辑器</p><h1>暂无可用关系。</h1><p className="page-header__description">当前 Demo 尚未建立可记录的接收者关系。</p><a className="button button--secondary" href="#/capture">返回记录入口</a></section>
  }

  return (
    <div className="capture-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">关系记忆编辑器</p>
          <h1>留下一件真实的小事。</h1>
          <p className="page-header__description">选择具体关系，记录原始素材、重要原因与未来使用场景。</p>
        </div>
        <span className="step-count">01 / 02</span>
      </header>
      <form className="capture-form" onSubmit={goToReview}>
        <fieldset>
          <legend>1. 关系与角色</legend>
          <label className="field">
            <span>关系 / 接收者</span>
            <select aria-label="关系 / 接收者" value={draft.relationshipId} onChange={(event) => selectRelationship(event.target.value)}>
              <option value="">请选择关系</option>
              {relationships.map(({ relationship, recipient }) => <option key={relationship.id} value={relationship.id}>{recipient.displayName} · {displayRelationshipLabel(relationship.label)}</option>)}
            </select>
          </label>
          {selected && (
            <div className="capture-actor-grid">
              <div className="capture-actor"><span>记忆主体</span><strong>{selected.subject.displayName}</strong></div>
              <div className="capture-actor"><span>记录与编辑</span><strong>{selected.recorders.map(({ displayName }) => displayName).join('、')}</strong></div>
              <div className="capture-actor"><span>接收者</span><strong>{selected.recipient.displayName}</strong></div>
              <div className="capture-actor"><span>购买者</span><strong>{selected.buyer?.displayName ?? '未指定'}</strong></div>
            </div>
          )}
          {selected && selected.recorders.length > 1 && (
            <label className="field"><span>本次记录者</span><select value={draft.recorderId} onChange={(event) => setField('recorderId', event.target.value)}>{selected.recorders.map((recorder) => <option key={recorder.id} value={recorder.id}>{recorder.displayName}</option>)}</select></label>
          )}
        </fieldset>

        <fieldset>
          <legend>2. 原始素材</legend>
          <div className="mode-grid">
            {(['text', 'audio', 'image'] as const).map((mode) => (
              <label className={`mode-option ${draft.inputMode === mode ? 'mode-option--selected' : ''}`} key={mode}>
                <input type="radio" name="inputMode" value={mode} checked={draft.inputMode === mode} onChange={() => setField('inputMode', mode)} />
                <strong>{inputModeLabel(mode)}</strong>
                <span>{mode === 'text' ? '直接写下原文' : mode === 'audio' ? '用文字模拟录音内容' : '描述本次图片占位与内容'}</span>
              </label>
            ))}
          </div>
          <label className="field">
            <span>原始内容</span>
            <textarea aria-label="原始内容" value={draft.originalText} onChange={(event) => setField('originalText', event.target.value)} placeholder={draft.inputMode === 'audio' ? '写下这段模拟录音的原话...' : draft.inputMode === 'image' ? '描述图片及希望保留的原始说明...' : '写下想保留的原文...'} rows={6} />
          </label>
        </fieldset>

        <fieldset>
          <legend>3. Context 与权重</legend>
          <div className="capture-fields-grid">
            <label className="field"><span>主题</span><input aria-label="主题" value={draft.topic} onChange={(event) => setField('topic', event.target.value)} placeholder="例如：厨房里的第一个晚上" /></label>
            <label className="field"><span>敏感级别</span><select aria-label="敏感级别" value={draft.sensitivityLevel} onChange={(event) => setField('sensitivityLevel', event.target.value as SensitivityLevel)}><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="restricted">受限</option></select></label>
          </div>
          <label className="field"><span>为什么重要</span><textarea aria-label="为什么重要" value={draft.meaning} onChange={(event) => setField('meaning', event.target.value)} placeholder="这段内容对你们的关系意味着什么？" rows={3} /></label>
          <div className="field">
            <span>期望使用场景</span>
            <div className="scenario-options">{scenarioOptions.map((scenario) => <label key={scenario}><input type="checkbox" checked={draft.scenarios.includes(scenario)} onChange={() => toggleScenario(scenario)} />{scenario}</label>)}</div>
          </div>
          <label className="field">
            <span className="range-label">重要性权重 <output>{draft.importanceWeight} / 5</output></span>
            <input aria-label="重要性权重" type="range" min="1" max="5" value={draft.importanceWeight} onChange={(event) => setField('importanceWeight', Number(event.target.value))} />
          </label>
          <div className="capture-fields-grid">
            <label className="field"><span>情绪标签（可选权重）</span><input aria-label="情绪标签" value={draft.emotionLabel} onChange={(event) => setField('emotionLabel', event.target.value)} placeholder="例如：温暖、思念" /></label>
            <label className="field"><span className="range-label">情绪强度权重 <output>{draft.emotionIntensity}%</output></span><input aria-label="情绪强度权重" type="range" min="0" max="100" value={draft.emotionIntensity} onChange={(event) => setField('emotionIntensity', Number(event.target.value))} /></label>
          </div>
          <p className="field-note">情绪标签只用于调整呈现权重，不代表可靠的情绪检测。</p>
          <div className="emotion-source">
            <label><input type="radio" name="emotionOrigin" checked={draft.emotionOrigin === 'owner'} onChange={() => setField('emotionOrigin', 'owner')} />我填写的标签</label>
            <label><input type="radio" name="emotionOrigin" checked={draft.emotionOrigin === 'model'} onChange={() => { setField('emotionOrigin', 'model'); if (!draft.emotionLabel) setField('emotionLabel', '温暖') }} />使用可编辑的模型建议</label>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={draft.allowAiOrganization} onChange={(event) => setField('allowAiOrganization', event.target.checked)} />
            生成一条可逐项审核的 AI 摘要建议
          </label>
        </fieldset>

        {errors.length > 0 && <ErrorList errors={errors} />}
        <div className="capture-actions">
          <a className="button button--secondary" href="#/capture">取消</a>
          <button className="button button--primary" type="submit">进入所有者审核</button>
        </div>
      </form>
    </div>
  )
}

function inputModeLabel(mode: InputMode) {
  if (mode === 'audio') return '模拟语音'
  if (mode === 'image') return '图片'
  return '文字'
}

function displayRelationshipLabel(label: string) {
  return label === 'Mother and daughter' ? '母女' : label
}

function ErrorList({ errors }: { errors: string[] }) {
  return <div id="capture-error-summary" className="form-errors" role="alert" tabIndex={-1}><strong>保存前还需要处理：</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>
}
