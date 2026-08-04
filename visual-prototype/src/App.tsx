import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'

type Page =
  | 'creator'
  | 'capture'
  | 'library'
  | 'detail'
  | 'settings'
  | 'recipient'
  | 'gallery'
  | 'echo'
  | 'seek'
  | 'wish'
  | 'you'

type CaptureType = '图片' | '语音' | '文字'
type Intensity = 'L1' | 'L2'
type MemoryKind = '照片' | '文字' | '声音' | '物件'
type LibraryFilter = '全部' | MemoryKind

type MessengerAttachment = {
  kind: 'image' | 'audio'
  name: string
  dataUrl: string
  duration?: number
}

type MessengerDraft = {
  mode: CaptureType
  text: string
  attachment?: MessengerAttachment
}

type MessengerOwner = 'mother' | 'daughter'

type MessengerContext = {
  owner: MessengerOwner
  returnPage: 'creator' | 'recipient'
  contextSeedId?: number
}

type MessengerExchange = MessengerDraft & {
  id: number
  sentAt: string
  sender: MessengerOwner
  returnPage: 'creator' | 'recipient'
  sourceSeedId?: number
  matchReason?: string
  resultText: string
  feedback?: '很相关' | '不相关' | '太重了' | '不要再出现' | '这不是她的意思'
}

type MessengerChannelState =
  | { phase: 'idle'; history: MessengerExchange[] }
  | { phase: 'composing'; history: MessengerExchange[]; draft: MessengerDraft; context: MessengerContext }
  | { phase: 'sending'; history: MessengerExchange[]; pending: MessengerExchange; deliverAt: number }
  | { phase: 'delivered'; history: MessengerExchange[]; unread: boolean; owner: MessengerOwner }
  | { phase: 'reading'; history: MessengerExchange[]; owner: MessengerOwner; selectedExchangeId?: number }

type MessengerState = Record<MessengerOwner, MessengerChannelState>

type SavedMessengerDraft = {
  draft: MessengerDraft
  contextSeedId?: number
}

function loadMessengerHistory(): MessengerExchange[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem('wozai-messenger-history-v1')
    const parsed = stored ? JSON.parse(stored) : null
    if (!Array.isArray(parsed)) return []
    return parsed.map((exchange: MessengerExchange & { motherReply?: string }) => exchange.sender ? exchange : {
      ...exchange,
      sender: 'mother' as const,
      returnPage: 'creator' as const,
      sourceSeedId: 4,
      matchReason: '相似的雨天与回家路',
      resultText: exchange.motherReply ?? '系统找到了一段可能相关的旧记录。',
    })
  } catch {
    return []
  }
}

function loadMessengerState(): MessengerState {
  const history = loadMessengerHistory()
  const fallback: MessengerState = {
    mother: { phase: 'idle', history: history.filter((exchange) => exchange.sender === 'mother') },
    daughter: { phase: 'idle', history: history.filter((exchange) => exchange.sender === 'daughter') },
  }
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.localStorage.getItem('wozai-messenger-state-v2')
    if (!stored) return fallback
    const parsed = JSON.parse(stored) as Partial<MessengerState>
    const restoreChannel = (owner: MessengerOwner): MessengerChannelState => {
      const channel = parsed[owner]
      if (!channel || !Array.isArray(channel.history)) return fallback[owner]
      if (channel.phase === 'sending' && channel.pending && typeof channel.deliverAt === 'number') return channel
      if (owner === 'mother') return { phase: 'idle', history: channel.history }
      if (channel.phase === 'delivered') return { ...channel, owner }
      return { phase: 'idle', history: channel.history }
    }
    return { mother: restoreChannel('mother'), daughter: restoreChannel('daughter') }
  } catch {
    return fallback
  }
}

function loadMessengerDrafts(): Partial<Record<MessengerOwner, SavedMessengerDraft>> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem('wozai-messenger-drafts-v1') ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function formatMessengerTime(value: string) {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value
  const date = new Date(timestamp)
  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDifference = Math.round((dayStart - targetStart) / 86_400_000)
  const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
  if (dayDifference === 0) return `今天 ${time}`
  if (dayDifference === 1) return `昨天 ${time}`
  const day = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date)
  return `${day} ${time}`
}

type RecipientPreferences = {
  accepted: boolean
  duration: 5 | 10 | 15
  sound: boolean
  intensity: Intensity
  frequency: '仅主动进入' | '每周一次' | '暂停出现'
}

type DaughterEntry = {
  id: number
  kind: '我的此刻' | '我的补充' | '轻行动' | '今天的记录'
  title: string
  text: string
  sourceSeedId?: number
  exchangeId?: number
  createdAt: string
}

type RelationshipReflection = {
  key: 'learned' | 'keep' | 'creating' | 'release'
  text: string
}

type RecipientData = {
  preferences: RecipientPreferences
  viewedMemoryIds: number[]
  selectedMemoryId: number
  entries: DaughterEntry[]
  dismissedWishIds: number[]
  hiddenMemoryIds: number[]
  sessionStartedAt: number | null
  sessionEndsAt: number | null
  sessionCompletedAt: number | null
  reflections: RelationshipReflection[]
}

const defaultRecipientData: RecipientData = {
  preferences: { accepted: false, duration: 10, sound: false, intensity: 'L1', frequency: '仅主动进入' },
  viewedMemoryIds: [],
  selectedMemoryId: 2,
  entries: [],
  dismissedWishIds: [],
  hiddenMemoryIds: [],
  sessionStartedAt: null,
  sessionEndsAt: null,
  sessionCompletedAt: null,
  reflections: [
    { key: 'learned', text: '害怕时，先走一小步' },
    { key: 'keep', text: '对普通日子的认真' },
    { key: 'creating', text: '自己的工作与关系' },
    { key: 'release', text: '必须替妈妈完成一切' },
  ],
}

function loadRecipientData(): RecipientData {
  if (typeof window === 'undefined') return defaultRecipientData
  try {
    const stored = window.localStorage.getItem('wozai-recipient-data-v1')
    if (!stored) return defaultRecipientData
    const parsed = JSON.parse(stored) as Partial<RecipientData>
    const preferences = { ...defaultRecipientData.preferences, ...(parsed.preferences ?? {}) }
    const now = Date.now()
    const sessionStartedAt = typeof parsed.sessionStartedAt === 'number'
      ? parsed.sessionStartedAt
      : preferences.accepted ? now : null
    const sessionEndsAt = typeof parsed.sessionEndsAt === 'number'
      ? parsed.sessionEndsAt
      : preferences.accepted ? now + preferences.duration * 60_000 : null
    return {
      ...defaultRecipientData,
      ...parsed,
      preferences,
      viewedMemoryIds: Array.isArray(parsed.viewedMemoryIds) ? parsed.viewedMemoryIds : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      dismissedWishIds: Array.isArray(parsed.dismissedWishIds) ? parsed.dismissedWishIds : [],
      hiddenMemoryIds: Array.isArray(parsed.hiddenMemoryIds) ? parsed.hiddenMemoryIds : [],
      sessionStartedAt,
      sessionEndsAt,
      sessionCompletedAt: typeof parsed.sessionCompletedAt === 'number' ? parsed.sessionCompletedAt : null,
      reflections: Array.isArray(parsed.reflections) && parsed.reflections.length === 4 ? parsed.reflections : defaultRecipientData.reflections,
    }
  } catch {
    return defaultRecipientData
  }
}

type Seed = {
  id: number
  title: string
  relation: string
  type: CaptureType | '愿景'
  excerpt: string
  source: string
  status: '妈妈已确认' | '待确认'
  intensity: 'L1' | 'L2'
  year: string
  storyOverride?: string
  media?: MessengerAttachment
  delivery: {
    recipient: '林崖'
    visible: boolean
    flows: Array<'查看' | '回应' | '探索' | '行动'>
  }
}

const standardDaughterDelivery: Seed['delivery'] = { recipient: '林崖', visible: true, flows: ['查看', '回应', '探索'] }

const initialSeeds: Seed[] = [
  {
    id: 1,
    title: '第一次自己买票',
    relation: '给女儿 · 母女',
    type: '图片',
    excerpt: '那天你第一次自己跑去买票，我才发现你已经开始走向自己的世界。',
    source: '1998 年青岛公交票 · 原声 00:42–01:12',
    status: '妈妈已确认',
    intensity: 'L2',
    year: '1998',
    delivery: standardDaughterDelivery,
  },
  {
    id: 2,
    title: '西湖边的下午',
    relation: '给女儿 · 母女',
    type: '图片',
    excerpt: '普通的一天，也值得被好好留下。',
    source: '原图 · 2022 年 4 月 16 日',
    status: '妈妈已确认',
    intensity: 'L1',
    year: '2022',
    delivery: standardDaughterDelivery,
  },
  {
    id: 3,
    title: '你外婆教我的馄饨馅',
    relation: '给女儿 · 母女',
    type: '文字',
    excerpt: '你外婆说，馄饨馅要顺一个方向搅。',
    source: '妈妈原文 · 手写笔记扫描',
    status: '妈妈已确认',
    intensity: 'L1',
    year: '2017',
    delivery: standardDaughterDelivery,
  },
  {
    id: 4,
    title: '回老家路上想到的事',
    relation: '给女儿 · 母女',
    type: '语音',
    excerpt: '下雨的时候，我们总会把车开得慢一点。',
    source: '妈妈原声 · 02:34',
    status: '妈妈已确认',
    intensity: 'L1',
    year: '2024',
    delivery: standardDaughterDelivery,
  },
  {
    id: 5,
    title: '心里乱的时候，先出去走一小段',
    relation: '给女儿 · 母女',
    type: '愿景',
    excerpt: '心里乱的时候，先出去走一走。不必走远，回来也不用向谁交作业。',
    source: '妈妈原声转写 · 2023 年 11 月 · 本人确认可用于轻行动',
    status: '妈妈已确认',
    intensity: 'L1',
    year: '2023',
    delivery: { ...standardDaughterDelivery, flows: [...standardDaughterDelivery.flows, '行动'] },
  },
]

function motherExchangeToSeed(exchange: MessengerExchange): Seed {
  const text = exchange.text.trim().replace(/\s+/g, ' ')
  const fallbackTitle = exchange.mode === '图片' ? '今天放入的一张照片' : exchange.mode === '语音' ? '今天留下的一段声音' : '今天留下的一句话'
  const title = text ? `${text.slice(0, 18)}${text.length > 18 ? '…' : ''}` : fallbackTitle
  const fallbackExcerpt = exchange.mode === '图片'
    ? '妈妈放入了一张原始照片，保留了当时真实的样子。'
    : exchange.mode === '语音'
      ? '这里保留了妈妈亲自留下的一段声音。'
      : '妈妈为女儿留下了一句话。'
  const duration = exchange.attachment?.kind === 'audio' && exchange.attachment.duration
    ? `${Math.floor(exchange.attachment.duration / 60)}:${String(exchange.attachment.duration % 60).padStart(2, '0')}`
    : ''
  const source = exchange.mode === '图片'
    ? `妈妈原图 · ${exchange.attachment?.name ?? '信使收录'}`
    : exchange.mode === '语音'
      ? `妈妈原声 · ${duration || exchange.attachment?.name || '信使收录'}`
      : '妈妈原文 · 信使收录'
  const sentAt = new Date(exchange.sentAt)
  const year = Number.isNaN(sentAt.getTime()) ? String(new Date().getFullYear()) : String(sentAt.getFullYear())
  return {
    id: exchange.id,
    title,
    relation: '给女儿 · 母女',
    type: exchange.mode,
    excerpt: text || fallbackExcerpt,
    source,
    status: '妈妈已确认',
    intensity: 'L1',
    year,
    media: exchange.attachment,
    delivery: { ...standardDaughterDelivery, flows: [...standardDaughterDelivery.flows] },
  }
}

function loadSeeds(): Seed[] {
  if (typeof window === 'undefined') return initialSeeds
  try {
    const stored = window.localStorage.getItem('wozai-seeds-v1')
    const parsed = stored ? JSON.parse(stored) : null
    if (!Array.isArray(parsed)) return initialSeeds
    const normalized = parsed.map((seed: Seed) => ({
      ...seed,
      delivery: seed.delivery ?? {
        ...standardDaughterDelivery,
        visible: seed.status === '妈妈已确认' && seed.relation.includes('女儿'),
        flows: seed.type === '愿景' ? [...standardDaughterDelivery.flows, '行动'] : standardDaughterDelivery.flows,
      },
    }))
    const storedIds = new Set(normalized.map((seed: Seed) => seed.id))
    return [...normalized, ...initialSeeds.filter((seed) => !storedIds.has(seed.id))]
  } catch {
    return initialSeeds
  }
}

const sourceImage = '/assets/figma/home-source-1.png'
const librarySourceImage = '/assets/figma/library-source.png'
const composeSourceImage = '/assets/figma/compose-source-2.png'
const mascotProfileImage = '/assets/mascot/profile.webp'
const mascotDeliveringImage = '/assets/mascot/delivering.webp'
const mascotReturningImage = '/assets/mascot/returning-letter.webp'
const mascotIdleImage = '/assets/mascot/idle.webp'
const westLakeImage = '/assets/demo/west-lake-family.webp'
const fabricMemoryImage = '/assets/demo/fabric-memory.webp'
const rainyRoadImage = '/assets/demo/rainy-road.webp'
const handwrittenNoteImage = '/assets/demo/handwritten-note.webp'

type Crop = { x: number; y: number; width: number; height: number }

function FigmaCrop({
  crop,
  alt,
  className = '',
  source = sourceImage,
  sourceWidth = 853,
  sourceHeight = 1844,
}: {
  crop: Crop
  alt: string
  className?: string
  source?: string
  sourceWidth?: number
  sourceHeight?: number
}) {
  const style = {
    width: `${(sourceWidth / crop.width) * 100}%`,
    transform: `translate(${-((crop.x / sourceWidth) * 100)}%, ${-((crop.y / sourceHeight) * 100)}%)`,
  }

  return (
    <div className={`figma-crop ${className}`} style={{ aspectRatio: `${crop.width} / ${crop.height}` }}>
      <img src={source} alt={alt} style={style} />
    </div>
  )
}

function BackHeader({ title, eyebrow, onBack, action }: { title: string; eyebrow?: string; onBack: () => void; action?: ReactNode }) {
  return (
    <header className="sub-header">
      <button className="icon-button" onClick={onBack} aria-label="返回">‹</button>
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      <div className="header-action">{action}</div>
    </header>
  )
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'paper' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

function SourceMark({ children = '妈妈亲自留下' }: { children?: ReactNode }) {
  return <span className="source-mark"><i />{children}</span>
}

function PhoneFrame({ children, quiet }: { children: ReactNode; quiet?: boolean }) {
  return (
    <div className={`phone-frame ${quiet ? 'is-quiet' : ''}`}>
      <div className="phone-speaker" />
      <div className="phone-screen">{children}</div>
    </div>
  )
}

function PrototypeRail({ page, go }: { page: Page; go: (page: Page) => void }) {
  const recipientPages: Page[] = ['recipient', 'gallery', 'echo', 'seek', 'wish', 'you']
  const isRecipient = recipientPages.includes(page)

  return (
    <aside className="prototype-rail">
      <div className="rail-brand">
        <span className="rail-seal">在</span>
        <div>
          <strong>我在</strong>
          <small>关系 Context 体验原型</small>
        </div>
      </div>
      <p className="rail-copy">真实地留下，只留给女儿，在未来有分寸地出现。</p>
      <div className="role-switch" aria-label="切换原型角色">
        <button className={!isRecipient ? 'active' : ''} onClick={() => go('creator')}>妈妈创作端</button>
        <button className={isRecipient ? 'active' : ''} onClick={() => go('recipient')}>女儿体验端</button>
      </div>
      <nav className="rail-nav">
        <span>核心流程</span>
        {!isRecipient ? (
          <>
            <button className={page === 'creator' ? 'active' : ''} onClick={() => go('creator')}><b>01</b>采集首页</button>
            <button className={page === 'capture' ? 'active' : ''} onClick={() => go('capture')}><b>02</b>留下片段</button>
            <button className={page === 'library' ? 'active' : ''} onClick={() => go('library')}><b>03</b>记忆库</button>
            <button className={page === 'settings' ? 'active' : ''} onClick={() => go('settings')}><b>04</b>授权与分寸</button>
          </>
        ) : (
          <>
            <button className={page === 'gallery' ? 'active' : ''} onClick={() => go('gallery')}><b>01</b>你看</button>
            <button className={page === 'echo' ? 'active' : ''} onClick={() => go('echo')}><b>02</b>你说</button>
            <button className={page === 'seek' ? 'active' : ''} onClick={() => go('seek')}><b>03</b>你寻</button>
            <button className={page === 'wish' ? 'active' : ''} onClick={() => go('wish')}><b>04</b>你做</button>
            <button className={page === 'you' ? 'active' : ''} onClick={() => go('you')}><b>05</b>你在</button>
          </>
        )}
      </nav>
      <div className="rail-principles">
        <span>触景生情</span><span>注入真心</span><span>言之有物</span><span>注意分寸</span>
      </div>
      <small className="rail-note">默认静音 · L1 · 任意流程两步内退出</small>
    </aside>
  )
}

function MobileRoleBar({ page, go }: { page: Page; go: (page: Page) => void }) {
  const isRecipient = ['recipient', 'gallery', 'echo', 'seek', 'wish', 'you'].includes(page)
  return (
    <div className="mobile-role-bar">
      <button className={!isRecipient ? 'active' : ''} onClick={() => go('creator')}>妈妈</button>
      <button className={isRecipient ? 'active' : ''} onClick={() => go('recipient')}>女儿</button>
    </div>
  )
}

async function prepareImageAttachment(file: File): Promise<MessengerAttachment> {
  if (!file.type.startsWith('image/')) throw new Error('请选择一张图片。')
  if (file.size > 12 * 1024 * 1024) throw new Error('图片超过 12MB，请换一张更小的图片。')
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context2d = canvas.getContext('2d')
    if (!context2d) throw new Error('这张图片暂时无法读取，请重新选择。')
    context2d.fillStyle = '#f7f2e9'
    context2d.fillRect(0, 0, canvas.width, canvas.height)
    context2d.drawImage(image, 0, 0, canvas.width, canvas.height)
    return { kind: 'image', name: file.name.replace(/\.[^.]+$/, '') + '.jpg', dataUrl: canvas.toDataURL('image/jpeg', .82) }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function prepareAudioAttachment(file: File): Promise<MessengerAttachment> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('audio/')) {
      reject(new Error('请选择一段音频。'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('音频超过 8MB，请选择一段更短的原声。'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => resolve({ kind: 'audio', name: file.name, dataUrl, duration: Number.isFinite(audio.duration) ? Math.max(1, Math.round(audio.duration)) : undefined })
      audio.onerror = () => resolve({ kind: 'audio', name: file.name, dataUrl })
      audio.src = dataUrl
    }
    reader.onerror = () => reject(new Error('这段音频暂时无法读取，请重新选择。'))
    reader.readAsDataURL(file)
  })
}

function MessengerComposeSheet({
  draft,
  context,
  contextTitle,
  onClose,
  onSaveDraft,
  onSend,
}: {
  draft: MessengerDraft
  context: MessengerContext
  contextTitle?: string
  onClose: () => void
  onSaveDraft: (draft: MessengerDraft) => void
  onSend: (draft: MessengerDraft) => void
}) {
  const [mode, setMode] = useState<CaptureType>(draft.mode)
  const [text, setText] = useState(draft.text)
  const [attachment, setAttachment] = useState(draft.attachment)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(draft.attachment?.duration ?? 0)
  const [attachmentError, setAttachmentError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordSecondsRef = useRef(recordSeconds)
  const recordTimerRef = useRef<number | null>(null)
  const currentAttachment = mode === '图片' && attachment?.kind === 'image'
    ? attachment
    : mode === '语音' && attachment?.kind === 'audio'
      ? attachment
      : undefined
  const currentDraft: MessengerDraft = { mode, text, ...(currentAttachment ? { attachment: currentAttachment } : {}) }
  const hasContent = mode === '图片'
    ? currentAttachment?.kind === 'image'
    : mode === '语音'
      ? currentAttachment?.kind === 'audio' || Boolean(text.trim())
      : Boolean(text.trim())
  const modeMeta: Array<{ mode: CaptureType; icon: string; label: string }> = [
    { mode: '图片', icon: '▧', label: '放入照片' },
    { mode: '语音', icon: '•••', label: '说一段话' },
    { mode: '文字', icon: '✎', label: '写下一句' },
  ]
  const tag = mode === '图片' ? (currentAttachment ? '已放入' : '待放入') : mode === '语音' ? (currentAttachment ? '已录下' : '待录下') : '已写下'
  const senderName = context.owner === 'daughter' ? '林崖' : '林岚'

  const clearRecordTimer = () => {
    if (recordTimerRef.current !== null) window.clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
  }

  const stopRecording = () => {
    clearRecordTimer()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setRecording(false)
  }

  const startRecording = async () => {
    setAttachmentError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAttachmentError('当前浏览器暂不支持录音，可以先写下文字转写。')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorderRef.current = recorder
      streamRef.current = stream
      recordSecondsRef.current = 0
      setRecordSeconds(0)
      setAttachment(undefined)
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (!blob.size) return
        const reader = new FileReader()
        reader.onload = () => setAttachment({
          kind: 'audio',
          name: `原声-${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}.webm`,
          dataUrl: String(reader.result),
          duration: Math.max(1, recordSecondsRef.current),
        })
        reader.readAsDataURL(blob)
      }
      recorder.start()
      setRecording(true)
      recordTimerRef.current = window.setInterval(() => {
        recordSecondsRef.current += 1
        setRecordSeconds(recordSecondsRef.current)
        if (recordSecondsRef.current >= 60) stopRecording()
      }, 1000)
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setAttachmentError('没有获得麦克风权限。你仍可以用文字留下这一刻。')
    }
  }

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAttachmentError('')
    try {
      setAttachment(await prepareImageAttachment(file))
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : '这张图片暂时无法读取，请重新选择。')
    }
  }

  useEffect(() => () => {
    clearRecordTimer()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  return (
    <div className="pigeon-overlay compose-messenger-overlay">
      <button className="pigeon-scrim" onClick={onClose} aria-label="关闭信使弹窗" />
      <section className="pigeon-sheet compose-messenger-sheet" role="dialog" aria-modal="true" aria-labelledby="compose-messenger-title">
        <div className="compose-pigeon-art" aria-hidden="true">
          <img src={mascotProfileImage} alt="" />
          <span className="pigeon-art-speech">{context.owner === 'daughter' ? <>把此刻交给我，<br />我会沿着真实记录去找。</> : <>把这一刻交给我，<br />我会原样收进记忆库。</>}<i>♥</i></span>
        </div>
        <button className="pigeon-sheet-close" onClick={onClose} aria-label="关闭">×</button>
        <header className="pigeon-sheet-title">
          <span>⌁</span><h2 id="compose-messenger-title">把这一刻交给信使</h2><span>⌁</span>
        </header>
        {contextTitle && <p className="messenger-context-line">正在回应「{contextTitle}」</p>}

        <div className="messenger-mode-grid" role="group" aria-label="选择寄送内容类型">
          {modeMeta.map((item) => (
            <button key={item.mode} className={mode === item.mode ? 'active' : ''} aria-pressed={mode === item.mode} onClick={() => {
              if (recording) stopRecording()
              setMode(item.mode)
              setAttachmentError('')
            }}>
              <span>{item.icon}</span><b>{item.label}</b>
            </button>
          ))}
        </div>

        <div className="pigeon-stitch" />
        <article className={`messenger-draft-card draft-${mode}`}>
          <span className="paper-label">{tag}</span>
          <button className="draft-remove" onClick={() => { setText(''); setAttachment(undefined); setRecordSeconds(0) }} aria-label="移除当前内容">×</button>
          {mode === '图片' && (
            currentAttachment?.kind === 'image'
              ? <div className="draft-attachment is-user-upload"><img src={currentAttachment.dataUrl} alt={currentAttachment.name} /></div>
              : <label className="draft-attachment draft-upload"><span>＋</span><b>从设备选择照片</b><small>JPG、PNG · 自动压缩保存</small><input type="file" accept="image/*" onChange={chooseImage} /></label>
          )}
          {mode === '语音' && (
            currentAttachment?.kind === 'audio'
              ? <div className="draft-voice recorded-voice"><audio controls src={currentAttachment.dataUrl} /><small>{currentAttachment.duration ?? recordSeconds} 秒原声</small><button onClick={startRecording}>重新录制</button></div>
              : <div className={`draft-voice voice-recorder ${recording ? 'is-recording' : ''}`}><span>{recording ? '●' : '●'}</span><b>{recording ? `${recordSeconds} 秒` : '最多 60 秒'}</b><button onClick={recording ? stopRecording : startRecording}>{recording ? '结束录音' : '开始录音'}</button></div>
          )}
          {mode === '文字' && <div className="draft-quote" aria-hidden="true">“</div>}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={mode === '图片' ? '给这张照片写一句附言（可选）…' : mode === '语音' ? '可以补充一句文字转写…' : context.owner === 'daughter' ? '写下女儿此刻想说的一句话…' : '写下此刻想留给女儿的一句话…'}
            aria-label="要交给信使的内容"
          />
          <small>来自{senderName} · 刚刚</small>
        </article>

        {attachmentError && <p className="messenger-attachment-error" role="alert">{attachmentError}</p>}

        <div className="messenger-sheet-actions">
          <button className="save-pigeon-draft" disabled={!hasContent || recording} onClick={() => onSaveDraft(currentDraft)}>存草稿</button>
          <button className="send-by-pigeon" disabled={!hasContent || recording} onClick={() => onSend(currentDraft)}>交给信使</button>
        </div>
        <p className="messenger-privacy">▣ {context.owner === 'daughter' ? '系统只会从妈妈留下并授权给你的真实记录中寻找相关内容' : '信使会保留林岚放入的原始内容，不替她改写成另一种意思'}</p>
      </section>
    </div>
  )
}

function MessengerThreadSheet({
  exchanges,
  memories,
  initialExchangeId,
  onClose,
  onWriteAgain,
  onReceive,
  onOpenMemory,
  onFeedback,
}: {
  exchanges: MessengerExchange[]
  memories: MemoryEntry[]
  initialExchangeId?: number
  onClose: () => void
  onWriteAgain: () => void
  onReceive: () => void
  onOpenMemory: (id: number) => void
  onFeedback: (id: number, feedback: NonNullable<MessengerExchange['feedback']>) => void
}) {
  const [activeIndex, setActiveIndex] = useState(() => {
    const selectedIndex = initialExchangeId ? exchanges.findIndex((exchange) => exchange.id === initialExchangeId) : -1
    return selectedIndex >= 0 ? selectedIndex : Math.max(0, exchanges.length - 1)
  })
  const exchange = exchanges[activeIndex]
  const memory = exchange?.sourceSeedId ? memories.find((item) => item.seed.id === exchange.sourceSeedId) : undefined
  const restricted = Boolean(exchange?.sourceSeedId && !memory)

  if (!exchange) return null

  return (
    <div className="pigeon-overlay reply-messenger-overlay">
      <button className="pigeon-scrim" onClick={onClose} aria-label="关闭信使带回的内容" />
      <section className="pigeon-sheet reply-messenger-sheet" role="dialog" aria-modal="true" aria-labelledby="reply-messenger-title">
        <div className="reply-pigeon-art" aria-hidden="true">
          <span className="pigeon-art-speech">我从妈妈留下的记录里，<br />带回了一段线索。<i>♥</i></span>
          <img src={mascotReturningImage} alt="" />
        </div>
        <button className="pigeon-sheet-close" onClick={onClose} aria-label="关闭">×</button>
        <header className="pigeon-sheet-title">
          <span>⌁</span><h2 id="reply-messenger-title">信使带回的一段记忆</h2><span>⌁</span>
        </header>

        {exchanges.length > 1 && <nav className="exchange-history-nav" aria-label="往返信件"><button disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}>‹ 上一封</button><span>{activeIndex + 1} / {exchanges.length}</span><button disabled={activeIndex === exchanges.length - 1} onClick={() => setActiveIndex((index) => Math.min(exchanges.length - 1, index + 1))}>下一封 ›</button></nav>}

        <div className="reply-exchange-scroll">
          <article className="exchange-card sent-exchange-card">
          <span className="paper-label">{exchange.sender === 'daughter' ? '林崖发出的此刻' : '林岚发出的此刻'}</span>
          {exchange.mode === '图片' && <div className="exchange-photo">{exchange.attachment?.kind === 'image' ? <img src={exchange.attachment.dataUrl} alt={exchange.attachment.name} /> : <FigmaCrop crop={{ x: 175, y: 1060, width: 310, height: 220 }} source={composeSourceImage} sourceWidth={941} sourceHeight={1672} alt="曾经寄出的示例照片" />}</div>}
          {exchange.mode === '语音' && <div className="exchange-voice">{exchange.attachment?.kind === 'audio' ? <audio controls src={exchange.attachment.dataUrl} /> : '▶'}<span>{exchange.attachment?.duration ? `${exchange.attachment.duration} 秒 · ` : ''}{exchange.sender === 'daughter' ? '女儿' : '妈妈'}留下的一段声音</span></div>}
          {exchange.mode === '文字' && <div className="exchange-voice exchange-text-mark">“<span>{exchange.sender === 'daughter' ? '女儿' : '妈妈'}写下的一句话</span></div>}
          <p>{exchange.text || (exchange.mode === '图片' ? `${exchange.sender === 'daughter' ? '女儿' : '妈妈'}放入了一张今天的照片。` : `${exchange.sender === 'daughter' ? '女儿' : '妈妈'}留下了一段声音。`)}</p>
          <small>发送于：{formatMessengerTime(exchange.sentAt)}</small>
        </article>
        <div className="exchange-thread" aria-hidden="true"><i /><i /><i /></div>
        <article className={`exchange-card mother-exchange-card ${memory ? '' : 'no-memory-result'}`}>
          <span className="paper-label">{memory ? '妈妈留下的旧记录' : restricted ? '当前接收范围' : '本次寻找结果'}</span>
          {memory ? <div className="exchange-photo exchange-memory-photo"><MemoryArtwork memory={memory} /></div> : <div className="exchange-voice empty-result-mark">{restricted ? '暂未开放' : '未找到'}<span>{restricted ? '这段内容当前不在你的接收范围' : '不生成妈妈没有说过的话'}</span></div>}
          <p>{restricted ? '这段旧记录的授权或内容强度已经调整，系统不会继续展示它。' : exchange.resultText}</p>
          <small>{memory ? `${memory.origin} · ${exchange.matchReason ?? '系统关联'} · 妈妈已确认` : restricted ? '你写下的此刻仍由你保留；旧记录不会越过当前授权。' : '只保存女儿的此刻，不生成推测内容。'}</small>
          {memory && <button className="exchange-source-link" onClick={() => onOpenMemory(memory.seed.id)}>查看这段原始记忆 ›</button>}
        </article>
        <section className="exchange-feedback" aria-label="这次关联是否合适">
          <span>这次带回得合适吗？</span>
          <div>{(['很相关', '不相关', '太重了', '不要再出现', '这不是她的意思'] as const).map((item) => <button key={item} className={exchange.feedback === item ? 'active' : ''} onClick={() => onFeedback(exchange.id, item)}>{exchange.feedback === item ? '✓ ' : ''}{item}</button>)}</div>
        </section>
        </div>

        <div className="messenger-sheet-actions">
          <button className="save-pigeon-draft" onClick={onWriteAgain}>再写一封</button>
          <button className="send-by-pigeon" onClick={onReceive}>收好这段记录</button>
        </div>
        <p className="messenger-privacy">▣ 这是妈妈过去留下的记录，不是她此刻的在线回复</p>
      </section>
    </div>
  )
}

function PigeonDock({
  owner,
  status,
  unread,
  onClick,
  onDismiss,
}: {
  owner: MessengerOwner
  status: 'sending' | 'delivered'
  unread: boolean
  onClick: () => void
  onDismiss: () => void
}) {
  const sending = status === 'sending'
  const motherDelivery = owner === 'mother'
  const title = motherDelivery ? '正在收好这一刻' : sending ? '信使出发了' : unread ? '找到一段旧记录' : '查看往返信件'
  const copy = motherDelivery ? '保存到记忆库，并留给女儿' : sending ? '正在妈妈留下的内容里寻找' : unread ? '点击查看真实来源' : '之前的往返仍在这里'
  const label = motherDelivery ? '这一刻正在保存到记忆库，无需等待回信' : sending ? '信鸽正在寻找旧记录' : unread ? '找到一段旧记录，点击查看' : '查看往返信件'
  return (
    <>
      <button className={`pigeon-dock ${sending ? 'is-sending' : 'is-delivered'} ${motherDelivery ? 'is-delivery' : ''}`} onClick={onClick} aria-live="polite" aria-label={label}>
        <span className="pigeon-dock-copy"><b>{title}</b><small>{copy}</small></span>
        <span className="pigeon-dock-art">
          <img src={sending ? mascotDeliveringImage : mascotReturningImage} alt={motherDelivery ? '信鸽正在保存妈妈留下的内容' : sending ? '信鸽正在寻找旧记录' : '信鸽带回一段旧记录'} />
        </span>
        {sending && <span className="pigeon-flight-dots" aria-hidden="true"><i /><i /><i /></span>}
        {!sending && unread && <span className="pigeon-unread" aria-hidden="true" />}
      </button>
      <button className="pigeon-dock-dismiss" onClick={onDismiss} aria-label={motherDelivery ? '收起保存状态' : sending ? '收起发送动画' : '稍后查看旧记录'}>×</button>
    </>
  )
}

function CreatorHome({
  go,
  memories,
  messenger,
  onCompose,
  onPigeon,
  onDismissPigeon,
  pigeonDockDismissed,
  onOpen,
  onLibrary,
}: {
  go: (page: Page) => void
  memories: MemoryEntry[]
  messenger: MessengerChannelState
  onCompose: () => void
  onPigeon: () => void
  onDismissPigeon: () => void
  pigeonDockDismissed: boolean
  onOpen: (seed: Seed) => void
  onLibrary: (filter: LibraryFilter) => void
}) {
  const creatorSending = messenger.phase === 'sending'
  const dockStatus = !pigeonDockDismissed && creatorSending ? 'sending' : null
  const ordinaryMemories = memories.filter((memory) => memory.seed.type !== '愿景')
  const wishCount = memories.length - ordinaryMemories.length
  const memoryCounts = ordinaryMemories.reduce<Record<MemoryKind, number>>((result, memory) => ({ ...result, [memory.kind]: result[memory.kind] + 1 }), { 照片: 0, 文字: 0, 声音: 0, 物件: 0 })
  const openMemory = (id: number) => {
    const memory = memories.find((item) => item.seed.id === id)
    if (memory) onOpen(memory.seed)
  }

  return (
    <div className="screen creator-screen">
      <div className="ambient ambient-one" />
      <main className="scroll-page creator-content">
        <header className="creator-header">
          <button className="text-search" onClick={() => onLibrary('全部')} aria-label="搜索记忆">⌕</button>
          <p className="brand-script">我在</p>
          <h1>林岚，这段时间你留下了 {ordinaryMemories.length} 段记忆</h1>
          <p>{memoryCounts.照片} 张照片 · {memoryCounts.文字} 条文字 · {memoryCounts.声音} 段声音 · {memoryCounts.物件} 个物件{wishCount ? ` · ${wishCount} 个愿望` : ''}</p>
        </header>

        <section className="home-section">
          <div className="section-title"><h2>最近</h2><button onClick={() => onLibrary('全部')}>查看全部</button></div>
          <div className="recent-grid">
            <button className="image-card wide-card" onClick={() => openMemory(2)} aria-label="查看西湖边的下午详情">
              <FigmaCrop crop={{ x: 40, y: 368, width: 510, height: 440 }} alt="西湖边一家人的记忆照片" />
            </button>
            <button className="image-card trophy-card" onClick={() => openMemory(102)} aria-label="查看冠军奖杯详情">
              <FigmaCrop crop={{ x: 560, y: 368, width: 240, height: 440 }} alt="冠军奖杯记忆贴纸" />
            </button>
          </div>
        </section>

        <section className="home-section">
          <div className="section-title"><h2>留下的话</h2><button onClick={() => onLibrary('文字')}>文字记忆</button></div>
          <button className="image-card quote-card" onClick={() => openMemory(3)} aria-label="查看你外婆的馄饨馅文字详情">
            <FigmaCrop crop={{ x: 40, y: 880, width: 620, height: 298 }} alt="妈妈留下的手写食谱记忆" />
          </button>
        </section>

        <section className="home-section">
          <div className="section-title"><h2>声音</h2><button onClick={() => onLibrary('声音')}>原声记录</button></div>
          <button className="image-card audio-card" onClick={() => openMemory(4)} aria-label="查看回老家路上想到的事声音详情">
            <FigmaCrop crop={{ x: 40, y: 1245, width: 770, height: 245 }} alt="雨天车窗与原声音频记录" />
          </button>
        </section>

        <section className="home-section objects-section">
          <div className="section-title"><h2>物件与故事</h2><button onClick={() => onLibrary('物件')}>更多物件</button></div>
          <div className="home-object-preview">
            {[
              { id: 101, title: '母女合照', crop: { x: 49, y: 477, width: 367, height: 405 } },
              { id: 102, title: '冠军奖杯', crop: { x: 431, y: 477, width: 368, height: 405 } },
              { id: 103, title: '手写食谱', crop: { x: 49, y: 896, width: 367, height: 353 } },
            ].map((item) => (
              <button key={item.title} className="home-object-mini" onClick={() => openMemory(item.id)} aria-label={`查看${item.title}详情`}>
                <FigmaCrop crop={item.crop} source={librarySourceImage} alt={item.title} />
              </button>
            ))}
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="妈妈创作端导航">
        <button className="active" onClick={() => go('creator')}><span>⌂</span>首页</button>
        <button onClick={() => go('library')}><span>▱</span>记忆库</button>
        <button onClick={() => go('settings')}><span>≡</span>设置</button>
      </nav>
      {dockStatus ? (
        <PigeonDock owner="mother" status={dockStatus} unread={false} onClick={onPigeon} onDismiss={onDismissPigeon} />
      ) : (
        <button className="floating-add" onClick={onCompose} aria-label="把这一刻交给信使">＋</button>
      )}
    </div>
  )
}

function CapturePage({ onBack, onSave }: { onBack: () => void; onSave: (seed: Seed, confirmed: boolean) => void }) {
  const storedDraft = useMemo(() => {
    try { return JSON.parse(window.localStorage.getItem('wozai-capture-draft-v1') ?? '{}') as { type?: CaptureType; title?: string; content?: string; attachment?: MessengerAttachment } } catch { return {} }
  }, [])
  const [type, setType] = useState<CaptureType>(storedDraft.type ?? '文字')
  const [title, setTitle] = useState(storedDraft.title ?? '')
  const [content, setContent] = useState(storedDraft.content ?? '')
  const [attachment, setAttachment] = useState<MessengerAttachment | undefined>(storedDraft.attachment)
  const [mediaError, setMediaError] = useState('')
  const [promptIndex, setPromptIndex] = useState(0)
  const relation = '给女儿 · 母女'
  const prompts = ['你希望女儿从这件事里理解什么？', '这段记忆里，最不想被系统改写的是什么？', '如果只留下一句原话，你会选哪一句？']
  const validAttachment = type === '图片' ? attachment?.kind === 'image' : type === '语音' ? attachment?.kind === 'audio' : false
  const hasContent = type === '文字' ? Boolean(content.trim()) : Boolean(validAttachment)

  useEffect(() => {
    try { window.localStorage.setItem('wozai-capture-draft-v1', JSON.stringify({ type, title, content, attachment })) } catch { /* keep the active draft in memory */ }
  }, [type, title, content, attachment])

  const chooseCaptureMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setMediaError('')
    try {
      setAttachment(type === '图片' ? await prepareImageAttachment(file) : await prepareAudioAttachment(file))
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : '这份原始内容暂时无法读取。')
    }
  }

  const submit = (confirmed: boolean) => {
    if (!hasContent) return
    const fallbackExcerpt = type === '图片' ? '这是一张妈妈亲自留下、没有被替换的原图。' : type === '语音' ? '这里保留了一段妈妈亲自录下的原声。' : ''
    onSave({
      id: Date.now(),
      title: title.trim() || '今天留下的一小段',
      relation,
      type,
      excerpt: content.trim() || fallbackExcerpt,
      source: `${type === '语音' ? '妈妈原声' : type === '图片' ? '妈妈原图' : '妈妈原文'} · ${attachment?.name ?? '刚刚'}`,
      status: confirmed ? '妈妈已确认' : '待确认',
      intensity: 'L1',
      year: '2026',
      delivery: { ...standardDaughterDelivery, visible: confirmed },
      media: validAttachment ? attachment : undefined,
    }, confirmed)
    window.localStorage.removeItem('wozai-capture-draft-v1')
  }

  return (
    <div className="screen paper-screen">
      <BackHeader title="留下一小段" eyebrow="留给女儿" onBack={onBack} action={<button className="quiet-action" onClick={onBack}>今天到这里</button>} />
      <main className="scroll-page capture-page">
        <label className="field-label" htmlFor="relation">这段记忆留给谁</label>
        <div id="relation" className="paper-select fixed-recipient"><span>{relation}</span><small>仅女儿可见</small></div>

        <div className="capture-hero">
          <div className="ink-ring"><span>{type === '图片' ? '放入原图' : type === '语音' ? '选择原声' : '安静写下'}</span><small>{type === '文字' ? '草稿实时保存' : '保留原始文件'}</small></div>
          <p>今天留下一小段，也已经完整。</p>
          <SourceMark>实时保存在本机</SourceMark>
        </div>

        <div className="capture-types" role="tablist" aria-label="选择记录类型">
          {(['图片', '语音', '文字'] as CaptureType[]).map((item) => (
            <button key={item} className={type === item ? 'active' : ''} onClick={() => { setType(item); setMediaError(''); if ((item === '图片' && attachment?.kind !== 'image') || (item === '语音' && attachment?.kind !== 'audio') || item === '文字') setAttachment(undefined) }}>
              <span>{item === '图片' ? '▧' : item === '语音' ? '〰' : '文'}</span>{item}
            </button>
          ))}
        </div>

        {type !== '文字' && (
          <section className="capture-media-card">
            {validAttachment ? (
              <div className="capture-media-preview">
                {attachment?.kind === 'image' ? <img src={attachment.dataUrl} alt={attachment.name} /> : <audio controls src={attachment?.dataUrl} />}
                <div><b>{attachment?.name}</b><small>{type === '图片' ? '原图已放入并压缩为本机副本' : '原声已放入，播放仍需主动点击'}</small></div>
                <button onClick={() => setAttachment(undefined)} aria-label="移除当前原始文件">×</button>
              </div>
            ) : (
              <label className="capture-media-picker"><span>{type === '图片' ? '▧' : '〰'}</span><div><b>{type === '图片' ? '选择一张真实照片' : '选择或现场录制一段声音'}</b><small>{type === '图片' ? '自动压缩保存，不使用示意图片' : '手机上可直接调用系统录音'}</small></div><i>＋</i><input type="file" accept={type === '图片' ? 'image/*' : 'audio/*'} capture={type === '语音' ? 'user' : undefined} onChange={chooseCaptureMedia} /></label>
            )}
            {mediaError && <p role="alert">{mediaError}</p>}
          </section>
        )}

        <section className="paper-form">
          <div className="form-stitch" />
          <label htmlFor="seed-title">标题 <small>可稍后补充</small></label>
          <input id="seed-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：第一次自己买票" />
          <label htmlFor="seed-content">{type === '文字' ? '你想留下什么' : '给原始内容补一句话'} <small>{type === '文字' ? '' : '可选'}</small></label>
          <textarea id="seed-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder={type === '语音' ? '可以补充转写或当时的情境，原声始终保留…' : type === '图片' ? '写下这张照片为什么值得留下…' : '写一段真实的话，系统不会替你润色成另一种意思…'} />
          <div className="gentle-prompt"><b>只问一个问题</b><span>{prompts[promptIndex]}</span><button onClick={() => setPromptIndex((promptIndex + 1) % prompts.length)}>换一个</button></div>
        </section>
        <p className="privacy-note">这段内容目前只属于草稿。由你确认留给女儿后，才会进入未来交付。</p>
      </main>
      <div className="sticky-actions">
        <button className="secondary-button" disabled={!hasContent} onClick={() => submit(false)}>存草稿</button>
        <button className="primary-button" disabled={!hasContent} onClick={() => submit(true)}>确认并授权给女儿</button>
      </div>
    </div>
  )
}

type MemoryVisual =
  | { style: 'image'; src: string; position?: string }
  | { style: 'crop'; crop: Crop; source?: string; sourceWidth?: number; sourceHeight?: number }
  | { style: 'text'; src: string; quote: string; tone?: 'dark' | 'paper' | 'sage' | 'rose'; position?: string }
  | { style: 'audio'; src?: string; duration: string; tone?: 'blue' | 'amber' | 'sage' | 'plum'; position?: string }

type MemoryEntry = {
  kind: MemoryKind
  seed: Seed
  visual: MemoryVisual
  date: string
  scene: string
  origin: string
  story: string
  duration?: string
  audioSrc?: string
}

const baseMemories: MemoryEntry[] = [
  {
    kind: '照片', seed: initialSeeds[1], visual: { style: 'image', src: westLakeImage, position: 'center 42%' },
    date: '2022.04.16', scene: '西湖边 · 春日下午', origin: '家庭相册 · 妈妈原图',
    story: '那天没有特别的安排，我们只是坐在湖边吹风。你靠在我们中间，认真听大人说着普通的话。我想留下这个下午，是想让你知道：一家人在一起的平常日子，也值得被好好记住。',
  },
  {
    kind: '物件', visual: { style: 'crop', crop: { x: 431, y: 477, width: 368, height: 405 }, source: librarySourceImage },
    seed: { id: 102, title: '冠军奖杯', relation: '给女儿 · 母女', type: '图片', excerpt: '这只奖杯记着的不是名次，是你练习过的那些晚上，也是妈妈为你骄傲的那一刻。', source: '奖杯原图 · 妈妈附言', status: '妈妈已确认', intensity: 'L1', year: '2012', delivery: standardDaughterDelivery },
    date: '2012.05.26', scene: '市级比赛 · 舞蹈组 · 第一名', origin: '家中书架',
    story: '这是你第一次在舞台上拿到冠军时留下的奖杯。我坐在观众席上，一直为你鼓掌。它记住了那一刻，也一直提醒我：无论能陪你走多远，妈妈永远是最为你骄傲的见证人。', duration: '01:23',
  },
  {
    kind: '文字', seed: initialSeeds[2], visual: { style: 'text', src: fabricMemoryImage, quote: '外婆说，馄饨馅要顺一个方向搅。', tone: 'dark' },
    date: '2017.10.08', scene: '家中厨房 · 周末午后', origin: '妈妈口述 · 外婆教的做法',
    story: '这是你外婆教给我的一句话。她一边拌馅，一边反复提醒我一定要顺着同一个方向。我把这句话留下来，不只是为了记住一道菜，也是想把我们家认真对待一顿饭的方式留给你。',
  },
  {
    kind: '声音', seed: initialSeeds[3], visual: { style: 'audio', src: rainyRoadImage, duration: '02:34' },
    date: '2024.06.18', scene: '回老家路上 · 雨天', origin: '妈妈原声 · 车内录音',
    story: '回老家的路上下起了雨，我忽然想起你小时候第一次坐长途车的样子。于是把一路想到的话录了下来，希望以后你想家时，还能听见妈妈当时的声音。', duration: '02:34',
  },
  {
    kind: '照片', visual: { style: 'crop', crop: { x: 49, y: 477, width: 367, height: 405 }, source: librarySourceImage },
    seed: { id: 101, title: '母女合照', relation: '给女儿 · 母女', type: '图片', excerpt: '那天下午，我们坐在窗边说了很久的话。', source: '妈妈原图 · 2019 年春', status: '妈妈已确认', intensity: 'L1', year: '2019', delivery: standardDaughterDelivery },
    date: '2019.04.13', scene: '家中窗边 · 一个普通下午', origin: '家庭相册 · 第二页',
    story: '这是我们一起整理相册时留下的一张照片。你那天靠在我身边，问了很多小时候的事。我想把这个普通下午留给你，因为被好好陪伴过的日子，本身就值得记得。', duration: '00:58',
  },
  {
    kind: '文字', visual: { style: 'crop', crop: { x: 49, y: 896, width: 367, height: 353 }, source: librarySourceImage },
    seed: { id: 103, title: '手写食谱', relation: '给女儿 · 母女', type: '文字', excerpt: '红烧肉要先把肉煸香，再慢慢等它入味。', source: '妈妈手写原稿 · OCR 已确认', status: '妈妈已确认', intensity: 'L1', year: '2017', delivery: standardDaughterDelivery },
    date: '2017.10.08', scene: '家中厨房 · 周末午后', origin: '妈妈的手写食谱',
    story: '这道红烧肉是你外婆教给我的。你小时候总爱站在厨房门口等第一块出锅。我把步骤写下来，是想让你以后想起家的味道时，随时能照着慢慢做。',
  },
  {
    kind: '物件', visual: { style: 'crop', crop: { x: 431, y: 896, width: 368, height: 353 }, source: librarySourceImage },
    seed: { id: 104, title: '红色围巾', relation: '给女儿 · 母女', type: '图片', excerpt: '每到天冷，我总想再提醒你把这条围巾带上。', source: '物件照片 · 妈妈原文', status: '妈妈已确认', intensity: 'L1', year: '2021', delivery: standardDaughterDelivery },
    date: '2021.12.21', scene: '冬至 · 第一次降温', origin: '卧室衣柜',
    story: '这条围巾陪你走过好几个冬天。以后天冷时，妈妈不能每次都在旁边提醒你，但希望你看到它，就记得先照顾好自己。', duration: '00:46',
  },
  {
    kind: '物件', visual: { style: 'crop', crop: { x: 49, y: 1264, width: 367, height: 360 }, source: librarySourceImage },
    seed: { id: 105, title: '小雏菊', relation: '给女儿 · 母女', type: '图片', excerpt: '不用买很贵的花，路边的小雏菊就很好。', source: '妈妈原图 · 花瓶吊牌原文', status: '妈妈已确认', intensity: 'L1', year: '2020', delivery: standardDaughterDelivery },
    date: '2020.04.06', scene: '春天 · 阳台上的小雏菊', origin: '客厅花瓶',
    story: '你问过我为什么总买小雏菊。因为它们不张扬，却能让普通的一天亮起来。我想把这种看见小事的能力留给你。', duration: '00:39',
  },
  {
    kind: '物件', visual: { style: 'crop', crop: { x: 431, y: 1264, width: 368, height: 360 }, source: librarySourceImage },
    seed: { id: 106, title: '床头台灯', relation: '给女儿 · 母女', type: '图片', excerpt: '那段时间你晚归，我会把这盏灯留到你回家。', source: '物件原图 · 妈妈附言', status: '妈妈已确认', intensity: 'L1', year: '2018', delivery: standardDaughterDelivery },
    date: '2018.09.01', scene: '家中卧室 · 晚归的夜晚', origin: '床头柜',
    story: '你第一次晚自习回家时，我把这盏灯留到很晚。后来它成了我们之间不用说出口的暗号：灯亮着，就有人等你。', duration: '00:52',
  },
  {
    kind: '文字', seed: initialSeeds[0], visual: { style: 'text', src: handwrittenNoteImage, quote: '第一次自己买票时，我才发现你已经开始走向自己的世界。', tone: 'paper' },
    date: '1998.07.12', scene: '青岛公交站 · 夏天', origin: '旧车票背面的手写记录',
    story: '那天你攥着零钱，自己走到售票窗口前。我本来想跟过去，又停在了原地。你回头看了我一眼，然后自己买好了票。那一刻我第一次清楚地意识到，你会慢慢拥有自己的路。',
  },
  {
    kind: '文字', visual: { style: 'text', src: handwrittenNoteImage, quote: '豆浆在锅里，钥匙别忘了拿。晚上回来，跟我讲讲第一天。', tone: 'paper', position: 'center 28%' },
    seed: { id: 107, title: '冰箱门上的早班便签', relation: '给女儿 · 母女', type: '文字', excerpt: '豆浆在锅里，钥匙别忘了拿。晚上回来，跟我讲讲第一天。', source: '妈妈手写原文 · 冰箱便签', status: '妈妈已确认', intensity: 'L1', year: '2005', delivery: standardDaughterDelivery },
    date: '2005.09.01', scene: '家中厨房 · 开学清晨', origin: '冰箱门上的手写便签',
    story: '那天你要自己去新学校，我一早就出了门，只来得及把早餐和钥匙写在便签上。现在再看，真正想说的其实是：去经历你的第一天，晚上还有人愿意听你慢慢讲。',
  },
  {
    kind: '文字', visual: { style: 'text', src: westLakeImage, quote: '证件放内袋，药在侧边。不够的东西，到那边再买。', tone: 'sage', position: 'center 58%' },
    seed: { id: 108, title: '去外地前的行李清单', relation: '给女儿 · 母女', type: '文字', excerpt: '证件放内袋，药在侧边。不够的东西，到那边再买。', source: '妈妈手写原文 · 方格本第 14 页', status: '妈妈已确认', intensity: 'L1', year: '2009', delivery: standardDaughterDelivery },
    date: '2009.08.27', scene: '客厅地板 · 出发前一晚', origin: 'A5 方格本第 14 页',
    story: '我们蹲在客厅地板上，一样一样核对行李。清单写的是证件和药，其实我也在练习把手松开一点：缺什么可以再买，自己的生活也可以慢慢学会安排。',
  },
  {
    kind: '文字', visual: { style: 'text', src: rainyRoadImage, quote: '一次没做好，不等于你不行。今晚先睡，明天再说。', tone: 'dark', position: 'center 54%' },
    seed: { id: 109, title: '没考好那晚的短信', relation: '给女儿 · 母女', type: '文字', excerpt: '一次没做好，不等于你不行。今晚先睡，明天再说。', source: '旧手机短信原文 · 时间已核对', status: '妈妈已确认', intensity: 'L2', year: '2013', delivery: standardDaughterDelivery },
    date: '2013.06.08', scene: '成绩公布后的夜晚', origin: '旧手机短信导出',
    story: '你那晚一直没有回消息，我怕再多问一句都会变成压力，只发了这几句话。它不是一句安慰模板，而是我后来一直想守住的分寸：一次结果不能替你定义自己。',
  },
  {
    kind: '文字', visual: { style: 'text', src: fabricMemoryImage, quote: '那天我说话太急。做妈妈也应该认真道歉，不该让你先来哄我。', tone: 'rose', position: 'center 45%' },
    seed: { id: 110, title: '我欠你的一次道歉', relation: '给女儿 · 母女', type: '文字', excerpt: '那天我说话太急。做妈妈也应该认真道歉，不该让你先来哄我。', source: '妈妈日记原文 · 林岚确认', status: '妈妈已确认', intensity: 'L2', year: '2018', delivery: standardDaughterDelivery },
    date: '2018.11.03', scene: '一次争执后的深夜', origin: '妈妈日记原页',
    story: '这句话不是要你现在原谅我，也不是把和好的责任交还给你。我留下它，是要承认那次伤人的话属于我，也提醒自己：母亲做错了，同样应该把道歉说完整。',
  },
  {
    kind: '文字', visual: { style: 'text', src: westLakeImage, quote: '土干了再浇，别因为怕它渴，一次给太多。', tone: 'sage', position: 'left 38%' },
    seed: { id: 111, title: '阳台薄荷的浇水纸条', relation: '给女儿 · 母女', type: '文字', excerpt: '土干了再浇，别因为怕它渴，一次给太多。', source: '妈妈手写原文 · 花盆吊牌', status: '妈妈已确认', intensity: 'L1', year: '2021', delivery: standardDaughterDelivery },
    date: '2021.07.23', scene: '家中阳台 · 出差前', origin: '薄荷花盆旁的吊牌',
    story: '你出差前把薄荷交给我，又担心它没人照顾。后来我发现，这张纸条也很像我们相处的提醒：关心不是一次给得越多越好，先看见对方真正需要什么。',
  },
  {
    kind: '文字', visual: { style: 'text', src: handwrittenNoteImage, quote: '第一周不用证明所有事。先把同事的名字记住，也记得准时吃饭。', tone: 'paper', position: 'center 66%' },
    seed: { id: 112, title: '新工作的第一周', relation: '给女儿 · 母女', type: '文字', excerpt: '第一周不用证明所有事。先把同事的名字记住，也记得准时吃饭。', source: '妈妈原文 · 私聊消息', status: '妈妈已确认', intensity: 'L1', year: '2024', delivery: standardDaughterDelivery },
    date: '2024.02.19', scene: '女儿入职第一天晚上', origin: '妈妈发出的原消息',
    story: '你说新公司里每个人都很厉害，怕自己跟不上。我没有劝你一定要表现好，只想把事情缩小到第一周：记住名字、按时吃饭，再给自己一点适应的时间。',
  },
  {
    kind: '声音', visual: { style: 'audio', duration: '01:36', tone: 'amber' },
    seed: { id: 113, title: '除夕厨房里的声音', relation: '给女儿 · 母女', type: '语音', excerpt: '锅里的饺子刚浮起来。你小时候总要守着数第一个。', source: '妈妈原声 · 手机录音', status: '妈妈已确认', intensity: 'L1', year: '2015', delivery: standardDaughterDelivery },
    date: '2015.02.18', scene: '家中厨房 · 除夕傍晚', origin: '林岚手机原声 · M4A',
    story: '这段录音里有锅盖碰到灶台的声音，也有外婆在旁边问盐够不够。我没有把杂音剪掉，因为那些听起来不够“干净”的地方，恰好就是我们家的除夕。', duration: '01:36',
  },
  {
    kind: '声音', visual: { style: 'audio', duration: '00:54', tone: 'sage' },
    seed: { id: 114, title: '清晨菜市场的一路', relation: '给女儿 · 母女', type: '语音', excerpt: '今天的豆角很新鲜，我买一点，晚上给你焖面。', source: '妈妈原声 · 旧录音笔', status: '妈妈已确认', intensity: 'L1', year: '2010', delivery: standardDaughterDelivery },
    date: '2010.05.22', scene: '菜市场回家路上 · 清晨', origin: '妈妈旧录音笔 · WAV',
    story: '我试录音笔时随口说了买菜和晚饭，后来才发现，最普通的生活常常就是这样被留下来的。它没有大道理，只有我在那天确实想回家给你做一碗焖面。', duration: '00:54',
  },
  {
    kind: '声音', visual: { style: 'audio', src: rainyRoadImage, duration: '01:48', tone: 'blue', position: 'center 56%' },
    seed: { id: 115, title: '火车开走以后', relation: '给女儿 · 母女', type: '语音', excerpt: '我当然舍不得，但你不用为了照顾我的舍不得停下来。', source: '妈妈原声 · 车站外录音', status: '妈妈已确认', intensity: 'L2', year: '2016', delivery: standardDaughterDelivery },
    date: '2016.09.05', scene: '火车站外 · 送别以后', origin: '林岚手机原声 · M4A',
    story: '送你进站以后，我在外面坐了很久才录下这段话。舍不得是真的，但它不该变成拦住你的理由；你可以往自己的远方走，不必先替我收好情绪。', duration: '01:48',
  },
  {
    kind: '声音', visual: { style: 'audio', duration: '01:12', tone: 'plum' },
    seed: { id: 116, title: '我们吵完架后的录音', relation: '给女儿 · 母女', type: '语音', excerpt: '我不同意你，不等于我可以用难听的话伤你。', source: '妈妈原声 · 车内录音', status: '妈妈已确认', intensity: 'L2', year: '2019', delivery: standardDaughterDelivery },
    date: '2019.05.11', scene: '停在楼下的车里 · 深夜', origin: '林岚手机原声 · M4A',
    story: '这段录音停顿很多，我没有重新录得更流畅。它留下的是我当时真实承担的部分：我们可以意见不同，但伤人的表达是我的责任，不需要由你来替我解释。', duration: '01:12',
  },
  {
    kind: '声音', visual: { style: 'audio', duration: '00:49', tone: 'sage' },
    seed: { id: 117, title: '傍晚散步时听到的蝉', relation: '给女儿 · 母女', type: '语音', excerpt: '今天蝉声很响，我走得很慢。这样普通的一天，也想给你留一点。', source: '妈妈原声 · 河边散步录音', status: '妈妈已确认', intensity: 'L1', year: '2022', delivery: standardDaughterDelivery },
    date: '2022.07.31', scene: '河边公园 · 夏日傍晚', origin: '林岚手机原声 · M4A',
    story: '录音里没有发生重要的事，只有蝉、脚步和偶尔经过的自行车。我还是把它留下了，因为我希望你以后记起我时，也能拥有一些没有任务、没有结论的普通傍晚。', duration: '00:49',
  },
  {
    kind: '声音', visual: { style: 'audio', duration: '02:06', tone: 'blue' },
    seed: { id: 118, title: '复查结束后的长椅', relation: '给女儿 · 母女', type: '语音', excerpt: '今天检查结束，我也会害怕。但这份害怕是我的，不需要你替我背着。', source: '妈妈原声 · 医院庭院录音', status: '妈妈已确认', intensity: 'L2', year: '2024', delivery: standardDaughterDelivery },
    date: '2024.10.19', scene: '医院庭院长椅 · 复查以后', origin: '林岚手机原声 · M4A',
    story: '我想让你知道真实情况，也想清楚地区分关心和负担。你可以担心，可以来陪我，但不需要为了证明爱我，就把我的害怕和人生责任都背到自己身上。', duration: '02:06',
  },
]

function fallbackMemory(seed: Seed): MemoryEntry {
  const kind: MemoryKind = seed.type === '图片' ? '照片' : seed.type === '语音' ? '声音' : '文字'
  const visual: MemoryVisual = kind === '照片'
    ? { style: 'image', src: seed.media?.kind === 'image' ? seed.media.dataUrl : westLakeImage }
    : kind === '声音'
      ? { style: 'audio', src: rainyRoadImage, duration: '00:48' }
      : { style: 'text', src: fabricMemoryImage, quote: seed.excerpt, tone: 'dark' }
  return {
    kind, seed, visual, date: `${seed.year}.01.01`, scene: '一段共同生活的记录', origin: seed.source,
    story: seed.storyOverride ?? seed.excerpt,
    duration: kind === '声音' ? seed.media?.duration ? `${Math.floor(seed.media.duration / 60)}:${String(seed.media.duration % 60).padStart(2, '0')}` : '00:48' : undefined,
    audioSrc: seed.media?.kind === 'audio' ? seed.media.dataUrl : undefined,
  }
}

function buildMemories(seeds: Seed[]): MemoryEntry[] {
  const baseIds = new Set(baseMemories.map((item) => item.seed.id))
  const seedById = new Map(seeds.map((seed) => [seed.id, seed]))
  const existing = baseMemories.map((memory) => {
    const currentSeed = seedById.get(memory.seed.id)
    return currentSeed ? { ...memory, seed: currentSeed, story: currentSeed.storyOverride ?? memory.story } : memory
  })
  const added = seeds.filter((seed) => !baseIds.has(seed.id)).map(fallbackMemory)
  return [...added, ...existing].sort((left, right) => Number(left.seed.type === '愿景') - Number(right.seed.type === '愿景'))
}

function matchMemoryForDraft(draft: MessengerDraft, memories: MemoryEntry[], contextSeedId?: number) {
  const text = draft.text.trim()
  const rules: Array<{ id: number; pattern: RegExp; reason: string }> = [
    { id: 118, pattern: /复查|检查|医院|身体|生病|看病|害怕|担心/, reason: '相似的身体担忧与边界' },
    { id: 116, pattern: /不同意|难听的话|车里录音|楼下的车/, reason: '相似的争执与承担' },
    { id: 110, pattern: /吵架|道歉|生气|争执|误会|说重了|和好|哄我/, reason: '相似的冲突与道歉' },
    { id: 109, pattern: /考试|成绩|失败|没考好|压力|做不好|睡不着/, reason: '相似的失落与重新开始' },
    { id: 115, pattern: /火车|车站|离家|远方|送别|舍不得/, reason: '相似的离开与舍不得' },
    { id: 108, pattern: /行李|证件|宿舍|箱子|搬家|去外地/, reason: '相似的出发与独立' },
    { id: 112, pattern: /工作|公司|入职|同事|第一周|上班|换工作/, reason: '相似的新工作与第一周' },
    { id: 107, pattern: /开学|早餐|豆浆|钥匙|冰箱|便签|第一天/, reason: '相似的第一天与出门前叮嘱' },
    { id: 111, pattern: /植物|薄荷|阳台|浇水|养花|花盆/, reason: '相似的植物与照料' },
    { id: 113, pattern: /除夕|春节|饺子|年夜饭|过年/, reason: '相似的节日与厨房声音' },
    { id: 114, pattern: /菜市场|买菜|豆角|焖面|烟火气/, reason: '相似的一顿家常饭' },
    { id: 117, pattern: /夏天|蝉|散步|傍晚|公园|慢一点/, reason: '相似的散步与普通傍晚' },
    { id: 4, pattern: /雨|回家|开车|路上/, reason: '相似的雨天与回家路' },
    { id: 3, pattern: /外婆|馄饨|做饭|食谱|红烧肉/, reason: '同一种家的味道' },
    { id: 102, pattern: /奖杯|比赛|舞蹈|练习/, reason: '相似的比赛与坚持' },
    { id: 1, pattern: /第一次|紧张|独立|买票/, reason: '相似的“第一次”' },
    { id: 2, pattern: /西湖|湖边|一家人|普通的下午/, reason: '相似的湖边与普通下午' },
  ]
  const matchedRule = rules.find((rule) => rule.pattern.test(text))
  const memory = matchedRule
    ? memories.find((item) => item.seed.id === matchedRule.id)
    : contextSeedId
      ? memories.find((item) => item.seed.id === contextSeedId)
      : undefined
  const reason = matchedRule?.reason ?? (memory ? '回应你正在看的这段记忆' : undefined)
  return { memory, reason }
}

function MemoryArtwork({ memory, context = 'card' }: { memory: MemoryEntry; context?: 'card' | 'detail' }) {
  const visual = memory.visual
  const detail = context === 'detail'
  if (visual.style === 'image') {
    return (
      <div className={`memory-artwork memory-image-art ${detail ? 'is-detail' : ''}`}>
        <img src={visual.src} alt={memory.seed.title} style={{ objectPosition: visual.position ?? 'center' }} />
        {!detail && <span className="memory-image-caption">{memory.seed.title}<small>{memory.seed.year}</small></span>}
      </div>
    )
  }
  if (visual.style === 'crop') {
    const crop = detail ? { ...visual.crop, height: visual.crop.height > 380 ? 350 : 300 } : visual.crop
    return <div className={`memory-artwork memory-crop-art ${detail ? 'is-detail' : ''}`}><FigmaCrop crop={crop} source={visual.source} sourceWidth={visual.sourceWidth} sourceHeight={visual.sourceHeight} alt={memory.seed.title} /></div>
  }
  if (visual.style === 'text') {
    const overlay = visual.tone === 'paper'
      ? 'linear-gradient(rgba(245,235,219,.08), rgba(66,48,34,.42))'
      : visual.tone === 'sage'
        ? 'linear-gradient(rgba(60,83,70,.12), rgba(39,63,54,.72))'
        : visual.tone === 'rose'
          ? 'linear-gradient(rgba(91,52,58,.12), rgba(73,40,48,.74))'
          : 'linear-gradient(rgba(18,31,42,.18), rgba(13,23,33,.68))'
    return (
      <div className={`memory-artwork memory-text-art tone-${visual.tone ?? 'dark'} ${detail ? 'is-detail' : ''}`} style={{ backgroundImage: `${overlay}, url(${visual.src})`, backgroundPosition: visual.position ?? 'center' }}>
        <blockquote>“{visual.quote}”</blockquote>
        <span>{memory.seed.title}<small>文字记忆 · {memory.seed.year}</small></span>
      </div>
    )
  }
  const audioBackdrop = visual.tone === 'amber'
    ? 'radial-gradient(circle at 78% 18%, rgba(255,226,170,.38), transparent 27%), repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 9px), linear-gradient(145deg, #9a7254, #504a45)'
    : visual.tone === 'sage'
      ? 'radial-gradient(circle at 22% 20%, rgba(220,235,211,.24), transparent 29%), repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 8px), linear-gradient(145deg, #6f8378, #354b48)'
      : visual.tone === 'plum'
        ? 'radial-gradient(circle at 78% 16%, rgba(233,206,218,.2), transparent 30%), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 10px), linear-gradient(145deg, #725e68, #3d3f49)'
        : 'radial-gradient(circle at 78% 18%, rgba(208,229,239,.2), transparent 28%), repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 9px), linear-gradient(145deg, #647b87, #30434c)'
  const audioBackground = visual.src
    ? `linear-gradient(rgba(16,30,38,.1), rgba(10,22,29,.58)), url(${visual.src})`
    : audioBackdrop
  return (
    <div className={`memory-artwork memory-audio-art audio-tone-${visual.tone ?? 'blue'} ${detail ? 'is-detail' : ''}`} style={{ backgroundImage: audioBackground, backgroundPosition: visual.position ?? 'center' }}>
      <span className="memory-audio-play">▶</span>
      <span className="memory-audio-copy"><b>{memory.seed.title}</b><i /><small>{visual.duration}</small></span>
    </div>
  )
}

function LibraryPage({ seeds, go, onOpen, onCompose, initialFilter = '全部' }: { seeds: Seed[]; go: (page: Page) => void; onOpen: (seed: Seed) => void; onCompose: () => void; initialFilter?: LibraryFilter }) {
  const [filter, setFilter] = useState<LibraryFilter>(initialFilter)
  const [query, setQuery] = useState('')
  const memories = useMemo(() => buildMemories(seeds), [seeds])
  const filterCounts = useMemo<Record<LibraryFilter, number>>(() => ({
    全部: memories.length,
    照片: memories.filter((memory) => memory.kind === '照片').length,
    文字: memories.filter((memory) => memory.kind === '文字' && memory.seed.type !== '愿景').length,
    声音: memories.filter((memory) => memory.kind === '声音').length,
    物件: memories.filter((memory) => memory.kind === '物件').length,
  }), [memories])
  const filtered = useMemo(() => memories.filter((memory) => {
    const inCategory = filter === '全部' || (filter === '文字' ? memory.kind === '文字' && memory.seed.type !== '愿景' : memory.kind === filter)
    const inSearch = !query.trim() || `${memory.seed.title}${memory.seed.excerpt}${memory.story}${memory.origin}${memory.kind}`.includes(query.trim())
    return inCategory && inSearch
  }), [filter, query, memories])

  useEffect(() => setFilter(initialFilter), [initialFilter])

  return (
    <div className="screen library-screen">
      <main className="scroll-page library-page">
        <header className="library-hero">
          <h1>记忆库</h1>
          <p>照片、文字、声音、物件和明确留下的愿望，都在这里。</p>
          <label className="library-search">
            <span aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索照片、文字、声音、物件或愿望" aria-label="搜索记忆库" />
          </label>
        </header>
        <div className="object-filter" role="tablist" aria-label="记忆类型">
          {(['全部', '照片', '文字', '声音', '物件'] as const).map((item) => (
            <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}><span>{item}</span><small>{filterCounts[item]}</small></button>
          ))}
        </div>
        <div className="object-heading">
          <h2>{filter === '全部' ? '全部内容' : `${filter}记忆`}</h2>
          <span>{filtered.length} 条</span>
        </div>
        <div className="object-grid">
          {filtered.map((memory) => (
            <button key={memory.seed.id} className={`object-card memory-card kind-${memory.kind}`} onClick={() => onOpen(memory.seed)} aria-label={`查看${memory.seed.title}详情`}>
              <span className="memory-kind-badge">{memory.seed.type === '愿景' ? '愿望' : memory.kind}</span>
              <span className={`memory-access-badge ${memory.seed.delivery.visible ? 'is-shared' : 'is-draft'}`}>{memory.seed.delivery.visible ? '给林崖' : '仅自己'}</span>
              <MemoryArtwork memory={memory} />
            </button>
          ))}
        </div>
        {filtered.length === 0 && <div className="library-empty"><span>没有找到这段记忆</span><button onClick={() => { setQuery(''); setFilter('全部') }}>查看全部</button></div>}
      </main>
      <nav className="bottom-nav library-bottom-nav" aria-label="妈妈创作端导航">
        <button onClick={() => go('creator')}><span>⌂</span>首页</button>
        <button className="active" onClick={() => go('library')}><span>▱</span>记忆库</button>
        <button onClick={() => go('settings')}><span>≡</span>设置</button>
      </nav>
      <button className="floating-add" onClick={onCompose} aria-label="把这一刻交给信使">＋</button>
    </div>
  )
}

function ObjectDetailPage({ seed, onBack, onUpdate }: { seed: Seed; onBack: () => void; onUpdate: (seed: Seed) => void }) {
  const baseMemory = baseMemories.find((item) => item.seed.id === seed.id)
  const memory = baseMemory ? { ...baseMemory, seed, story: seed.storyOverride ?? baseMemory.story } : fallbackMemory(seed)
  const [playing, setPlaying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [story, setStory] = useState(memory.story)
  const reasonTitle = memory.kind === '文字' ? '我为什么留下这句话' : memory.kind === '声音' ? '我为什么留下这段声音' : '我为什么留下它'
  const saveStory = () => {
    if (editing) onUpdate({ ...seed, storyOverride: story.trim() || memory.story })
    setEditing(!editing)
  }
  const toggleAuthorization = () => {
    onUpdate({ ...seed, status: seed.delivery.visible ? seed.status : '妈妈已确认', delivery: { ...seed.delivery, visible: !seed.delivery.visible } })
    setShowMore(false)
  }
  const toggleFlow = (flow: '回应' | '探索') => {
    const flows = seed.delivery.flows.includes(flow) ? seed.delivery.flows.filter((item) => item !== flow) : [...seed.delivery.flows, flow]
    onUpdate({ ...seed, delivery: { ...seed.delivery, flows } })
  }

  return (
    <div className={`screen object-detail-screen ${preview ? 'daughter-preview' : ''}`}>
      <main className="scroll-page object-detail-page">
        <header className="object-detail-header">
          <button className="round-back" onClick={onBack} aria-label="返回上一页">‹</button>
          <h1>{seed.title}</h1>
          <button className="round-more" onClick={() => setShowMore(!showMore)} aria-label="记忆授权与更多操作" aria-expanded={showMore}>•••</button>
        </header>
        {showMore && <section className="object-detail-menu"><div><b>这段记忆的授权</b><small>{seed.delivery.visible ? '林崖可以在女儿端看到' : '目前只有林岚自己可见'}</small></div><button className={seed.delivery.visible ? 'revoke' : 'authorize'} onClick={toggleAuthorization}>{seed.delivery.visible ? '暂停女儿访问' : '确认并授权给女儿'}</button><div className="object-flow-permissions"><span>女儿可用方式</span>{(['回应', '探索'] as const).map((flow) => <button key={flow} className={seed.delivery.flows.includes(flow) ? 'active' : ''} disabled={!seed.delivery.visible} onClick={() => toggleFlow(flow)}>{seed.delivery.flows.includes(flow) ? '✓ ' : ''}{flow}</button>)}</div></section>}
        {preview && <div className="daughter-preview-banner"><span>{seed.delivery.visible ? '女儿视角预览' : '尚未授权 · 草稿预演'}</span><p>{seed.delivery.visible ? '这是林崖会看到的版本，妈妈的编辑信息已隐藏。' : '这段仍只对妈妈可见；预演不会自动授权给女儿。'}</p></div>}
        <div className="object-motto">我在，值得被记得。<span>♡</span></div>
        <section className={`object-detail-hero detail-kind-${memory.kind}`}>
          <MemoryArtwork memory={memory} context="detail" />
        </section>
        <section className="object-meta-card">
          <div><span className="meta-symbol">日</span><p>{memory.date}</p></div>
          <div><span className="meta-symbol">地</span><p>{memory.scene}</p></div>
          <div><span className="meta-symbol">签</span><p>来源：{memory.origin}</p></div>
          <Pill tone={seed.delivery.visible ? 'blue' : 'paper'}>{seed.delivery.visible ? '已授权给女儿' : '仅妈妈可见'}</Pill>
        </section>
        <section className="object-story-card">
          <div className="object-card-title"><h2>{reasonTitle}</h2><span>⌁</span></div>
          {editing ? (
            <textarea value={story} onChange={(event) => setStory(event.target.value)} aria-label="编辑留下这段记忆的原因" />
          ) : <p>{story}</p>}
        </section>
        {memory.duration && (
          <section className="object-audio-card">
            <header><b>▣ 原始记录</b><span>（妈妈的声音）</span><i /></header>
            {memory.audioSrc ? <audio className="object-real-audio" controls src={memory.audioSrc} /> : <button className={playing ? 'playing' : ''} onClick={() => setPlaying(!playing)} aria-label={playing ? '暂停妈妈的原声演示' : '查看妈妈原声播放状态演示'}>
              <span className="detail-play">{playing ? 'Ⅱ' : '▶'}</span>
              <span className="detail-wave" />
              <time>{memory.duration}</time>
            </button>}
            {!memory.audioSrc && <small className="prototype-audio-note">原型暂无这段实际音频，仅展示播放状态</small>}
          </section>
        )}
        {!preview ? (
          <div className="object-detail-actions">
            <button className="edit-memory" onClick={saveStory}><span>□</span>{editing ? '保存修改' : '编辑这段记忆'}</button>
            <button className="preview-memory" onClick={() => setPreview(true)}><span>◇</span>{seed.delivery.visible ? '查看女儿将看到的样子' : '预演授权后的样子'}</button>
          </div>
        ) : <button className="exit-daughter-preview" onClick={() => setPreview(false)}>退出女儿视角预览</button>}
        <p className="detail-saved"><span>✓</span> {seed.status === '妈妈已确认' ? '已保存到「记忆库」' : '草稿已保存在本机，尚未开放'}</p>
      </main>
    </div>
  )
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)} aria-label={label} aria-pressed={value}><span /></button>
}

function SettingsPage({
  go,
  onCompose,
  onRecipient,
  memories,
  recipientData,
  onExport,
  quiet,
  onQuietChange,
}: {
  go: (page: Page) => void
  onCompose: () => void
  onRecipient: () => void
  memories: MemoryEntry[]
  recipientData: RecipientData
  onExport: () => void
  quiet: boolean
  onQuietChange: (quiet: boolean) => void
}) {
  const [smartOrganize, setSmartOrganize] = useState(() => window.localStorage.getItem('wozai-setting-smart') !== 'false')
  const [faceUnlock, setFaceUnlock] = useState(() => window.localStorage.getItem('wozai-setting-face') !== 'false')
  const [reminder, setReminder] = useState(() => window.localStorage.getItem('wozai-setting-reminder') ?? '每周一次')
  const authorized = memories.filter((memory) => memory.seed.delivery.visible)
  const draftCount = memories.length - authorized.length
  const authorizedMemoryCount = authorized.filter((memory) => memory.seed.type !== '愿景').length
  const authorizedWishCount = authorized.length - authorizedMemoryCount
  const authorizedLabel = `${authorizedMemoryCount} 段记忆${authorizedWishCount ? ` · ${authorizedWishCount} 个愿望` : ''}`
  const sessionLabel = recipientData.preferences.accepted
    ? `${recipientData.preferences.duration} 分钟 · ${recipientData.preferences.intensity} · ${recipientData.preferences.sound ? '可听原声' : '静音'}`
    : '等待林崖自主开启'

  useEffect(() => { window.localStorage.setItem('wozai-setting-smart', String(smartOrganize)) }, [smartOrganize])
  useEffect(() => { window.localStorage.setItem('wozai-setting-face', String(faceUnlock)) }, [faceUnlock])
  useEffect(() => { window.localStorage.setItem('wozai-setting-reminder', reminder) }, [reminder])

  const cycleReminder = () => {
    const options = ['不提醒', '每周一次', '每月一次']
    setReminder(options[(options.indexOf(reminder) + 1) % options.length])
  }

  const linkRow = (label: string, value?: string, accent = false, onClick?: () => void) => (
    <button className="settings-list-row settings-link-row" onClick={onClick}>
      <span>{label}</span>
      <span className={`settings-row-end ${accent ? 'is-accent' : ''}`}>
        {value && <small>{value}</small>}
        <b aria-hidden="true">›</b>
      </span>
    </button>
  )

  return (
    <div className="screen settings-screen">
      <main className="scroll-page settings-page">
        <header className="settings-hero">
          <h1>设置</h1>
          <p>让记录按你安心的方式，被保存、被看见。</p>
        </header>

        <section className="settings-profile-card" aria-label="妈妈的空间">
          <div className="settings-profile-copy">
            <span>妈妈的空间</span>
            <h2>林岚</h2>
            <p>妈妈 · 记录者</p>
            <small><i className="settings-lock" aria-hidden="true" />已授权 {authorizedMemoryCount} 段记忆{authorizedWishCount ? `和 ${authorizedWishCount} 个愿望` : ''}给林崖{draftCount ? ` · ${draftCount} 段仍仅自己可见` : ''}</small>
          </div>
          <div className="settings-profile-halo" aria-hidden="true" />
          <img src={mascotProfileImage} alt="" />
        </section>

        <section className="settings-section">
          <h2>我和家人</h2>
          <div className="settings-list-card">
            {linkRow('我们的记忆空间', '妈妈与女儿', false, onRecipient)}
            {linkRow('她现在能看到什么', authorizedLabel, false, onRecipient)}
            {linkRow('她的接收方式', sessionLabel, !recipientData.preferences.accepted, onRecipient)}
          </div>
          <div className="settings-delivery-summary"><span>逐段授权</span><span>来源可追溯</span><span>女儿可暂停</span>{recipientData.hiddenMemoryIds.length > 0 && <span>女儿已隐藏 {recipientData.hiddenMemoryIds.length} 段</span>}<small>当前交付方式：{recipientData.preferences.frequency}</small></div>
        </section>

        <section className="settings-section">
          <h2>记录方式</h2>
          <div className="settings-list-card">
            {linkRow('记录提醒', reminder, false, cycleReminder)}
            {linkRow('保留原始记录', '照片、原文和原声')}
            <div className="settings-list-row">
              <span>智能整理</span>
              <Toggle value={smartOrganize} onChange={setSmartOrganize} label="智能整理" />
            </div>
            <div className="settings-list-row">
              <span>减少动态效果</span>
              <Toggle value={quiet} onChange={onQuietChange} label="减少动态效果" />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>隐私与保存</h2>
          <div className="settings-list-card">
            {linkRow('可见范围', `${authorized.length} 项仅女儿 · 其余仅自己`, false, onRecipient)}
            <div className="settings-list-row">
              <span>面容解锁</span>
              <Toggle value={faceUnlock} onChange={setFaceUnlock} label="面容解锁" />
            </div>
            {linkRow('保存状态', '已保存在本机')}
            {linkRow('导出我的全部记录', 'JSON', false, onExport)}
          </div>
        </section>

        <section className="settings-section settings-last-section">
          <h2>帮助与关于</h2>
          <div className="settings-list-card">
            {linkRow('使用帮助')}
            {linkRow('意见反馈')}
            {linkRow('关于「我在」', 'v0.7')}
          </div>
        </section>
      </main>
      <nav className="bottom-nav settings-bottom-nav" aria-label="妈妈创作端导航">
        <button onClick={() => go('creator')}><span>⌂</span>首页</button>
        <button onClick={() => go('library')}><span>▱</span>记忆库</button>
        <button className="active" onClick={() => go('settings')}><span>☷</span>设置</button>
      </nav>
      <button className="floating-add" onClick={onCompose} aria-label="把这一刻交给信使">＋</button>
    </div>
  )
}

function RecipientHome({
  go,
  memories,
  data,
  onStart,
  onEndSession,
  onUpdatePreferences,
  onOpenMemory,
  messenger,
  onCompose,
  onPigeon,
  onDismissPigeon,
  pigeonDockDismissed,
}: {
  go: (page: Page) => void
  memories: MemoryEntry[]
  data: RecipientData
  onStart: (preferences: RecipientPreferences) => void
  onEndSession: () => void
  onUpdatePreferences: (patch: Partial<RecipientPreferences>) => void
  onOpenMemory: (id: number) => void
  messenger: MessengerChannelState
  onCompose: () => void
  onPigeon: () => void
  onDismissPigeon: () => void
  pigeonDockDismissed: boolean
}) {
  const [duration, setDuration] = useState<5 | 10 | 15>(data.preferences.duration)
  const [sound, setSound] = useState(data.preferences.sound)
  const [level, setLevel] = useState<Intensity>(data.preferences.intensity)
  const [adjusting, setAdjusting] = useState(false)
  const [ended, setEnded] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!data.preferences.accepted || !data.sessionEndsAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [data.preferences.accepted, data.sessionEndsAt])
  const secondsRemaining = data.sessionEndsAt ? Math.min(data.preferences.duration * 60, Math.max(0, Math.ceil((data.sessionEndsAt - now) / 1000))) : data.preferences.duration * 60
  const sessionExpired = Boolean(data.preferences.accepted && data.preferences.frequency !== '暂停出现' && data.sessionEndsAt && secondsRemaining <= 0)
  const remainingLabel = `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`
  const featured = memories.find((memory) => memory.seed.type !== '愿景' && !data.viewedMemoryIds.includes(memory.seed.id)) ?? memories.find((memory) => memory.seed.type !== '愿景') ?? memories[0]
  const currentMemoryIds = new Set(memories.map((memory) => memory.seed.id))
  const viewedCount = data.viewedMemoryIds.filter((id) => currentMemoryIds.has(id)).length
  const wish = memories.find((memory) => memory.seed.type === '愿景')
  const daughterHistory = messenger.history
  const daughterSending = messenger.phase === 'sending'
  const daughterDelivered = messenger.phase === 'delivered'
  const dockStatus = pigeonDockDismissed ? null : daughterSending ? 'sending' : daughterDelivered && messenger.unread ? 'delivered' : null
  const dockUnread = daughterDelivered && messenger.unread
  const counts = memories.reduce<Record<MemoryKind, number>>((result, memory) => ({ ...result, [memory.kind]: result[memory.kind] + 1 }), { 照片: 0, 文字: 0, 声音: 0, 物件: 0 })
  const flows: { page: Page; title: string; copy: string; accent: string; status: string }[] = [
    { page: 'gallery', title: '妈妈的记忆', copy: `${memories.length} 段本人确认的照片、文字、声音与物件`, accent: 'sand', status: '去看看' },
    { page: 'echo', title: '给记忆写一封信', copy: '只从妈妈真实留下并授权的内容里寻找关联', accent: 'blue', status: '交给信使' },
    { page: 'seek', title: '顺着线索看看', copy: '可以慢慢问，也可以直接查看完整原文', accent: 'ink', status: '一问一答' },
    { page: 'wish', title: '一个可以拒绝的愿望', copy: '把妈妈明确留下的愿望改成今天合适的一小步', accent: 'clay', status: wish ? data.dismissedWishIds.includes(wish.seed.id) ? '已放回原文' : '由你决定' : '没有任务' },
  ]

  if (ended || sessionExpired) {
    return (
      <div className="screen recipient-screen recipient-ended-screen">
        <main>
          <span className="calm-check">好</span>
          <h1>今天先到这里</h1>
          <p>没有打开任何声音，也不会自动提醒你继续。什么时候想回来，都由你决定。</p>
          <button className="primary-button" onClick={() => { onStart(data.preferences); setNow(Date.now()); setEnded(false) }}>重新打开 {data.preferences.duration} 分钟</button>
          <button className="recipient-text-button" onClick={() => onUpdatePreferences({ accepted: false })}>重新选择接收方式</button>
          <button className="recipient-text-button" onClick={() => go('creator')}>关闭女儿端预览</button>
        </main>
      </div>
    )
  }

  if (!data.preferences.accepted) {
    return (
      <div className="screen recipient-screen recipient-consent-screen">
        <main className="scroll-page recipient-consent-page">
          <SourceMark>林岚本人留下并仅授权给你</SourceMark>
          <header>
            <span>给林崖</span>
            <h1>妈妈留给你的<br />一组真实记忆</h1>
            <p>这是一次接收预览。你可以决定今天看多少、要不要听声音，也可以暂时不打开。</p>
          </header>
          <section className="recipient-access-card">
            <img src={westLakeImage} alt="林岚留给女儿的西湖家庭照片" />
            <div><small>关系空间</small><h2>林岚 → 林崖</h2><p>{memories.length} 段已确认内容 · 仅你可见</p></div>
          </section>
          <section className="recipient-safety-list" aria-label="使用说明">
            <div><span>一</span><p><b>不会冒充妈妈与你对话</b><small>所有内容都能回到她留下的原图、原文或原声。</small></p></div>
            <div><span>二</span><p><b>声音不会自动播放</b><small>只有你主动选择后，原声才会开始。</small></p></div>
            <div><span>三</span><p><b>你可以随时停下</b><small>暂停、降低强度或删除自己的输入，都不需要解释原因。</small></p></div>
          </section>
          <section className="recipient-first-settings">
            <div className="recipient-choice-row"><b>今天想停留多久</b><div>{([5, 10, 15] as const).map((value) => <button key={value} className={duration === value ? 'active' : ''} onClick={() => setDuration(value)}>{value} 分钟</button>)}</div></div>
            <div className="recipient-choice-row"><b>今天的内容</b><div><button className={level === 'L1' ? 'active' : ''} onClick={() => setLevel('L1')}>轻一点</button><button className={level === 'L2' ? 'active' : ''} onClick={() => setLevel('L2')}>多些细节</button></div></div>
            <label className="recipient-sound-choice"><span><b>今天可以听原声</b><small>仍需每次主动点击播放</small></span><Toggle value={sound} onChange={setSound} label="今天可以听原声" /></label>
          </section>
          <button className="recipient-start-button" onClick={() => onStart({ accepted: true, duration, sound, intensity: level, frequency: data.preferences.frequency })}>打开今天的一小段</button>
          <button className="recipient-later-button" onClick={() => setEnded(true)}>今天先不打开</button>
          <p className="recipient-consent-note">本次为妈妈本人预先授权的接收体验，不涉及身份替代，也不会自动生成她没有说过的话。</p>
        </main>
      </div>
    )
  }

  if (data.preferences.frequency === '暂停出现') {
    return (
      <div className="screen recipient-screen recipient-paused-screen">
        <main className="scroll-page recipient-paused-page">
          <SourceMark>由林崖选择暂停</SourceMark>
          <div className="recipient-paused-orbit"><img src={mascotIdleImage} alt="安静等待的信鸽" /><i /><i /></div>
          <h1>过去已经退回<br />安静的位置</h1>
          <p>不会主动出现，也不会提醒你继续。妈妈留下的内容没有被删除；需要时，你仍可以自己打开。</p>
          <button className="primary-button" onClick={() => go('gallery')}>我想主动看一段记忆</button>
          <button className="secondary-button" onClick={() => go('you')}>只查看我的记录</button>
          <button className="recipient-text-button" onClick={() => { onUpdatePreferences({ frequency: '仅主动进入' }); onStart({ ...data.preferences, frequency: '仅主动进入' }) }}>恢复为仅主动进入</button>
        </main>
        <nav className="bottom-nav recipient-bottom-nav" aria-label="女儿端导航">
          <button className="active" onClick={() => go('recipient')}><span>⌂</span>今天</button>
          <button onClick={() => go('gallery')}><span>▱</span>记忆</button>
          <button onClick={() => go('you')}><span>○</span>我的</button>
        </nav>
      </div>
    )
  }

  return (
    <div className="screen recipient-screen">
      <div className="tide tide-a" /><div className="tide tide-b" />
      <main className="scroll-page recipient-home recipient-dashboard">
        <header className="recipient-header">
          <div className="recipient-kicker"><SourceMark>林岚亲自留下并授权</SourceMark><Pill tone="paper">仅林崖可见</Pill></div>
          <h1>妈妈留给你的<br />记忆</h1>
          <p>不用一次看完。今天只打开一小段，也已经足够。</p>
        </header>

        <button className="recipient-session-bar" onClick={() => setAdjusting(!adjusting)} aria-expanded={adjusting}>
          <span>今天还剩 {remainingLabel} · {data.preferences.sound ? '可听原声' : '保持静音'} · {data.preferences.intensity === 'L1' ? '轻一点' : '多些细节'}</span><b>{adjusting ? '收起' : '调整'}</b>
        </button>
        {adjusting && (
          <section className="recipient-session-panel">
            <div><span>停留时间</span>{([5, 10, 15] as const).map((value) => <button key={value} className={data.preferences.duration === value ? 'active' : ''} onClick={() => onUpdatePreferences({ duration: value })}>{value} 分钟</button>)}</div>
            <div><span>原声</span><button className={!data.preferences.sound ? 'active' : ''} onClick={() => onUpdatePreferences({ sound: false })}>保持静音</button><button className={data.preferences.sound ? 'active' : ''} onClick={() => onUpdatePreferences({ sound: true })}>可以听</button></div>
            <div><span>内容强度</span><button className={data.preferences.intensity === 'L1' ? 'active' : ''} onClick={() => onUpdatePreferences({ intensity: 'L1' })}>轻一点</button><button className={data.preferences.intensity === 'L2' ? 'active' : ''} onClick={() => onUpdatePreferences({ intensity: 'L2' })}>多些细节</button></div>
            <button className="recipient-end-session" onClick={() => { onEndSession(); setEnded(true) }}>结束今天的体验</button>
            <button className="recipient-reset-access" onClick={() => onUpdatePreferences({ accepted: false })}>重新选择接收方式</button>
          </section>
        )}

        <section className="recipient-summary-card">
          <div><small>妈妈为你开放</small><strong>{memories.length}</strong><span>段记忆</span></div>
          <p>{counts.照片} 张照片 · {counts.文字} 段文字<br />{counts.声音} 段声音 · {counts.物件} 个物件</p>
          <span>{viewedCount ? `你已看过 ${viewedCount} 段` : '还没有打开任何一段'}</span>
        </section>

        {featured && (
          <section className="recipient-feature-card">
            <div className="recipient-feature-art"><MemoryArtwork memory={featured} /></div>
            <div className="recipient-feature-copy"><small>{data.viewedMemoryIds.length ? '继续下一段' : '欢迎记忆'}</small><h2>{featured.seed.title}</h2><p>{featured.seed.excerpt}</p><button onClick={() => onOpenMemory(featured.seed.id)}>先看静态内容 <b>›</b></button></div>
          </section>
        )}

        <section className="recipient-home-section">
          <div className="recipient-section-title"><h2>你可以这样使用</h2><span>随时退出</span></div>
          <div className="flow-list recipient-flow-list">
            {flows.map((flow) => (
              <button key={flow.page} className={`flow-card flow-${flow.accent}`} onClick={() => flow.page === 'echo' ? onCompose() : go(flow.page)}>
                <span className="recipient-flow-status">{flow.status}</span>
                <div><h2>{flow.title}</h2><p>{flow.copy}</p></div><b>›</b>
              </button>
            ))}
          </div>
        </section>
        <button className="you-entry recipient-you-entry" onClick={() => go('you')}><span>{data.entries.length}</span><div><small>你在这里留下的内容</small><h2>我的今天</h2></div><b>›</b></button>
        <p className="session-exit">本次体验不会自动播放声音 · 任何页面都可以返回</p>
      </main>
      <nav className="bottom-nav recipient-bottom-nav" aria-label="女儿端导航">
        <button className="active" onClick={() => go('recipient')}><span>⌂</span>今天</button>
        <button onClick={() => go('gallery')}><span>▱</span>记忆</button>
        <button onClick={() => go('you')}><span>○</span>我的</button>
      </nav>
      {dockStatus ? (
        <PigeonDock owner="daughter" status={dockStatus} unread={dockUnread} onClick={onPigeon} onDismiss={onDismissPigeon} />
      ) : daughterHistory.length > 0 ? <button className="pigeon-history-shortcut recipient-pigeon-history" onClick={onPigeon} aria-label="查看女儿端往返信件"><img src={mascotIdleImage} alt="" /><span>往返信件</span></button> : <button className="floating-add recipient-compose-add" onClick={onCompose} aria-label="把女儿的此刻交给信使">＋</button>}
    </div>
  )
}

function GalleryPage({
  onBack,
  go,
  memories,
  selectedMemoryId,
  viewedMemoryIds,
  soundEnabled,
  onSelect,
  onViewed,
  onRespond,
}: {
  onBack: () => void
  go: (page: Page) => void
  memories: MemoryEntry[]
  selectedMemoryId: number
  viewedMemoryIds: number[]
  soundEnabled: boolean
  onSelect: (id: number) => void
  onViewed: (id: number) => void
  onRespond: (id: number) => void
}) {
  const [played, setPlayed] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const memory = memories.find((item) => item.seed.id === selectedMemoryId) ?? memories.find((item) => item.seed.type !== '愿景') ?? memories[0]

  useEffect(() => {
    setPlayed(false)
    setShowSource(false)
  }, [selectedMemoryId])

  if (!memory) return <div className="screen gallery-screen"><BackHeader title="妈妈的记忆" onBack={onBack} /><main className="empty-recipient-memory">暂时没有已授权的内容</main></div>

  const viewed = viewedMemoryIds.includes(memory.seed.id)
  return (
    <div className="screen gallery-screen">
      <BackHeader title="妈妈的记忆" eyebrow="本人确认 · 仅你可见" onBack={onBack} action={<Pill tone="paper">{soundEnabled ? '原声可用' : '静音'}</Pill>} />
      <main className="scroll-page gallery-page recipient-gallery-page">
        <div className="safe-banner"><b>这里仅显示林岚明确授权给你的内容</b><p>每段都可以查看原始来源；未经确认或属于其他人的内容不会出现。</p></div>

        <section className="recipient-memory-picker">
          <header><h2>选择一段记忆</h2><span>{memories.length} 段</span></header>
          <div>
            {memories.map((item) => (
              <button key={item.seed.id} className={item.seed.id === memory.seed.id ? 'active' : ''} onClick={() => onSelect(item.seed.id)}>
                <span className="recipient-memory-thumb"><MemoryArtwork memory={item} /></span>
                <b>{item.seed.title}</b><small>{item.kind} · {item.seed.year}{viewedMemoryIds.includes(item.seed.id) ? ' · 已看' : ''}</small>
              </button>
            ))}
          </div>
        </section>

        <article className="recipient-memory-detail">
          <div className="recipient-memory-hero"><MemoryArtwork memory={memory} context="detail" /></div>
          <div className="recipient-memory-heading"><SourceMark>妈妈原始记录 · 已确认</SourceMark><Pill tone="paper">{memory.kind}</Pill></div>
          <h1>{memory.seed.title}</h1>
          <p className="recipient-memory-meta">{memory.date} · {memory.scene}</p>
          <blockquote>“{memory.seed.excerpt}”</blockquote>
          <section className="recipient-story-copy"><span>妈妈为什么留下它</span><p>{memory.story}</p></section>

          {memory.duration && (
            soundEnabled ? (
              memory.audioSrc ? <div className="recipient-real-audio"><span>妈妈留下的原声 · 需主动播放</span><audio controls src={memory.audioSrc} /></div> : <button className={`audio-control ${played ? 'playing' : ''}`} onClick={() => setPlayed(!played)}><span>{played ? 'Ⅱ' : '▶'}</span><div><b>{played ? '原声播放状态演示中' : '查看原声播放演示'}</b><small>{memory.duration} · 原型暂无实际音频</small></div><i /></button>
            ) : (
              <button className="audio-control is-muted" disabled><span>◇</span><div><b>今天保持静音</b><small>可以回到首页调整本次声音设置</small></div><i /></button>
            )
          )}

          <button className="recipient-source-toggle" onClick={() => setShowSource(!showSource)} aria-expanded={showSource}>{showSource ? '收起原始依据' : '查看原始依据与授权'} <b>›</b></button>
          {showSource && <div className="recipient-source-panel"><p><b>原始来源</b>{memory.origin}</p><p><b>接收范围</b>仅林崖 · 母女关系空间</p><p><b>可用方式</b>查看、关联回应、线索探索；声音必须主动播放</p><p><b>内容说明</b>故事为 AI 整理，已由林岚本人确认；引文保持原文。</p></div>}

          <div className="recipient-memory-actions">
            <button className={viewed ? 'is-viewed' : ''} onClick={() => onViewed(memory.seed.id)}>{viewed ? '✓ 已放回记忆馆' : '我看完了'}</button>
            <button disabled={!memory.seed.delivery.flows.includes('探索')} onClick={() => go('seek')}>{memory.seed.delivery.flows.includes('探索') ? '顺着线索看看' : '未开放线索探索'}</button>
          </div>
        </article>
      </main>
      <div className="sticky-actions gallery-actions"><button className="secondary-button" onClick={onBack}>今天到这里</button><button className="primary-button" disabled={!memory.seed.delivery.flows.includes('回应')} onClick={() => onRespond(memory.seed.id)}>{memory.seed.delivery.flows.includes('回应') ? '写下我的回应' : '此段仅开放查看'}</button></div>
    </div>
  )
}

function MessengerHubPage({ onBack, onCompose, onOpenHistory, history }: { onBack: () => void; onCompose: () => void; onOpenHistory: (id?: number) => void; history: MessengerExchange[] }) {
  const daughterHistory = history.filter((exchange) => exchange.sender === 'daughter')
  return (
    <div className="screen echo-screen messenger-hub-screen">
      <BackHeader title="我在，你说" eyebrow="女儿的此刻" onBack={onBack} action={<Pill tone="blue">信鸽往返</Pill>} />
      <main className="scroll-page messenger-hub-page">
        <section className="messenger-hub-hero">
          <img src={mascotProfileImage} alt="信鸽在等待女儿写下此刻" />
          <SourceMark>发送人 · 林崖</SourceMark>
          <h1>把女儿的此刻<br />交给信使</h1>
          <p>信使只会沿着妈妈亲自留下、确认并授权给你的内容寻找关联，不会替妈妈在线回答。</p>
          <button onClick={onCompose}>写下现在的一小段</button>
        </section>
        <section className="messenger-hub-history">
          <div><h2>往返信件</h2><span>{daughterHistory.length} 封</span></div>
          {daughterHistory.length ? daughterHistory.slice(-3).reverse().map((exchange) => <button key={exchange.id} onClick={() => onOpenHistory(exchange.id)}><span>{exchange.mode}</span><div><b>{exchange.text || exchange.attachment?.name || '一段没有附言的此刻'}</b><small>{formatMessengerTime(exchange.sentAt)} · {exchange.sourceSeedId ? '带回一段旧记录' : '未找到足够关联'}</small></div><i>›</i></button>) : <p>还没有寄出的内容。写下一句话、照片附言或一段声音后，信鸽会回到女儿首页。</p>}
        </section>
        <p className="messenger-hub-note">女儿写下的内容属于她自己，可以在「我的」中查看或删除。</p>
      </main>
    </div>
  )
}

function SeekPage({ onBack, memory, onSaveEntry }: { onBack: () => void; memory: MemoryEntry; onSaveEntry: (entry: Omit<DaughterEntry, 'id' | 'createdAt'>) => void }) {
  const [answer, setAnswer] = useState('')
  const [answerGrounded, setAnswerGrounded] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [asked, setAsked] = useState<string[]>([])
  const [customQuestion, setCustomQuestion] = useState('')
  const [addingVersion, setAddingVersion] = useState(false)
  const [myVersion, setMyVersion] = useState('')
  const [saved, setSaved] = useState(false)
  const ask = (direction: string) => {
    const replies: Record<string, string> = {
      时间: `记录里写的是 ${memory.date}。`,
      地点: `记录明确提到：${memory.scene}。`,
      人物: `这段内容被标记为“${memory.seed.relation}”，没有开放其他关系人的内容。`,
      为什么: memory.story,
    }
    setAnswer(replies[direction])
    setAnswerGrounded(true)
    setAsked((current) => current.includes(direction) ? current : [...current, direction])
  }
  const askCustomQuestion = () => {
    const question = customQuestion.trim()
    if (!question) return
    const match = /什么时候|哪年|时间/.test(question) ? '时间' : /哪里|地点|在哪/.test(question) ? '地点' : /谁|人物|一起/.test(question) ? '人物' : /为什么|原因|留下/.test(question) ? '为什么' : null
    if (match) {
      ask(match)
    } else {
      setAnswer('妈妈留下的这段原始记录里没有足够依据回答这个问题。系统不会替她补充没有说过的细节，你可以直接查看完整原文，或写下自己的版本。')
      setAnswerGrounded(false)
    }
    setCustomQuestion('')
  }
  const saveVersion = () => {
    if (!myVersion.trim()) return
    onSaveEntry({ kind: '我的补充', title: `我记得的「${memory.seed.title}」`, text: myVersion.trim(), sourceSeedId: memory.seed.id })
    setSaved(true)
  }
  return (
    <div className="screen seek-screen">
      <BackHeader title="我在，你寻" eyebrow="关系探索" onBack={onBack} action={<Pill tone="paper">可随时直看</Pill>} />
      <main className="scroll-page seek-page">
        <div className="mystery-object"><div className="seek-memory-preview"><MemoryArtwork memory={memory} /></div><i /><i /></div>
        <section className="mystery-question"><small>来自「{memory.seed.title}」</small><h2>妈妈为什么一直留下这段记忆？</h2><p>没有猜错惩罚。你可以慢慢问，也可以直接看完整经历。</p></section>
        <div className="direction-row"><span>试试从这些方向问</span><div>{['时间', '地点', '人物', '为什么'].map((item) => <button key={item} onClick={() => ask(item)}>{item}</button>)}</div></div>
        <div className="seek-free-question"><input value={customQuestion} onChange={(event) => setCustomQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') askCustomQuestion() }} placeholder="也可以问一句自己的问题" aria-label="向这段记录提问" /><button disabled={!customQuestion.trim()} onClick={askCustomQuestion}>问这段记录</button></div>
        {answer && <div className={`answer-card ${answerGrounded ? '' : 'is-insufficient'}`}><SourceMark>{answerGrounded ? '依据妈妈确认的记录' : '原始记录不足'}</SourceMark><p>{answer}</p><button onClick={() => setAnswer('')}>继续问</button></div>}
        <div className="memory-outline" aria-label="已浮现的记忆轮廓"><span className={asked.includes('时间') ? 'visible' : ''}>时间</span><span className={asked.includes('地点') ? 'visible' : ''}>地点</span><span className={asked.includes('人物') ? 'visible' : ''}>人物</span><span className={asked.includes('为什么') ? 'visible' : ''}>意义</span></div>
        <button className="reveal-link" onClick={() => setRevealed(!revealed)}>{revealed ? '收起完整经历' : '不想猜了，直接看完整经历'} <b>›</b></button>
        {revealed && <article className="full-story"><SourceMark>妈妈原始内容 + 本人确认整理</SourceMark><h2>{memory.seed.title}</h2><p>{memory.story}</p><blockquote>“{memory.seed.excerpt}”</blockquote><button onClick={() => setAddingVersion(!addingVersion)}>{addingVersion ? '收起我的版本' : '我想补充我记得的版本'}</button>{addingVersion && <div className="my-version-form"><textarea value={myVersion} onChange={(event) => { setMyVersion(event.target.value); setSaved(false) }} placeholder="你记得的内容可以和妈妈的版本不同，系统不会判断谁对谁错。" /><button className={saved ? 'saved' : ''} disabled={!myVersion.trim() || saved} onClick={saveVersion}>{saved ? '✓ 已保存到我的记录' : '保存我的版本'}</button></div>}</article>}
      </main>
    </div>
  )
}

function WishPage({ onBack, go, wish, dismissed, onSaveEntry, onDecline }: { onBack: () => void; go: (page: Page) => void; wish?: MemoryEntry; dismissed: boolean; onSaveEntry: (entry: Omit<DaughterEntry, 'id' | 'createdAt'>) => void; onDecline: (id: number) => void }) {
  const [choice, setChoice] = useState('')
  const [declined, setDeclined] = useState(false)
  const startAction = () => {
    if (!choice || !wish) return
    const actions: Record<string, string> = { '5 分钟': '下楼站一会儿', '10 分钟': '走到熟悉的路口', '20 分钟': '和朋友一起散步' }
    onSaveEntry({ kind: '轻行动', title: actions[choice], text: `${choice} · 来自妈妈明确留下、允许行动化的愿望。`, sourceSeedId: wish.seed.id })
    go('you')
  }
  if (!wish) return <div className="screen wish-screen calm-result"><BackHeader title="一个可以拒绝的愿望" eyebrow="行动属于你" onBack={onBack} /><main><span className="calm-check">空</span><h2>没有可行动的愿望</h2><p>妈妈没有明确留下并允许行动化的内容，系统不会替她生成任务。</p><button className="primary-button" onClick={onBack}>回到今天</button></main></div>
  if (declined || dismissed) return (
    <div className="screen wish-screen calm-result"><BackHeader title="我在，你做" eyebrow="行动属于你" onBack={onBack} /><main><span className="calm-check">好</span><h2>不做也可以</h2><p>这个愿望会安静地留在原文里，系统不会再主动提醒你。</p><button className="primary-button" onClick={() => go('recipient')}>回到今天</button></main></div>
  )
  return (
    <div className="screen wish-screen">
      <BackHeader title="我在，你做" eyebrow="遗愿到轻行动" onBack={onBack} action={<Pill tone="paper">无提醒</Pill>} />
      <main className="scroll-page wish-page">
        <article className="wish-original"><SourceMark>妈妈原始愿望 · 本人确认可行动化</SourceMark><span className="quote-mark">“</span><h2>{wish.seed.excerpt}</h2><p>{wish.seed.source} · 只给女儿</p></article>
        <section className="action-choices"><h3>如果今天合适，可以把它改轻一点</h3>{[
          ['5 分钟', '下楼站一会儿', '低体力 · 无花费'],
          ['10 分钟', '走到熟悉的路口', '轻体力 · 可独自'],
          ['20 分钟', '和朋友一起散步', '需联系一位真人'],
        ].map(([time, title, note]) => <button key={time} className={choice === time ? 'active' : ''} onClick={() => setChoice(time)}><span>{time}</span><div><b>{title}</b><small>{note}</small></div><i /></button>)}</section>
        <div className="choice-exits"><button className="primary-button" disabled={!choice} onClick={startAction}>试试看</button><button onClick={() => setChoice('5 分钟')}>改轻一点</button><button onClick={onBack}>以后再说</button><button onClick={() => { onDecline(wish.seed.id); setDeclined(true) }}>我不想做</button></div>
        <p className="privacy-note">这不是必须完成的任务。没有积分、连续打卡或“让妈妈失望”的提示。</p>
      </main>
    </div>
  )
}

function YouPage({
  onBack,
  entries,
  reflections,
  frequency,
  onSaveEntry,
  onRemoveEntry,
  onFrequencyChange,
  onUpdateReflection,
  onOpenMemory,
  hiddenMemoryCount,
  onRestoreHiddenMemories,
}: {
  onBack: () => void
  entries: DaughterEntry[]
  reflections: RelationshipReflection[]
  frequency: RecipientPreferences['frequency']
  onSaveEntry: (entry: Omit<DaughterEntry, 'id' | 'createdAt'>) => void
  onRemoveEntry: (id: number) => void
  onFrequencyChange: (frequency: RecipientPreferences['frequency']) => void
  onUpdateReflection: (reflection: RelationshipReflection) => void
  onOpenMemory: (id: number) => void
  hiddenMemoryCount: number
  onRestoreHiddenMemories: () => void
}) {
  const [draft, setDraft] = useState('')
  const [showFrequency, setShowFrequency] = useState(false)
  const [editingReflection, setEditingReflection] = useState<RelationshipReflection['key'] | null>(null)
  const [reflectionDraft, setReflectionDraft] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const latestEntry = entries[0]
  const now = new Date()
  const todayLabel = `${String(now.getMonth() + 1).padStart(2, '0')} · ${String(now.getDate()).padStart(2, '0')}`
  const saveDraft = () => {
    if (!draft.trim()) return
    onSaveEntry({ kind: '今天的记录', title: '今天想留下的一句话', text: draft.trim() })
    setDraft('')
  }
  const reflectionLabels: Record<RelationshipReflection['key'], string> = {
    learned: '妈妈教会了我',
    keep: '我选择保留',
    creating: '我正在创造',
    release: '我选择放下',
  }
  const beginReflectionEdit = (reflection: RelationshipReflection) => {
    setEditingReflection(reflection.key)
    setReflectionDraft(reflection.text)
  }
  const saveReflection = (reflection: RelationshipReflection) => {
    if (reflectionDraft.trim()) onUpdateReflection({ ...reflection, text: reflectionDraft.trim() })
    setEditingReflection(null)
  }
  return (
    <div className="screen you-screen">
      <BackHeader title="我的今天" eyebrow="今天的生活属于你" onBack={onBack} action={<Pill tone="blue">{entries.length} 条记录</Pill>} />
      <main className="scroll-page you-page">
        <header className="you-hero"><div className="you-hero-meta"><SourceMark>只属于林崖的个人记录</SourceMark><span>{todayLabel}</span></div><h1>生活正在长出新的页</h1><p>过去可以被好好放着，而你正在创造的，也会成为自己的记录。</p></header>
        <article className={`today-card ${latestEntry ? 'has-latest-entry' : ''}`}><div className="today-card-meta"><span>{latestEntry ? '最近保存' : '今天'}</span><small>{todayLabel} · 林崖</small></div><h2>{latestEntry?.title ?? '今天还没有留下记录'}</h2><p>{latestEntry?.text ?? '可以只写一句话，也可以什么都不写。今天的生活不需要向任何人交作业。'}</p>{latestEntry && <button className="saved" disabled>✓ 已在我的记录里</button>}</article>

        <section className="daughter-note-form"><h2>也可以只留一句话</h2><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="这段内容属于你，不会被写成妈妈的回应。" /><button disabled={!draft.trim()} onClick={saveDraft}>保存我的一句话</button></section>

        <section className="daughter-entry-list">
          <div className="daughter-entry-title"><h2>我留下的内容</h2><span>{entries.length} 条</span></div>
          {entries.length ? entries.map((entry) => <article key={entry.id}>
            <span>{entry.kind}</span>
            <div><h3>{entry.title}</h3><p>{entry.text}</p><small>{entry.createdAt}{entry.sourceSeedId ? ' · 与妈妈的一段记忆有关' : ''}</small>{entry.sourceSeedId && <button className="daughter-source-link" onClick={() => onOpenMemory(entry.sourceSeedId!)}>查看相关记忆 ›</button>}</div>
            <button onClick={() => setPendingDeleteId(entry.id)} aria-label={`删除${entry.title}`}>×</button>
            {pendingDeleteId === entry.id && <div className="entry-delete-confirm"><p>{entry.exchangeId ? '会同时删除这条个人记录和对应的往返信件。' : '会从你的个人记录中删除这一条。'}</p><button onClick={() => setPendingDeleteId(null)}>取消</button><button onClick={() => { onRemoveEntry(entry.id); setPendingDeleteId(null) }}>确认删除</button></div>}
          </article>) : <p className="daughter-entry-empty">还没有保存内容。你可以从信使、线索探索或今天的一句话开始。</p>}
        </section>
        <section className="influence-map"><div className="influence-heading"><h2>这段关系如何留在我身上</h2><small>由你定义，不由系统替你总结</small></div>{reflections.map((reflection, index) => <div className="influence-row" key={reflection.key}><span>{index + 1}</span><div><b>{reflectionLabels[reflection.key]}</b>{editingReflection === reflection.key ? <textarea value={reflectionDraft} onChange={(event) => setReflectionDraft(event.target.value)} aria-label={`编辑${reflectionLabels[reflection.key]}`} autoFocus /> : <p>{reflection.text}</p>}</div><button onClick={() => editingReflection === reflection.key ? saveReflection(reflection) : beginReflectionEdit(reflection)}>{editingReflection === reflection.key ? '保存' : '修改'}</button></div>)}</section>
        <div className="frequency-card"><div><b>让过去退回安静的位置</b><p>当前：{frequency}。你可以随时调整，不会影响已经保存的内容。</p></div><button onClick={() => setShowFrequency(!showFrequency)}>调整频率</button></div>
        {showFrequency && <div className="frequency-options">{(['仅主动进入', '每周一次', '暂停出现'] as const).map((item) => <button key={item} className={frequency === item ? 'active' : ''} onClick={() => onFrequencyChange(item)}>{item}</button>)}</div>}
        {hiddenMemoryCount > 0 && <div className="hidden-memory-control"><div><b>我说过“不要再出现”</b><p>{hiddenMemoryCount} 段记忆已从女儿端隐藏，妈妈的原始内容没有被删除。</p></div><button onClick={onRestoreHiddenMemories}>恢复显示</button></div>}
        <p className="you-closing">这段记忆属于你们，而今天的生活属于你。</p>
      </main>
    </div>
  )
}

const validPages: Page[] = ['creator', 'capture', 'library', 'detail', 'settings', 'recipient', 'gallery', 'echo', 'seek', 'wish', 'you']
const recipientPages: Page[] = ['recipient', 'gallery', 'echo', 'seek', 'wish', 'you']

function loadCurrentPage(): Page {
  if (typeof window === 'undefined') return 'creator'
  const stored = window.sessionStorage.getItem('wozai-current-page-v1') as Page | null
  if (!stored || !validPages.includes(stored) || stored === 'detail') return 'creator'
  return stored
}

function App() {
  const [page, setPage] = useState<Page>(loadCurrentPage)
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('全部')
  const [seeds, setSeeds] = useState<Seed[]>(loadSeeds)
  const [detail, setDetail] = useState<Seed | null>(null)
  const [detailBack, setDetailBack] = useState<'creator' | 'library'>('library')
  const [toast, setToast] = useState('')
  const [quiet, setQuiet] = useState(() => window.localStorage.getItem('wozai-quiet-mode') === 'true')
  const [messenger, setMessenger] = useState<MessengerState>(loadMessengerState)
  const [activeMessengerOwner, setActiveMessengerOwner] = useState<MessengerOwner | null>(null)
  const [savedMessengerDrafts, setSavedMessengerDrafts] = useState<Partial<Record<MessengerOwner, SavedMessengerDraft>>>(loadMessengerDrafts)
  const [pigeonDockDismissed, setPigeonDockDismissed] = useState(false)
  const [recipientPigeonDockDismissed, setRecipientPigeonDockDismissed] = useState(false)
  const [recipientData, setRecipientData] = useState<RecipientData>(loadRecipientData)
  const [recipientEchoContextId, setRecipientEchoContextId] = useState<number | null>(null)
  const allMemories = useMemo(() => buildMemories(seeds), [seeds])
  const authorizedRecipientMemories = useMemo(() => allMemories.filter((memory) => memory.seed.status === '妈妈已确认' && memory.seed.delivery.visible && memory.seed.delivery.flows.includes('查看')), [allMemories])
  const recipientMemories = useMemo(() => authorizedRecipientMemories.filter((memory) => memory.seed.type !== '愿景' && !recipientData.hiddenMemoryIds.includes(memory.seed.id) && (recipientData.preferences.intensity === 'L2' || memory.seed.intensity === 'L1')), [authorizedRecipientMemories, recipientData.hiddenMemoryIds, recipientData.preferences.intensity])
  const selectedRecipientMemory = recipientMemories.find((memory) => memory.seed.id === recipientData.selectedMemoryId) ?? recipientMemories.find((memory) => memory.seed.type !== '愿景') ?? recipientMemories[0]
  const recipientWish = authorizedRecipientMemories.find((memory) => memory.seed.type === '愿景' && memory.seed.delivery.flows.includes('行动') && !recipientData.hiddenMemoryIds.includes(memory.seed.id) && (recipientData.preferences.intensity === 'L2' || memory.seed.intensity === 'L1'))
  const activeMessenger = activeMessengerOwner ? messenger[activeMessengerOwner] : null

  const showToast = (message: string, duration = 2300) => {
    setToast(message)
    window.setTimeout(() => setToast(''), duration)
  }

  useEffect(() => {
    const timers: number[] = []
    ;(['mother', 'daughter'] as const).forEach((owner) => {
      const channel = messenger[owner]
      if (channel.phase !== 'sending') return
      const pending = channel.pending
      const deliver = () => {
        if (owner === 'mother') {
          const seed = motherExchangeToSeed(pending)
          setSeeds((current) => current.some((item) => item.id === seed.id) ? current : [seed, ...current])
          setPigeonDockDismissed(true)
          setMessenger((current) => {
            const currentChannel = current.mother
            if (currentChannel.phase !== 'sending' || currentChannel.pending.id !== pending.id) return current
            return { ...current, mother: { phase: 'idle', history: currentChannel.history } }
          })
          showToast('这一刻已收进记忆库，并按授权留给林崖。妈妈端无需等待回信。', 3000)
          return
        }
        setRecipientPigeonDockDismissed(false)
        setMessenger((current) => {
          const currentChannel = current[owner]
          if (currentChannel.phase !== 'sending' || currentChannel.pending.id !== pending.id) return current
          const history = currentChannel.history.some((exchange) => exchange.id === pending.id) ? currentChannel.history : [...currentChannel.history, pending]
          return { ...current, [owner]: { phase: 'delivered', history, unread: true, owner } }
        })
        if (owner === 'daughter') {
          setRecipientData((current) => ({
            ...current,
            entries: current.entries.map((entry) => entry.exchangeId === pending.id ? { ...entry, sourceSeedId: pending.sourceSeedId } : entry),
          }))
        }
      }
      const delay = Math.max(0, channel.deliverAt - Date.now())
      timers.push(window.setTimeout(deliver, delay))
    })
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [messenger])

  useEffect(() => {
    try {
      const persistChannel = (owner: MessengerOwner): MessengerChannelState => {
        const channel = messenger[owner]
        if (owner === 'mother') {
          return channel.phase === 'sending' ? channel : { phase: 'idle', history: channel.history }
        }
        if (channel.phase === 'composing') return { phase: 'idle', history: channel.history }
        if (channel.phase === 'reading') return { phase: 'delivered', history: channel.history, unread: false, owner }
        return channel
      }
      const persisted: MessengerState = { mother: persistChannel('mother'), daughter: persistChannel('daughter') }
      window.localStorage.setItem('wozai-messenger-state-v2', JSON.stringify(persisted))
      window.localStorage.setItem('wozai-messenger-history-v1', JSON.stringify([...messenger.mother.history, ...messenger.daughter.history]))
    } catch {
      // Large local attachments can exceed the browser quota; the active session remains available.
    }
  }, [messenger])

  useEffect(() => {
    try { window.localStorage.setItem('wozai-messenger-drafts-v1', JSON.stringify(savedMessengerDrafts)) } catch { /* keep in memory */ }
  }, [savedMessengerDrafts])

  useEffect(() => {
    try { window.localStorage.setItem('wozai-recipient-data-v1', JSON.stringify(recipientData)) } catch { /* keep in memory */ }
  }, [recipientData])

  useEffect(() => {
    try { window.localStorage.setItem('wozai-seeds-v1', JSON.stringify(seeds)) } catch { /* keep in memory */ }
  }, [seeds])

  useEffect(() => {
    window.sessionStorage.setItem('wozai-current-page-v1', page)
  }, [page])

  useEffect(() => {
    window.localStorage.setItem('wozai-quiet-mode', String(quiet))
  }, [quiet])

  useEffect(() => {
    const syncAcrossTabs = (event: StorageEvent) => {
      if (!event.newValue) return
      if (event.key === 'wozai-messenger-state-v2') {
        const incoming = loadMessengerState()
        setMessenger((current) => {
          if (!activeMessengerOwner) return incoming
          const active = current[activeMessengerOwner]
          if (active.phase !== 'composing' && active.phase !== 'reading') return incoming
          return { ...incoming, [activeMessengerOwner]: { ...active, history: incoming[activeMessengerOwner].history } }
        })
      }
      if (event.key === 'wozai-messenger-drafts-v1') setSavedMessengerDrafts(loadMessengerDrafts())
      if (event.key === 'wozai-recipient-data-v1') setRecipientData(loadRecipientData())
      if (event.key === 'wozai-seeds-v1') setSeeds(loadSeeds())
      if (event.key === 'wozai-quiet-mode') setQuiet(event.newValue === 'true')
    }
    window.addEventListener('storage', syncAcrossTabs)
    return () => window.removeEventListener('storage', syncAcrossTabs)
  }, [activeMessengerOwner])

  useEffect(() => {
    if (!recipientData.preferences.accepted || recipientData.preferences.frequency === '暂停出现' || !recipientData.sessionEndsAt) return
    const delay = Math.max(0, recipientData.sessionEndsAt - Date.now())
    const timer = window.setTimeout(() => {
      setRecipientData((current) => ({ ...current, sessionCompletedAt: current.sessionEndsAt }))
      setPage((current) => recipientPages.includes(current) ? 'recipient' : current)
    }, Math.min(delay, 2_147_000_000))
    return () => window.clearTimeout(timer)
  }, [recipientData.preferences.accepted, recipientData.preferences.frequency, recipientData.sessionEndsAt])

  const closeMessengerSheet = () => {
    const owner = activeMessengerOwner
    if (!owner) return
    setMessenger((current) => {
      const channel = current[owner]
      if (channel.phase === 'composing') return { ...current, [owner]: { phase: 'idle', history: channel.history } }
      if (channel.phase === 'reading') return { ...current, [owner]: { phase: 'delivered', history: channel.history, unread: false, owner } }
      return current
    })
    setActiveMessengerOwner(null)
  }

  const beginCompose = (owner: MessengerOwner, contextSeedId?: number) => {
    const channel = messenger[owner]
    if (channel.phase === 'sending') {
      showToast(owner === 'daughter' ? '信使正在路上，可以先在女儿首页等待' : '上一段内容正在保存到记忆库，请稍后再留一段')
      return false
    }
    if (activeMessengerOwner && activeMessengerOwner !== owner) closeMessengerSheet()
    const saved = savedMessengerDrafts[owner]
    const effectiveContextSeedId = contextSeedId ?? saved?.contextSeedId
    const context: MessengerContext = { owner, returnPage: owner === 'daughter' ? 'recipient' : 'creator', contextSeedId: effectiveContextSeedId }
    const draft = saved?.draft ?? (owner === 'daughter'
      ? { mode: '文字', text: effectiveContextSeedId ? '' : '今天回家路上下雨了，忽然有些想你。' }
      : { mode: '图片', text: '' })
    setMessenger((current) => ({ ...current, [owner]: { phase: 'composing', history: current[owner].history, draft, context } }))
    setActiveMessengerOwner(owner)
    return true
  }

  const go = (next: Page) => {
    const sessionExpired = Boolean(recipientData.preferences.accepted && recipientData.preferences.frequency !== '暂停出现' && recipientData.sessionEndsAt && recipientData.sessionEndsAt <= Date.now())
    const guardedNext = recipientPages.includes(next) && next !== 'recipient' && (!recipientData.preferences.accepted || sessionExpired) ? 'recipient' : next
    if (guardedNext === 'seek' && !selectedRecipientMemory?.seed.delivery.flows.includes('探索')) {
      showToast('当前这段记忆没有开放线索探索')
      setPage('gallery')
      return
    }
    if (guardedNext === 'echo') {
      setRecipientEchoContextId(null)
      if (!beginCompose('daughter')) {
        setPage('recipient')
        return
      }
      setPage('echo')
    } else {
      if (activeMessengerOwner) closeMessengerSheet()
      setPage(guardedNext)
    }
    if (guardedNext !== 'detail') setDetail(null)
    window.setTimeout(() => document.querySelector('.phone-screen')?.scrollTo({ top: 0, behavior: quiet ? 'auto' : 'smooth' }), 0)
  }

  const openDetail = (seed: Seed, from: 'creator' | 'library' = 'library') => {
    if (activeMessengerOwner) closeMessengerSheet()
    setDetail(seed)
    setDetailBack(from)
    setPage('detail')
    window.setTimeout(() => document.querySelector('.phone-screen')?.scrollTo({ top: 0, behavior: quiet ? 'auto' : 'smooth' }), 0)
  }

  const openLibrary = (filter: LibraryFilter = '全部') => {
    setLibraryFilter(filter)
    go('library')
  }

  const previous = useMemo<Record<Page, Page>>(() => ({
    creator: 'creator', capture: 'creator', library: 'creator', detail: 'library', settings: 'creator', recipient: 'creator', gallery: 'recipient', echo: 'recipient', seek: 'recipient', wish: 'recipient', you: 'recipient',
  }), [])

  const saveSeed = (seed: Seed, confirmed: boolean) => {
    setSeeds((current) => [seed, ...current.filter((item) => item.id !== seed.id)])
    showToast(confirmed ? '已确认、逐段授权并保存到记忆库' : '草稿已保存在本机，尚未对女儿开放', 2600)
    go('creator')
  }

  const updateSeed = (seed: Seed) => {
    setSeeds((current) => current.some((item) => item.id === seed.id) ? current.map((item) => item.id === seed.id ? seed : item) : [seed, ...current])
    setDetail(seed)
    showToast('修改已保存，并继续沿用原来的授权范围')
  }

  const openComposer = () => { beginCompose('mother') }

  const openDaughterComposer = (contextSeedId?: number) => {
    if (!beginCompose('daughter', contextSeedId)) return
    setRecipientEchoContextId(contextSeedId ?? null)
    setPage('echo')
    window.setTimeout(() => document.querySelector('.phone-screen')?.scrollTo({ top: 0, behavior: quiet ? 'auto' : 'smooth' }), 0)
  }

  const saveMessengerDraft = (draft: MessengerDraft) => {
    const owner = activeMessengerOwner
    if (!owner || messenger[owner].phase !== 'composing') return
    const channel = messenger[owner]
    setSavedMessengerDrafts((current) => ({ ...current, [owner]: { draft, contextSeedId: channel.context.contextSeedId } }))
    showToast('这一刻已存为草稿，刷新后也会保留')
    closeMessengerSheet()
  }

  const addDaughterEntry = (entry: Omit<DaughterEntry, 'id' | 'createdAt'> & { id?: number }) => {
    const createdAt = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
    setRecipientData((current) => ({ ...current, entries: [{ ...entry, id: entry.id ?? Date.now(), createdAt }, ...current.entries] }))
  }

  const sendWithPigeon = (draft: MessengerDraft) => {
    const owner = activeMessengerOwner
    if (!owner) return
    const channel = messenger[owner]
    if (channel.phase !== 'composing') return
    const { context } = channel
    const { memory, reason } = owner === 'daughter'
      ? matchMemoryForDraft(draft, recipientMemories.filter((memory) => memory.seed.delivery.flows.includes('回应')), context.contextSeedId)
      : { memory: undefined, reason: undefined }
    const exchangeId = Date.now()
    const pending: MessengerExchange = {
      ...draft,
      id: exchangeId,
      sentAt: new Date().toISOString(),
      sender: owner,
      returnPage: context.returnPage,
      sourceSeedId: memory?.seed.id,
      matchReason: reason,
      resultText: owner === 'mother'
        ? '这一刻会原样保存到记忆库，并按妈妈确认的授权留给女儿。'
        : memory?.seed.excerpt ?? '这次没有找到足够相关的旧记录。系统不会猜妈妈会怎么回答，你写下的此刻仍会被好好保存。',
    }
    setSavedMessengerDrafts((current) => { const next = { ...current }; delete next[owner]; return next })
    if (owner === 'daughter') {
      setRecipientPigeonDockDismissed(false)
      addDaughterEntry({
        id: exchangeId,
        exchangeId,
        kind: '我的此刻',
        title: draft.mode === '文字' ? '交给信使的一句话' : draft.mode === '图片' ? '交给信使的一张照片' : '交给信使的一段声音',
        text: draft.text || (draft.mode === '图片' ? `今天放入了「${draft.attachment?.name ?? '一张照片'}」。` : `今天留下了一段 ${draft.attachment?.duration ?? ''} 秒声音。`),
      })
    } else setPigeonDockDismissed(false)
    setMessenger((current) => ({ ...current, [owner]: { phase: 'sending', history: current[owner].history, pending, deliverAt: Date.now() + 2600 } }))
    setActiveMessengerOwner(null)
    setPage(context.returnPage)
    window.setTimeout(() => document.querySelector('.phone-screen')?.scrollTo({ top: 0, behavior: quiet ? 'auto' : 'smooth' }), 0)
  }

  const openPigeonHistory = (owner: MessengerOwner, selectedExchangeId?: number) => {
    const channel = messenger[owner]
    if (owner === 'mother') {
      showToast(channel.phase === 'sending' ? '正在保存到记忆库，无需等待信使回信' : '妈妈端是单向交付，不会生成回信')
      return
    }
    if (channel.phase === 'sending') {
      showToast('信使正在路上，请稍等一下', 2000)
      return
    }
    if (!channel.history.length) return
    if (activeMessengerOwner && activeMessengerOwner !== owner) closeMessengerSheet()
    setMessenger((current) => ({ ...current, [owner]: { phase: 'reading', history: current[owner].history, owner, selectedExchangeId } }))
    setActiveMessengerOwner(owner)
    setToast('')
  }

  const writeAnotherLetter = () => {
    const owner = activeMessengerOwner
    if (!owner) return
    setMessenger((current) => {
      const channel = current[owner]
      if (channel.phase !== 'reading') return current
      const selected = channel.history.find((exchange) => exchange.id === channel.selectedExchangeId) ?? channel.history.at(-1)
      return { ...current, [owner]: {
        phase: 'composing',
        history: channel.history,
        draft: { mode: '文字', text: '' },
        context: { owner, returnPage: owner === 'daughter' ? 'recipient' : 'creator', contextSeedId: selected?.sourceSeedId },
      } }
    })
  }

  const receivePigeonReply = () => {
    const owner = activeMessengerOwner
    if (!owner) return
    setMessenger((current) => {
      const channel = current[owner]
      return channel.phase === 'reading' ? { ...current, [owner]: { phase: 'delivered', history: channel.history, unread: false, owner } } : current
    })
    setActiveMessengerOwner(null)
    showToast('这段旧记录已经收好，之后仍可从往返信件查看', 2400)
  }

  const dismissPigeonDock = (owner: MessengerOwner) => {
    if (owner === 'daughter') setRecipientPigeonDockDismissed(true)
    else setPigeonDockDismissed(true)
    showToast(owner === 'mother'
      ? '已收起，内容仍会在后台保存到记忆库'
      : messenger[owner].phase === 'sending' ? '已收起，信使仍会在后台送达' : '已收起，可从往返信件再次查看')
  }

  const updateRecipientPreferences = (patch: Partial<RecipientPreferences>) => {
    setRecipientData((current) => {
      const preferences = { ...current.preferences, ...patch }
      if (patch.duration && current.preferences.accepted) {
        const now = Date.now()
        return { ...current, preferences, sessionStartedAt: now, sessionEndsAt: now + patch.duration * 60_000, sessionCompletedAt: null }
      }
      return { ...current, preferences }
    })
  }

  const startRecipientExperience = (preferences: RecipientPreferences) => {
    const now = Date.now()
    setRecipientData((current) => ({ ...current, preferences, sessionStartedAt: now, sessionEndsAt: now + preferences.duration * 60_000, sessionCompletedAt: null }))
  }

  const endRecipientSession = () => {
    const now = Date.now()
    setRecipientData((current) => ({ ...current, sessionEndsAt: now, sessionCompletedAt: now }))
  }

  const selectRecipientMemory = (id: number, open = false) => {
    setRecipientData((current) => ({ ...current, selectedMemoryId: id }))
    if (open) go('gallery')
  }

  const respondToRecipientMemory = (id: number) => {
    const memory = recipientMemories.find((item) => item.seed.id === id)
    if (!memory?.seed.delivery.flows.includes('回应')) {
      showToast('这段记忆目前只开放查看，没有开放关联回应')
      return
    }
    setRecipientData((current) => ({ ...current, selectedMemoryId: id }))
    openDaughterComposer(id)
  }

  const markRecipientMemoryViewed = (id: number) => {
    setRecipientData((current) => ({ ...current, viewedMemoryIds: current.viewedMemoryIds.includes(id) ? current.viewedMemoryIds : [...current.viewedMemoryIds, id] }))
  }

  const removeDaughterEntry = (id: number) => {
    const exchangeId = recipientData.entries.find((entry) => entry.id === id)?.exchangeId
    setRecipientData((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }))
    if (exchangeId) {
      setMessenger((current) => {
        const channel = current.daughter
        if (channel.phase === 'sending' && channel.pending.id === exchangeId) return { ...current, daughter: { phase: 'idle', history: channel.history } }
        const history = channel.history.filter((exchange) => exchange.id !== exchangeId)
        if (!history.length && (channel.phase === 'delivered' || channel.phase === 'reading')) return { ...current, daughter: { phase: 'idle', history } }
        return { ...current, daughter: { ...channel, history } }
      })
      showToast('已删除这条个人记录和对应的往返信件')
    }
  }

  const updateMessengerFeedback = (id: number, feedback: NonNullable<MessengerExchange['feedback']>) => {
    const owner = activeMessengerOwner
    if (!owner) return
    const exchange = messenger[owner].history.find((item) => item.id === id)
    setMessenger((current) => {
      const channel = current[owner]
      return { ...current, [owner]: { ...channel, history: channel.history.map((item) => item.id === id ? { ...item, feedback } : item) } }
    })
    if (owner === 'daughter' && feedback === '太重了') updateRecipientPreferences({ intensity: 'L1' })
    if (owner === 'daughter' && feedback === '不要再出现' && exchange?.sourceSeedId) {
      setRecipientData((current) => ({ ...current, hiddenMemoryIds: current.hiddenMemoryIds.includes(exchange.sourceSeedId!) ? current.hiddenMemoryIds : [...current.hiddenMemoryIds, exchange.sourceSeedId!] }))
    }
    showToast(feedback === '很相关' ? '已记下：这次关联很合适' : feedback === '不要再出现' ? '这段记忆已从女儿端隐藏' : feedback === '太重了' ? '已切回轻一点的内容强度' : '已记下你的判断，不会改写原始记录')
  }

  const dismissRecipientWish = (id: number) => {
    setRecipientData((current) => ({ ...current, dismissedWishIds: current.dismissedWishIds.includes(id) ? current.dismissedWishIds : [...current.dismissedWishIds, id] }))
  }

  const updateReflection = (reflection: RelationshipReflection) => {
    setRecipientData((current) => ({ ...current, reflections: current.reflections.map((item) => item.key === reflection.key ? reflection : item) }))
  }

  const openMessengerSource = (id: number) => {
    const owner = activeMessengerOwner ?? 'daughter'
    closeMessengerSheet()
    if (owner === 'daughter') {
      if (recipientMemories.some((memory) => memory.seed.id === id)) selectRecipientMemory(id, true)
      else showToast('这段内容目前不在你的接收范围')
    } else {
      const memory = allMemories.find((item) => item.seed.id === id)
      if (memory) openDetail(memory.seed, 'creator')
    }
  }

  const exportAllRecords = () => {
    const payload = { exportedAt: new Date().toISOString(), creator: '林岚', seeds, memories: allMemories.map(({ seed, date, scene, origin, story }) => ({ seed, date, scene, origin, story })), daughterSettings: recipientData.preferences }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `我在-林岚的全部记录-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('已导出妈妈的记录与授权说明')
  }

  let content: ReactNode
  switch (page) {
    case 'creator': content = <CreatorHome go={go} memories={allMemories} messenger={messenger.mother} onCompose={openComposer} onPigeon={() => openPigeonHistory('mother')} onDismissPigeon={() => dismissPigeonDock('mother')} pigeonDockDismissed={pigeonDockDismissed} onOpen={(seed) => openDetail(seed, 'creator')} onLibrary={openLibrary} />; break
    case 'capture': content = <CapturePage onBack={() => go('creator')} onSave={saveSeed} />; break
    case 'library': content = <LibraryPage seeds={seeds} go={go} onOpen={(seed) => openDetail(seed, 'library')} onCompose={openComposer} initialFilter={libraryFilter} />; break
    case 'detail': content = detail ? <ObjectDetailPage seed={detail} onBack={() => go(detailBack)} onUpdate={updateSeed} /> : <LibraryPage seeds={seeds} go={go} onOpen={(seed) => openDetail(seed, 'library')} onCompose={openComposer} initialFilter={libraryFilter} />; break
    case 'settings': content = <SettingsPage go={go} onCompose={openComposer} onRecipient={() => go('recipient')} memories={allMemories} recipientData={recipientData} onExport={exportAllRecords} quiet={quiet} onQuietChange={setQuiet} />; break
    case 'recipient': content = <RecipientHome go={go} memories={recipientMemories} data={recipientData} onStart={startRecipientExperience} onEndSession={endRecipientSession} onUpdatePreferences={updateRecipientPreferences} onOpenMemory={(id) => selectRecipientMemory(id, true)} messenger={messenger.daughter} onCompose={() => openDaughterComposer()} onPigeon={() => openPigeonHistory('daughter')} onDismissPigeon={() => dismissPigeonDock('daughter')} pigeonDockDismissed={recipientPigeonDockDismissed} />; break
    case 'gallery': content = <GalleryPage onBack={() => go('recipient')} go={go} memories={recipientMemories} selectedMemoryId={recipientData.selectedMemoryId} viewedMemoryIds={recipientData.viewedMemoryIds} soundEnabled={recipientData.preferences.sound} onSelect={(id) => selectRecipientMemory(id)} onViewed={markRecipientMemoryViewed} onRespond={respondToRecipientMemory} />; break
    case 'echo': content = <MessengerHubPage onBack={() => go('recipient')} onCompose={() => openDaughterComposer(recipientEchoContextId ?? undefined)} onOpenHistory={(id) => openPigeonHistory('daughter', id)} history={messenger.daughter.history} />; break
    case 'seek': content = selectedRecipientMemory ? <SeekPage onBack={() => go('gallery')} memory={selectedRecipientMemory} onSaveEntry={addDaughterEntry} /> : <GalleryPage onBack={() => go('recipient')} go={go} memories={[]} selectedMemoryId={0} viewedMemoryIds={[]} soundEnabled={false} onSelect={() => {}} onViewed={() => {}} onRespond={() => {}} />; break
    case 'wish': content = <WishPage onBack={() => go('recipient')} go={go} wish={recipientWish} dismissed={recipientWish ? recipientData.dismissedWishIds.includes(recipientWish.seed.id) : false} onSaveEntry={addDaughterEntry} onDecline={dismissRecipientWish} />; break
    case 'you': content = <YouPage onBack={() => go('recipient')} entries={recipientData.entries} reflections={recipientData.reflections} frequency={recipientData.preferences.frequency} onSaveEntry={addDaughterEntry} onRemoveEntry={removeDaughterEntry} onFrequencyChange={(frequency) => updateRecipientPreferences({ frequency })} onUpdateReflection={updateReflection} onOpenMemory={(id) => selectRecipientMemory(id, true)} hiddenMemoryCount={recipientData.hiddenMemoryIds.length} onRestoreHiddenMemories={() => { setRecipientData((current) => ({ ...current, hiddenMemoryIds: [] })); showToast('已恢复显示，你仍可以再次隐藏任何一段') }} />; break
  }

  return (
    <div className={`app ${quiet ? 'quiet-mode' : ''}`}>
      <PrototypeRail page={page} go={go} />
      <main className="prototype-stage">
        <div className="stage-caption"><span>{['creator', 'capture', 'library', 'detail', 'settings'].includes(page) ? 'MOM · 妈妈创作' : 'DAUGHTER · 女儿体验'}</span><button onClick={() => go(page === 'detail' ? detailBack : previous[page])}>回到上一级</button></div>
        <PhoneFrame quiet={quiet}>
          {content}
          {activeMessengerOwner && activeMessenger?.phase === 'composing' && (
            <MessengerComposeSheet draft={activeMessenger.draft} context={activeMessenger.context} contextTitle={activeMessenger.context.contextSeedId ? allMemories.find((memory) => memory.seed.id === activeMessenger.context.contextSeedId)?.seed.title : undefined} onClose={closeMessengerSheet} onSaveDraft={saveMessengerDraft} onSend={sendWithPigeon} />
          )}
          {activeMessengerOwner === 'daughter' && activeMessenger?.phase === 'reading' && activeMessenger.history.length > 0 && (
            <MessengerThreadSheet
              exchanges={activeMessenger.history}
              memories={activeMessengerOwner === 'daughter' ? recipientMemories : allMemories}
              initialExchangeId={activeMessenger.selectedExchangeId}
              onClose={closeMessengerSheet}
              onWriteAgain={writeAnotherLetter}
              onReceive={receivePigeonReply}
              onOpenMemory={openMessengerSource}
              onFeedback={updateMessengerFeedback}
            />
          )}
        </PhoneFrame>
        <MobileRoleBar page={page} go={go} />
      </main>
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  )
}

export default App
