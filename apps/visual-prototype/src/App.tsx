import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  createPigeonInteraction,
  getLatestHrvStatus,
  getRecentVoiceDiaryChunks,
  markPigeonPresented,
  submitPigeonFeedback,
  type PigeonFeedbackCode,
  type PigeonPresentationMode,
  type HrvLatestStatus,
  type VoiceDiaryChunk,
} from './api/pigeon'
import homeIcon from '../icon/首页未选中.svg'
import homeActiveIcon from '../icon/首页选中.svg'
import memoryIcon from '../icon/记忆未选中.svg'
import memoryActiveIcon from '../icon/记忆选中.svg'
import settingsIcon from '../icon/设置未选中.svg'
import settingsActiveIcon from '../icon/设置选中.svg'
import searchIcon from '../icon/搜索.svg'
import lockIcon from '../icon/锁.svg'

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

type MotherTabPage = Extract<Page, 'creator' | 'library' | 'settings'>

const motherTabItems: Array<{ page: MotherTabPage; label: string; icon: string; activeIcon: string }> = [
  { page: 'creator', label: '首页', icon: homeIcon, activeIcon: homeActiveIcon },
  { page: 'library', label: '记忆', icon: memoryIcon, activeIcon: memoryActiveIcon },
  { page: 'settings', label: '设置', icon: settingsIcon, activeIcon: settingsActiveIcon },
]

function MotherBottomNav({ activePage, go, className = '' }: { activePage: MotherTabPage; go: (page: Page) => void; className?: string }) {
  const navClassName = ['bottom-nav', className].filter(Boolean).join(' ')

  return (
    <nav className={navClassName} aria-label="妈妈创作端导航">
      {motherTabItems.map((item) => {
        const active = activePage === item.page

        return (
          <button key={item.page} type="button" className={active ? 'active' : ''} onClick={() => go(item.page)}>
            <img className="bottom-nav-icon" src={active ? item.activeIcon : item.icon} alt="" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

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
  sourceLabel?: string
  backendClientRequestId?: string
  backendInteractionId?: string
  backendPending?: boolean
  backendPresented?: boolean
  backendDecision?: 'grounded_match' | 'partial_match' | 'no_match' | 'pause'
  presentationMode?: PigeonPresentationMode
  reduceMotion?: boolean
  allowDeeperPrompt?: boolean
  requestedIntensity?: Intensity
  feedback?: '很相关' | '不相关' | '太重了' | '不要再出现' | '这不是她的意思'
}

const backendMemoryToSeedId: Record<string, number> = {
  memory_linlan_20130608_001: 109,
}

const feedbackCodeByLabel: Record<NonNullable<MessengerExchange['feedback']>, PigeonFeedbackCode> = {
  很相关: 'very_relevant',
  不相关: 'not_relevant',
  太重了: 'too_heavy',
  不要再出现: 'suppress_memory',
  这不是她的意思: 'misrepresents_creator',
}

function formatPigeonReply(reply: {
  lead: string
  quote: string | null
  context_note: string | null
  closing: string | null
}) {
  return [reply.lead, reply.quote ? `“${reply.quote}”` : null, reply.context_note, reply.closing]
    .filter(Boolean)
    .join('\n\n')
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

type RecipientIntention = {
  id: string
  kind: '共同约定' | '个人心愿'
  title: string
  note: string
}

const recipientIntentions: RecipientIntention[] = [
  { id: 'dumpling', kind: '共同约定', title: '再一起包一次外婆的馄饨', note: '你们都知道 · 做法留在记忆里' },
  { id: 'spring-flowers', kind: '共同约定', title: '春天一起去看一次花', note: '你们都知道 · 时间由你们决定' },
  { id: 'seaside', kind: '个人心愿', title: '替我去海边坐一个下午', note: '她自己留下 · 到设定时机再出现' },
  { id: 'trophy', kind: '个人心愿', title: '把奖杯送给一个需要鼓励的人', note: '她自己留下 · 可以选择不做' },
]

type RecipientData = {
  preferences: RecipientPreferences
  viewedMemoryIds: number[]
  selectedMemoryId: number
  entries: DaughterEntry[]
  dismissedWishIds: number[]
  hiddenMemoryIds: number[]
  reflections: RelationshipReflection[]
  completedIntentionIds: string[]
}

const defaultRecipientData: RecipientData = {
  preferences: { intensity: 'L1', frequency: '仅主动进入' },
  viewedMemoryIds: [],
  selectedMemoryId: 2,
  entries: [],
  dismissedWishIds: [],
  hiddenMemoryIds: [],
  completedIntentionIds: [],
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
    const preferences: RecipientPreferences = {
      intensity: parsed.preferences?.intensity === 'L2' ? 'L2' : 'L1',
      frequency: parsed.preferences?.frequency === '每周一次' || parsed.preferences?.frequency === '暂停出现' ? parsed.preferences.frequency : '仅主动进入',
    }
    return {
      preferences,
      viewedMemoryIds: Array.isArray(parsed.viewedMemoryIds) ? parsed.viewedMemoryIds : [],
      selectedMemoryId: typeof parsed.selectedMemoryId === 'number' ? parsed.selectedMemoryId : defaultRecipientData.selectedMemoryId,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      dismissedWishIds: Array.isArray(parsed.dismissedWishIds) ? parsed.dismissedWishIds : [],
      hiddenMemoryIds: Array.isArray(parsed.hiddenMemoryIds) ? parsed.hiddenMemoryIds : [],
      completedIntentionIds: Array.isArray(parsed.completedIntentionIds) ? parsed.completedIntentionIds : [],
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

function CameraIcon() {
  return <svg className="recipient-ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.2 7.7h3l1.5-2.2h6.6l1.5 2.2h3a1.7 1.7 0 0 1 1.7 1.7v8.2a1.7 1.7 0 0 1-1.7 1.7H4.2a1.7 1.7 0 0 1-1.7-1.7V9.4a1.7 1.7 0 0 1 1.7-1.7Z" /><circle cx="12" cy="13.4" r="3.5" /></svg>
}

function AlbumIcon() {
  return <svg className="recipient-ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="2.6" /><circle cx="8.2" cy="8.2" r="1.5" /><path d="m5.2 18 4.2-4.6 3 3 2.2-2.2 4.2 3.8" /></svg>
}

function FileIcon() {
  return <svg className="recipient-ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8.4 12.8 5.8-5.8a3 3 0 0 1 4.2 4.2l-7.2 7.2a4.4 4.4 0 0 1-6.2-6.2l7-7" /><path d="m9.3 15.7 6.4-6.4" /></svg>
}

function WaveformIcon() {
  return <svg className="recipient-ui-icon recipient-waveform-icon" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 10v4M8.5 6v12M14 2.5v19M19.5 6v12M25 10v4" /></svg>
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
            <button className={page === 'library' ? 'active' : ''} onClick={() => go('library')}><b>03</b>记忆</button>
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
      <small className="rail-note">L1 · 任意流程两步内退出</small>
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
  const [mode, setMode] = useState<CaptureType>(context.owner === 'daughter' ? '文字' : draft.mode)
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
  const allModeMeta: Array<{ mode: CaptureType; icon: string; label: string }> = [
    { mode: '图片', icon: '▧', label: '放入照片' },
    { mode: '语音', icon: '•••', label: '说一段话' },
    { mode: '文字', icon: '✎', label: '写下一句' },
  ]
  const modeMeta = context.owner === 'daughter' ? allModeMeta.filter((item) => item.mode === '文字') : allModeMeta
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
          <span className="pigeon-art-speech">{context.owner === 'daughter' ? <>把此刻交给我，<br />我会沿着真实记录去找。</> : <>把这一刻交给我，<br />我会原样收进记忆。</>}<i>♥</i></span>
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
      <section className={`pigeon-sheet reply-messenger-sheet presentation-${(exchange.presentationMode ?? 'standard').replace('_', '-')}`} role="dialog" aria-modal="true" aria-labelledby="reply-messenger-title">
        <div className="reply-pigeon-art" aria-hidden="true">
          <span className="pigeon-art-speech">我从妈妈留下的记录里，<br />带回了一段线索。<i>♥</i></span>
          <img src={mascotReturningImage} alt="" />
        </div>
        <button className="pigeon-sheet-close" onClick={onClose} aria-label="关闭">×</button>
        <header className="pigeon-sheet-title">
          <span>⌁</span><h2 id="reply-messenger-title">信鸽带回的信封</h2><span>⌁</span>
        </header>

        <div className="reply-envelope-banner" aria-hidden="true">
          <span className="reply-envelope-icon"><i /></span>
          <span><small>回信已经送到</small><b>打开看看信鸽带回了什么</b></span>
        </div>

        {exchange.presentationMode && <p className="reply-presentation-note">
          {exchange.presentationMode === 'gentle' ? '这次会轻一点、慢一点地呈现' : exchange.presentationMode === 'standard_open' ? '这次可以从原文继续了解更多' : '这次按标准节奏呈现'}
        </p>}

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
          <small>{memory ? `${exchange.sourceLabel ?? memory.origin} · ${exchange.matchReason ?? '系统关联'} · 妈妈已确认` : restricted ? '你写下的此刻仍由你保留；旧记录不会越过当前授权。' : '只保存女儿的此刻，不生成推测内容。'}</small>
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
  const copy = motherDelivery ? '保存到记忆，并留给女儿' : sending ? '正在妈妈留下的内容里寻找' : unread ? '点击查看真实来源' : '之前的往返仍在这里'
  const label = motherDelivery ? '这一刻正在保存到记忆，无需等待回信' : sending ? '信鸽正在寻找旧记录' : unread ? '找到一段旧记录，点击查看' : '查看往返信件'
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
          <button className="text-search" onClick={() => onLibrary('全部')} aria-label="搜索记忆"><img src={searchIcon} alt="" aria-hidden="true" /></button>
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

      <MotherBottomNav activePage="creator" go={go} />
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
    seed: { id: 109, title: '没考好那晚的短信', relation: '给女儿 · 母女', type: '文字', excerpt: '一次没做好，不等于你不行。今晚先睡，明天再说。', source: '旧手机短信原文 · 时间已核对', status: '妈妈已确认', intensity: 'L1', year: '2013', delivery: standardDaughterDelivery },
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
          <h1>记忆</h1>
          <label className="library-search">
            <img className="library-search-icon" src={searchIcon} alt="" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索照片、文字、声音、物件或愿望" aria-label="搜索记忆" />
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
      <MotherBottomNav activePage="library" go={go} className="library-bottom-nav" />
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
        <p className="detail-saved"><span>✓</span> {seed.status === '妈妈已确认' ? '已保存到「记忆」' : '草稿已保存在本机，尚未开放'}</p>
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
  const sessionLabel = recipientData.preferences.intensity

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
        </header>

        <section className="settings-profile-card" aria-label="妈妈的空间">
          <div className="settings-profile-copy">
            <span>妈妈的空间</span>
            <h2>林岚</h2>
            <p>妈妈 · 记录者</p>
            <small><img className="settings-lock" src={lockIcon} alt="" aria-hidden="true" />已授权 {authorizedMemoryCount} 段记忆{authorizedWishCount ? `和 ${authorizedWishCount} 个愿望` : ''}给林崖{draftCount ? ` · ${draftCount} 段仍仅自己可见` : ''}</small>
          </div>
          <div className="settings-profile-halo" aria-hidden="true" />
          <img src={mascotProfileImage} alt="" />
        </section>

        <section className="settings-section">
          <h2>我和家人</h2>
          <div className="settings-list-card">
            {linkRow('我们的记忆空间', '妈妈与女儿', false, onRecipient)}
            {linkRow('她现在能看到什么', authorizedLabel, false, onRecipient)}
            {linkRow('她的接收方式', sessionLabel, false, onRecipient)}
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
      <MotherBottomNav activePage="settings" go={go} className="settings-bottom-nav" />
      <button className="floating-add" onClick={onCompose} aria-label="把这一刻交给信使">＋</button>
    </div>
  )
}

function RecipientHome({
  go,
  memories,
  data,
  onUpdatePreferences,
  onOpenMemory,
  messenger,
  latestHrv,
  latestVoiceDiary,
  onSend,
  onPigeon,
  onIntentionAction,
}: {
  go: (page: Page) => void
  memories: MemoryEntry[]
  data: RecipientData
  onUpdatePreferences: (patch: Partial<RecipientPreferences>) => void
  onOpenMemory: (id: number) => void
  messenger: MessengerChannelState
  latestHrv: HrvLatestStatus | null
  latestVoiceDiary: VoiceDiaryChunk | null
  onSend: (draft: MessengerDraft) => boolean
  onPigeon: () => void
  onIntentionAction: (intention: RecipientIntention, action: 'progress' | 'complete') => void
}) {
  const [showUploadTray, setShowUploadTray] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [voiceError, setVoiceError] = useState('')
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const albumInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderStreamRef = useRef<MediaStream | null>(null)
  const recorderChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<number | null>(null)
  const recordSecondsRef = useRef(0)
  const discardRecordingRef = useRef(false)
  const daughterHistory = messenger.history
  const daughterSending = messenger.phase === 'sending'
  const daughterDelivered = messenger.phase === 'delivered'
  const motherMemories = memories.filter((memory) => memory.seed.type !== '愿景')
  const pendingExchange = messenger.phase === 'sending' ? messenger.pending : undefined
  const exchangeIds = new Set([...daughterHistory.map((exchange) => exchange.id), ...(pendingExchange ? [pendingExchange.id] : [])])
  const clipText = (value: string, fallback: string, limit = 20) => {
    const text = value.trim()
    return text ? `${text.slice(0, limit)}${text.length > limit ? '…' : ''}` : fallback
  }
  const exchangeInteractions = [
    ...(pendingExchange ? [pendingExchange] : []),
    ...daughterHistory.slice().reverse().filter((exchange) => exchange.id !== pendingExchange?.id),
  ].map((exchange) => ({
      id: `exchange-${exchange.id}`,
      mode: exchange.mode,
      title: clipText(exchange.text, exchange.mode === '图片' ? '一张照片' : exchange.mode === '语音' ? '一段声音' : '一句话'),
      copy: exchange.text || (exchange.mode === '图片' ? exchange.attachment?.name ?? '图片内容已保存' : `${exchange.attachment?.duration ?? 0} 秒语音内容已保存`),
      meta: formatMessengerTime(exchange.sentAt),
      attachment: exchange.attachment,
      exchangeId: exchange.id,
      sourceSeedId: exchange.sourceSeedId,
      status: exchange.id === pendingExchange?.id ? '信鸽正在寻找' : exchange.sourceSeedId ? '带回一段记忆' : '已收好',
    }))
  const interactionHistory = [
    ...exchangeInteractions,
    ...data.entries.filter((entry) => !entry.exchangeId || !exchangeIds.has(entry.exchangeId)).map((entry) => ({
      id: `entry-${entry.id}`,
      mode: '文字' as CaptureType,
      title: entry.title,
      copy: entry.text,
      meta: entry.createdAt,
      attachment: undefined as MessengerAttachment | undefined,
      exchangeId: undefined as number | undefined,
      sourceSeedId: entry.sourceSeedId,
      status: '已保存',
    })),
  ].slice(0, 5)
  const pigeonImage = daughterSending ? mascotDeliveringImage : daughterDelivered && messenger.unread ? mascotReturningImage : mascotProfileImage
  const pigeonLabel = daughterSending ? '信鸽正在寻找' : daughterDelivered && messenger.unread ? '信鸽带回了新记忆' : '信鸽在输入框旁等待'

  const sendInteraction = (mode: CaptureType, attachment?: MessengerAttachment) => {
    const draft: MessengerDraft = { mode, text: mode === '文字' ? chatDraft.trim() : '', ...(attachment ? { attachment } : {}) }
    if (!onSend(draft)) return false
    setShowUploadTray(false)
    setUploadError('')
    if (mode === '文字') setChatDraft('')
    return true
  }

  const clearRecordTimer = () => {
    if (recordTimerRef.current !== null) window.clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
  }

  const stopInlineRecording = () => {
    clearRecordTimer()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
    recorderStreamRef.current = null
    setRecording(false)
  }

  const startInlineRecording = async () => {
    if (messenger.phase === 'sending') {
      setVoiceError('信鸽正在路上，请等它回来再说。')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('当前浏览器暂不支持录音，可以切换到文字输入。')
      return
    }
    setShowUploadTray(false)
    setVoiceError('')
    discardRecordingRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorderStreamRef.current = stream
      recorderChunksRef.current = []
      recordSecondsRef.current = 0
      setRecordSeconds(0)
      recorder.ondataavailable = (event) => {
        if (event.data.size) recorderChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        if (discardRecordingRef.current) return
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (!blob.size) {
          setVoiceError('没有录到声音，请再试一次。')
          return
        }
        const reader = new FileReader()
        reader.onload = () => sendInteraction('语音', {
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
        if (recordSecondsRef.current >= 60) stopInlineRecording()
      }, 1000)
    } catch {
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
      recorderStreamRef.current = null
      setVoiceError('没有获得麦克风权限，可以切换到文字输入。')
    }
  }

  useEffect(() => () => {
    discardRecordingRef.current = true
    clearRecordTimer()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const uploadFromDevice = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploadError('')
    try {
      if (file.type.startsWith('image/')) sendInteraction('图片', await prepareImageAttachment(file))
      else if (file.type.startsWith('audio/')) sendInteraction('语音', await prepareAudioAttachment(file))
      else setUploadError('目前支持照片与音频文件。')
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '这个文件暂时无法读取。')
    }
  }

  const sendText = () => {
    if (!chatDraft.trim()) return
    sendInteraction('文字')
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
          <button className="recipient-text-button" onClick={() => onUpdatePreferences({ frequency: '仅主动进入' })}>恢复为仅主动进入</button>
        </main>
      </div>
    )
  }

  return (
    <div className="screen recipient-screen recipient-mobile-home">
      <div className="tide tide-a" /><div className="tide tide-b" />
      <main className="scroll-page recipient-mobile-dashboard">
        <header className="recipient-mobile-header">
          <div><span>我在</span><h1>林岚给你的回忆</h1></div>
          <button className="recipient-exit-preview" onClick={() => go('creator')}><span>×</span>结束预览</button>
        </header>

        <section className="recipient-memory-shelf" aria-labelledby="recipient-memory-title">
          <div className="recipient-mobile-section-heading">
            <div><span>妈妈留下的</span><h2 id="recipient-memory-title">记忆</h2></div>
            <button onClick={() => go('gallery')}>{motherMemories.length} 段</button>
          </div>
          {motherMemories.length ? (
            <>
              <button className="recipient-memory-feature" onClick={() => onOpenMemory(motherMemories[0].seed.id)}>
                <span className="recipient-memory-feature-art"><MemoryArtwork memory={motherMemories[0]} /></span>
                <span className="recipient-memory-feature-copy"><small>{motherMemories[0].kind} · {motherMemories[0].date}</small><b>{motherMemories[0].seed.title}</b><p>{motherMemories[0].seed.excerpt}</p></span>
              </button>
              <div className="recipient-memory-mini-grid">
                {motherMemories.slice(1, 5).map((memory) => (
                  <button key={memory.seed.id} onClick={() => onOpenMemory(memory.seed.id)}>
                    <span><MemoryArtwork memory={memory} /></span>
                    <b>{memory.seed.title}</b>
                    <small>{memory.kind}</small>
                  </button>
                ))}
              </div>
              <button className="recipient-memory-all" onClick={() => go('gallery')}>查看全部记忆 <span>›</span></button>
            </>
          ) : <p className="recipient-memory-empty">暂时没有妈妈授权给你的记忆。</p>}
        </section>

        <section className="recipient-intention-section" aria-labelledby="recipient-intention-title">
          <div className="recipient-mobile-section-heading">
            <div><span>你们之间的</span><h2 id="recipient-intention-title">约定与心愿</h2></div>
            <small>{recipientIntentions.length} 件</small>
          </div>
          <div className="recipient-intention-legend" aria-label="内容类型说明"><span>共同约定 · 你们都知道</span><span>个人心愿 · 她自己留下</span></div>
          <div className="recipient-intention-list">
            {recipientIntentions.map((intention) => {
              const completed = data.completedIntentionIds.includes(intention.id)
              return (
                <article key={intention.id} className={`recipient-intention-card is-${intention.kind === '共同约定' ? 'promise' : 'wish'} ${completed ? 'is-completed' : ''}`}>
                  <header><span>{intention.kind}</span>{completed && <b>✓ 已完成</b>}</header>
                  <h3>{intention.title}</h3>
                  <p>{intention.note}</p>
                  <footer>
                    <button disabled={completed} onClick={() => onIntentionAction(intention, 'progress')}>记下进展</button>
                    <button disabled={completed} onClick={() => onIntentionAction(intention, 'complete')}>{completed ? '已经告诉她' : '告诉她我完成了'}</button>
                  </footer>
                </article>
              )
            })}
          </div>
        </section>

        <section className="recipient-history-section recipient-page-history" aria-labelledby="interaction-history-title">
          <div className="recipient-history-card">
            <div className="recipient-history-pigeon" aria-live="polite">
              <img src={pigeonImage} alt={pigeonLabel} />
              <p><b id="interaction-history-title">{daughterSending ? '正在路上' : daughterDelivered && messenger.unread ? '有新的带回' : '信鸽在这里'}</b></p>
              {daughterHistory.length > 0 && <button onClick={onPigeon}>全部</button>}
            </div>
            <div className={`recipient-voice-diary-status recipient-hrv-status ${latestHrv?.fresh ? 'is-fresh' : 'is-stale'}`} role="status">
              <span><i aria-hidden="true" />Alloop HRV {latestHrv?.has_reading ? '已接收' : '尚未收到'}</span>
              <b>{latestHrv?.value == null ? '--' : `${latestHrv.value.toFixed(0)} ms`}</b>
              <small>{latestHrv?.fresh
                ? `这次回信会采用${latestHrv.state === 'low' ? '轻缓' : latestHrv.state === 'high' ? '开放探索' : '标准'}节奏；仅调节呈现，不判断情绪`
                : latestHrv?.has_reading
                  ? '最近数据已过有效期，本次回信不会使用它'
                  : '请在 Alloop 客户端连接戒指并执行历史数据同步'}</small>
            </div>
            {latestVoiceDiary && (
              <div className="recipient-voice-diary-status" role="status">
                <span><i aria-hidden="true" />Alloop 已接收语音片段</span>
                <b>{(latestVoiceDiary.bytes_received / 1024).toFixed(1)} KB · {latestVoiceDiary.audio_format.toUpperCase()}</b>
                <small>{new Date(latestVoiceDiary.received_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} 收到，等待后续处理</small>
              </div>
            )}
            {interactionHistory.length ? (
              <div className="recipient-history-list">
                {interactionHistory.map((item) => (
                  <button key={item.id} onClick={() => item.exchangeId ? onPigeon() : item.sourceSeedId ? onOpenMemory(item.sourceSeedId) : go('you')}>
                    <span className={`recipient-history-media is-${item.mode === '图片' ? 'image' : item.mode === '语音' ? 'audio' : 'text'}`}>
                      {item.mode === '图片' && item.attachment?.kind === 'image' ? <img src={item.attachment.dataUrl} alt="" /> : item.mode === '语音' ? <i><b /><b /><b /><b /></i> : '“'}
                    </span>
                    <span className="recipient-history-copy"><b>{item.title}</b><small>{item.meta} · {item.status}</small></span>
                    <span className="recipient-history-arrow">›</span>
                  </button>
                ))}
              </div>
            ) : <p className="recipient-history-empty">还没有互动。可以从底部说一句话，或放入一张照片。</p>}
          </div>
        </section>
      </main>

      <section className="recipient-context-dock recipient-global-context-dock" aria-label="围绕全部记忆互动">
        <div className={`recipient-context-reference ${daughterSending ? 'is-delivering' : daughterDelivered && messenger.unread ? 'is-returned' : 'is-idle'}`}>
          <button className="recipient-context-pigeon" disabled={!daughterDelivered || !messenger.unread} onClick={onPigeon} aria-label={daughterDelivered && messenger.unread ? '打开信鸽带回的信封' : pigeonLabel}>
            <img src={pigeonImage} alt="" />
            {daughterDelivered && messenger.unread && <i aria-hidden="true">✉</i>}
          </button>
          <span><small>{recording ? '正在录音' : daughterSending ? '信鸽正在送信' : daughterDelivered && messenger.unread ? '回信到了，点信鸽拆开信封' : '正在聊全部记忆'}</small><b>林岚给你的回忆</b></span>
          {daughterHistory.length > 0 && <button className="recipient-context-record" onClick={onPigeon}>记录</button>}
        </div>
        {showUploadTray && (
          <div className="recipient-context-upload recipient-global-upload" aria-label="上传多模态内容">
            <button onClick={() => cameraInputRef.current?.click()}><CameraIcon /><b>拍摄</b></button>
            <button onClick={() => albumInputRef.current?.click()}><AlbumIcon /><b>相册</b></button>
            <button onClick={() => fileInputRef.current?.click()}><FileIcon /><b>文件</b></button>
            <button onClick={startInlineRecording}><WaveformIcon /><b>录音</b></button>
            {uploadError && <p className="recipient-upload-error" role="alert">{uploadError}</p>}
            <input ref={cameraInputRef} className="recipient-hidden-file" type="file" accept="image/*" capture="environment" onChange={uploadFromDevice} />
            <input ref={albumInputRef} className="recipient-hidden-file" type="file" accept="image/*" onChange={uploadFromDevice} />
            <input ref={fileInputRef} className="recipient-hidden-file" type="file" accept="image/*,audio/*" onChange={uploadFromDevice} />
          </div>
        )}
        {voiceError && <p className="recipient-voice-error" role="alert">{voiceError}</p>}
        <div className="recipient-context-input-row">
          <button className={`recipient-context-plus ${showUploadTray ? 'active' : ''}`} disabled={recording || daughterSending} onClick={() => { setShowUploadTray((value) => !value); setUploadError('') }} aria-label="上传照片、音频或开始录音"><span aria-hidden="true">＋</span></button>
          {recording ? (
            <button className="recipient-global-recording" onClick={stopInlineRecording}><WaveformIcon /><b>录音中 {recordSeconds} 秒 · 点击发送</b></button>
          ) : (
            <textarea value={chatDraft} rows={1} onChange={(event) => setChatDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendText() } }} placeholder="问问全部记忆" aria-label="围绕全部记忆输入内容" />
          )}
          <button className="recipient-context-send" disabled={!chatDraft.trim() || recording || daughterSending} onClick={sendText} aria-label="发送">↑</button>
        </div>
      </section>
    </div>
  )
}

function GalleryPage({
  onBack,
  memories,
  selectedMemoryId,
  viewedMemoryIds,
  onSelect,
  messenger,
  onSend,
  onPigeon,
}: {
  onBack: () => void
  memories: MemoryEntry[]
  selectedMemoryId: number
  viewedMemoryIds: number[]
  onSelect: (id: number) => void
  messenger: MessengerChannelState
  onSend: (draft: MessengerDraft, contextSeedId: number) => boolean
  onPigeon: () => void
}) {
  const [played, setPlayed] = useState(false)
  const [contextDraft, setContextDraft] = useState('')
  const [contextPigeonStage, setContextPigeonStage] = useState<'idle' | 'sent' | 'delivering' | 'returned'>('idle')
  const [showContextUpload, setShowContextUpload] = useState(false)
  const [contextUploadError, setContextUploadError] = useState('')
  const contextCameraRef = useRef<HTMLInputElement | null>(null)
  const contextAlbumRef = useRef<HTMLInputElement | null>(null)
  const contextFileRef = useRef<HTMLInputElement | null>(null)
  const memory = memories.find((item) => item.seed.id === selectedMemoryId) ?? memories.find((item) => item.seed.type !== '愿景') ?? memories[0]

  useEffect(() => {
    setPlayed(false)
    setContextDraft('')
    setShowContextUpload(false)
    setContextUploadError('')
  }, [selectedMemoryId])

  const memoryId = memory?.seed.id
  const contextSending = messenger.phase === 'sending' && messenger.pending.sourceSeedId === memoryId
  const contextHistory = messenger.history.filter((exchange) => exchange.sourceSeedId === memoryId)
  const contextReturned = messenger.phase === 'delivered' && messenger.unread && contextHistory.length > 0
  useEffect(() => {
    if (contextSending) {
      setContextPigeonStage('sent')
      const departureTimer = window.setTimeout(() => setContextPigeonStage('delivering'), 650)
      return () => window.clearTimeout(departureTimer)
    }
    setContextPigeonStage(contextReturned ? 'returned' : 'idle')
  }, [contextSending, contextReturned, memoryId])

  if (!memory) return <div className="screen gallery-screen"><BackHeader title="回忆" onBack={onBack} /><main className="empty-recipient-memory">暂时没有已授权的内容</main></div>

  const contextPigeonImage = contextPigeonStage === 'delivering'
    ? mascotDeliveringImage
    : contextPigeonStage === 'returned'
      ? mascotReturningImage
      : mascotProfileImage
  const contextPigeonStatus = contextPigeonStage === 'sent'
    ? '已收到，信鸽准备出发'
    : contextPigeonStage === 'delivering'
      ? '信鸽正在送信'
      : contextPigeonStage === 'returned'
        ? '回信到了，点信鸽拆开信封'
        : `正在聊这段${memory.kind}`
  const sendContextMessage = () => {
    const text = contextDraft.trim()
    if (!text) return
    if (onSend({ mode: '文字', text }, memory.seed.id)) setContextDraft('')
  }
  const uploadContextMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setContextUploadError('')
    try {
      const attachment = file.type.startsWith('image/')
        ? await prepareImageAttachment(file)
        : file.type.startsWith('audio/')
          ? await prepareAudioAttachment(file)
          : undefined
      if (!attachment) {
        setContextUploadError('目前支持照片与音频文件。')
        return
      }
      const mode: CaptureType = attachment.kind === 'image' ? '图片' : '语音'
      if (onSend({ mode, text: '', attachment }, memory.seed.id)) setShowContextUpload(false)
    } catch (error) {
      setContextUploadError(error instanceof Error ? error.message : '这个文件暂时无法读取。')
    }
  }

  return (
    <div className="screen gallery-screen">
      <BackHeader title="回忆" onBack={onBack} />
      <main className="scroll-page gallery-page recipient-gallery-page">
        <section className="recipient-memory-picker">
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

          {memory.duration && (
            memory.audioSrc ? <div className="recipient-real-audio"><span>妈妈留下的原声 · 需主动播放</span><audio controls src={memory.audioSrc} /></div> : <button className={`audio-control ${played ? 'playing' : ''}`} onClick={() => setPlayed(!played)}><span>{played ? 'Ⅱ' : '▶'}</span><div><b>{played ? '原声播放状态演示中' : '查看原声播放演示'}</b><small>{memory.duration} · 原型暂无实际音频</small></div><i /></button>
          )}
        </article>
      </main>
      <section className="recipient-context-dock" aria-label={`围绕${memory.seed.title}互动`}>
        <div className={`recipient-context-reference is-${contextPigeonStage}`}>
          <button className="recipient-context-pigeon" disabled={!contextReturned} onClick={onPigeon} aria-label={contextReturned ? '打开信鸽带回的信封' : contextPigeonStatus}>
            <img src={contextPigeonImage} alt="" />
            {contextReturned && <i aria-hidden="true">✉</i>}
          </button>
          <span><small>{contextPigeonStatus}</small><b>{memory.seed.title}</b></span>
          {contextHistory.length > 0 && <button className="recipient-context-record" onClick={onPigeon}>记录</button>}
        </div>
        {showContextUpload && (
          <div className="recipient-context-upload" aria-label="上传多模态内容">
            <button onClick={() => contextCameraRef.current?.click()}><CameraIcon /><b>拍摄</b></button>
            <button onClick={() => contextAlbumRef.current?.click()}><AlbumIcon /><b>相册</b></button>
            <button onClick={() => contextFileRef.current?.click()}><FileIcon /><b>文件</b></button>
            <input ref={contextCameraRef} className="recipient-hidden-file" type="file" accept="image/*" capture="environment" onChange={uploadContextMedia} />
            <input ref={contextAlbumRef} className="recipient-hidden-file" type="file" accept="image/*" onChange={uploadContextMedia} />
            <input ref={contextFileRef} className="recipient-hidden-file" type="file" accept="image/*,audio/*" onChange={uploadContextMedia} />
            {contextUploadError && <p role="alert">{contextUploadError}</p>}
          </div>
        )}
        <div className="recipient-context-input-row">
          <button className={`recipient-context-plus ${showContextUpload ? 'active' : ''}`} disabled={contextSending} onClick={() => { setShowContextUpload((value) => !value); setContextUploadError('') }} aria-label="上传照片或音频"><span aria-hidden="true">＋</span></button>
          <textarea value={contextDraft} rows={1} onChange={(event) => setContextDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendContextMessage() } }} placeholder={`问问「${memory.seed.title}」`} aria-label={`围绕${memory.seed.title}输入内容`} />
          <button className="recipient-context-send" disabled={!contextDraft.trim() || contextSending} onClick={sendContextMessage} aria-label="发送">↑</button>
        </div>
      </section>
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
      <BackHeader title="我在，你做" eyebrow="她留下的个人心愿" onBack={onBack} action={<Pill tone="paper">无提醒</Pill>} />
      <main className="scroll-page wish-page">
        <article className="wish-original"><SourceMark>妈妈个人心愿 · 本人确认可行动化</SourceMark><span className="quote-mark">“</span><h2>{wish.seed.excerpt}</h2><p>{wish.seed.source} · 只给女儿</p></article>
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
  const [recipientData, setRecipientData] = useState<RecipientData>(loadRecipientData)
  const [recipientEchoContextId, setRecipientEchoContextId] = useState<number | null>(null)
  const [latestHrv, setLatestHrv] = useState<HrvLatestStatus | null>(null)
  const [latestVoiceDiary, setLatestVoiceDiary] = useState<VoiceDiaryChunk | null>(null)
  const pigeonRequestsInFlight = useRef(new Set<string>())
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
    let active = true
    const refreshDeviceStatus = () => {
      void getRecentVoiceDiaryChunks(1)
        .then((items) => { if (active) setLatestVoiceDiary(items[0] ?? null) })
        .catch(() => { /* 接收状态是辅助信息，不阻断信鸽文字链路。 */ })
      void getLatestHrvStatus()
        .then((status) => { if (active) setLatestHrv(status) })
        .catch(() => { /* HRV 状态不可用时，后端会安全回退到标准节奏。 */ })
    }
    refreshDeviceStatus()
    const timer = window.setInterval(refreshDeviceStatus, 5_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    const timers: number[] = []
    ;(['mother', 'daughter'] as const).forEach((owner) => {
      const channel = messenger[owner]
      if (channel.phase !== 'sending') return
      const pending = channel.pending
      if (owner === 'daughter' && pending.backendPending) {
        const clientRequestId = pending.backendClientRequestId
        if (!clientRequestId || pigeonRequestsInFlight.current.has(clientRequestId)) return
        pigeonRequestsInFlight.current.add(clientRequestId)
        void createPigeonInteraction({
          clientRequestId,
          text: pending.text,
          intensity: pending.requestedIntensity ?? 'L1',
        }).then((response) => {
          const sourceSeedId = response.evidence ? backendMemoryToSeedId[response.evidence.memory_id] : undefined
          setMessenger((current) => {
            const currentChannel = current.daughter
            if (currentChannel.phase !== 'sending' || currentChannel.pending.id !== pending.id) return current
            const completed: MessengerExchange = {
              ...currentChannel.pending,
              sourceSeedId,
              matchReason: response.evidence?.relation_reason,
              sourceLabel: response.evidence?.source_label,
              resultText: formatPigeonReply(response.reply),
              backendInteractionId: response.interaction_id,
              backendPending: false,
              backendDecision: response.decision,
              presentationMode: response.presentation.mode,
              reduceMotion: response.presentation.reduce_motion,
              allowDeeperPrompt: response.presentation.allow_deeper_prompt,
            }
            return { ...current, daughter: { ...currentChannel, pending: completed, deliverAt: Date.now() + 900 } }
          })
        }).catch(() => {
          setMessenger((current) => {
            const currentChannel = current.daughter
            if (currentChannel.phase !== 'sending' || currentChannel.pending.id !== pending.id) return current
            return { ...current, daughter: { ...currentChannel, pending: {
              ...currentChannel.pending,
              backendPending: false,
              backendDecision: 'no_match',
              presentationMode: 'standard',
              resultText: '信使暂时无法连接到记忆服务，因此没有补写任何内容。你写下的此刻仍会保留。',
            }, deliverAt: Date.now() + 900 } }
          })
        }).finally(() => pigeonRequestsInFlight.current.delete(clientRequestId))
        return
      }
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
          showToast('这一刻已收进记忆，并按授权留给林崖。妈妈端无需等待回信。', 3000)
          return
        }
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

  const beginCompose = (owner: MessengerOwner, contextSeedId?: number, draftOverride?: MessengerDraft) => {
    const channel = messenger[owner]
    if (channel.phase === 'sending') {
      showToast(owner === 'daughter' ? '信使正在路上，可以先在女儿首页等待' : '上一段内容正在保存到记忆，请稍后再留一段')
      return false
    }
    if (activeMessengerOwner && activeMessengerOwner !== owner) closeMessengerSheet()
    const saved = draftOverride ? undefined : savedMessengerDrafts[owner]
    const effectiveContextSeedId = contextSeedId ?? saved?.contextSeedId
    const context: MessengerContext = { owner, returnPage: owner === 'daughter' ? 'recipient' : 'creator', contextSeedId: effectiveContextSeedId }
    const draft = draftOverride ?? saved?.draft ?? (owner === 'daughter'
      ? { mode: '文字', text: effectiveContextSeedId ? '' : '今天回家路上下雨了，忽然有些想你。' }
      : { mode: '图片', text: '' })
    setMessenger((current) => ({ ...current, [owner]: { phase: 'composing', history: current[owner].history, draft, context } }))
    setActiveMessengerOwner(owner)
    return true
  }

  const go = (next: Page) => {
    const guardedNext = next
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
    showToast(confirmed ? '已确认、逐段授权并保存到记忆' : '草稿已保存在本机，尚未对女儿开放', 2600)
    go('creator')
  }

  const updateSeed = (seed: Seed) => {
    setSeeds((current) => current.some((item) => item.id === seed.id) ? current.map((item) => item.id === seed.id ? seed : item) : [seed, ...current])
    setDetail(seed)
    showToast('修改已保存，并继续沿用原来的授权范围')
  }

  const openComposer = () => { beginCompose('mother') }

  const openDaughterComposer = (contextSeedId?: number, draft?: MessengerDraft) => {
    if (!beginCompose('daughter', contextSeedId, draft)) return
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
    const exchangeId = Date.now()
    const backendClientRequestId = owner === 'daughter'
      ? `web-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${exchangeId}-${Math.random().toString(16).slice(2)}`}`
      : undefined
    const pending: MessengerExchange = {
      ...draft,
      id: exchangeId,
      sentAt: new Date().toISOString(),
      sender: owner,
      returnPage: context.returnPage,
      backendClientRequestId,
      backendPending: owner === 'daughter',
      requestedIntensity: owner === 'daughter' ? recipientData.preferences.intensity : undefined,
      resultText: owner === 'mother'
        ? '这一刻会原样保存到记忆，并按妈妈确认的授权留给女儿。'
        : '信使正在从妈妈留下并授权的真实记录中寻找关联。',
    }
    setSavedMessengerDrafts((current) => { const next = { ...current }; delete next[owner]; return next })
    if (owner === 'daughter') {
      addDaughterEntry({
        id: exchangeId,
        exchangeId,
        kind: '我的此刻',
        title: draft.mode === '文字' ? '交给信使的一句话' : draft.mode === '图片' ? '交给信使的一张照片' : '交给信使的一段声音',
        text: draft.text || (draft.mode === '图片' ? `今天放入了「${draft.attachment?.name ?? '一张照片'}」。` : `今天留下了一段 ${draft.attachment?.duration ?? ''} 秒声音。`),
      })
    } else setPigeonDockDismissed(false)
    setMessenger((current) => ({ ...current, [owner]: { phase: 'sending', history: current[owner].history, pending, deliverAt: owner === 'daughter' ? Date.now() + 120_000 : Date.now() + 2600 } }))
    setActiveMessengerOwner(null)
    setPage(context.returnPage)
    window.setTimeout(() => document.querySelector('.phone-screen')?.scrollTo({ top: 0, behavior: quiet ? 'auto' : 'smooth' }), 0)
  }

  const sendDaughterInline = (draft: MessengerDraft, contextSeedId?: number) => {
    if (messenger.daughter.phase === 'sending') {
      showToast('信鸽正在路上，请等它回来再继续')
      return false
    }
    const contextMemory = contextSeedId ? recipientMemories.find((item) => item.seed.id === contextSeedId) : undefined
    const exchangeId = Date.now()
    const backendClientRequestId = `web-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${exchangeId}-${Math.random().toString(16).slice(2)}`}`
    const pending: MessengerExchange = {
      ...draft,
      id: exchangeId,
      sentAt: new Date().toISOString(),
      sender: 'daughter',
      returnPage: 'recipient',
      backendClientRequestId,
      backendPending: true,
      requestedIntensity: recipientData.preferences.intensity,
      resultText: '信使正在从妈妈留下并授权的真实记录中寻找关联。',
    }
    addDaughterEntry({
      id: exchangeId,
      exchangeId,
      kind: '我的此刻',
      title: contextMemory ? `关于「${contextMemory.seed.title}」的回应` : draft.mode === '文字' ? '交给信鸽的一句话' : draft.mode === '图片' ? '交给信鸽的一张照片' : '交给信鸽的一段声音',
      text: draft.text || (draft.mode === '图片' ? `今天放入了「${draft.attachment?.name ?? '一张照片'}」。` : `今天留下了一段 ${draft.attachment?.duration ?? ''} 秒声音。`),
    })
    setMessenger((current) => ({
      ...current,
      daughter: { phase: 'sending', history: current.daughter.history, pending, deliverAt: Date.now() + 120_000 },
    }))
    showToast(contextMemory ? `已围绕「${contextMemory.seed.title}」交给信鸽` : '已交给信鸽，互动历史会保留这一次往返')
    return true
  }

  const openPigeonHistory = (owner: MessengerOwner, selectedExchangeId?: number) => {
    const channel = messenger[owner]
    if (owner === 'mother') {
      showToast(channel.phase === 'sending' ? '正在保存到记忆，无需等待信使回信' : '妈妈端是单向交付，不会生成回信')
      return
    }
    if (channel.phase === 'sending') {
      showToast('信使正在路上，请稍等一下', 2000)
      return
    }
    if (!channel.history.length) return
    if (activeMessengerOwner && activeMessengerOwner !== owner) closeMessengerSheet()
    const selected = selectedExchangeId
      ? channel.history.find((exchange) => exchange.id === selectedExchangeId)
      : channel.history.at(-1)
    if (selected?.backendInteractionId && !selected.backendPresented) {
      void markPigeonPresented(selected.backendInteractionId).then(() => {
        setMessenger((current) => {
          const daughter = current.daughter
          return { ...current, daughter: { ...daughter, history: daughter.history.map((item) => item.id === selected.id ? { ...item, backendPresented: true } : item) } }
        })
      }).catch(() => showToast('回信可以正常查看；展示确认暂时没有同步到后端'))
    }
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
    if (owner === 'mother') setPigeonDockDismissed(true)
    showToast(owner === 'mother'
      ? '已收起，内容仍会在后台保存到记忆'
      : messenger[owner].phase === 'sending' ? '已收起，信使仍会在后台送达' : '已收起，可从往返信件再次查看')
  }

  const updateRecipientPreferences = (patch: Partial<RecipientPreferences>) => {
    setRecipientData((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }))
  }

  const selectRecipientMemory = (id: number, open = false) => {
    setRecipientData((current) => ({ ...current, selectedMemoryId: id }))
    if (open) go('gallery')
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
    if (owner === 'daughter' && exchange?.backendInteractionId) {
      void submitPigeonFeedback(exchange.backendInteractionId, feedbackCodeByLabel[feedback])
        .catch(() => showToast('本机已记下；后端暂时没有收到这次反馈'))
    }
    showToast(feedback === '很相关' ? '已记下：这次关联很合适' : feedback === '不要再出现' ? '这段记忆已从女儿端隐藏' : feedback === '太重了' ? '已切回轻一点的内容强度' : '已记下你的判断，不会改写原始记录')
  }

  const dismissRecipientWish = (id: number) => {
    setRecipientData((current) => ({ ...current, dismissedWishIds: current.dismissedWishIds.includes(id) ? current.dismissedWishIds : [...current.dismissedWishIds, id] }))
  }

  const handleIntentionAction = (intention: RecipientIntention, action: 'progress' | 'complete') => {
    if (action === 'complete') {
      setRecipientData((current) => ({
        ...current,
        completedIntentionIds: current.completedIntentionIds.includes(intention.id) ? current.completedIntentionIds : [...current.completedIntentionIds, intention.id],
      }))
      addDaughterEntry({ kind: '轻行动', title: `我完成了「${intention.title}」`, text: `${intention.kind} · 已向她留下完成回应。` })
      showToast('已经告诉她：这件事完成了，也留在互动历史里')
      return
    }
    addDaughterEntry({ kind: '轻行动', title: `关于「${intention.title}」的进展`, text: `${intention.kind} · 我已经开始做这件事。` })
    showToast('这次进展已经记下，也会出现在互动历史里')
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
    case 'recipient': content = <RecipientHome go={go} memories={recipientMemories} data={recipientData} onUpdatePreferences={updateRecipientPreferences} onOpenMemory={(id) => selectRecipientMemory(id, true)} messenger={messenger.daughter} latestHrv={latestHrv} latestVoiceDiary={latestVoiceDiary} onSend={sendDaughterInline} onPigeon={() => openPigeonHistory('daughter')} onIntentionAction={handleIntentionAction} />; break
    case 'gallery': content = <GalleryPage onBack={() => go('recipient')} memories={recipientMemories} selectedMemoryId={recipientData.selectedMemoryId} viewedMemoryIds={recipientData.viewedMemoryIds} onSelect={(id) => selectRecipientMemory(id)} messenger={messenger.daughter} onSend={sendDaughterInline} onPigeon={() => openPigeonHistory('daughter')} />; break
    case 'echo': content = <MessengerHubPage onBack={() => go('recipient')} onCompose={() => openDaughterComposer(recipientEchoContextId ?? undefined)} onOpenHistory={(id) => openPigeonHistory('daughter', id)} history={messenger.daughter.history} />; break
    case 'seek': content = selectedRecipientMemory ? <SeekPage onBack={() => go('gallery')} memory={selectedRecipientMemory} onSaveEntry={addDaughterEntry} /> : <GalleryPage onBack={() => go('recipient')} memories={[]} selectedMemoryId={0} viewedMemoryIds={[]} onSelect={() => {}} messenger={messenger.daughter} onSend={() => false} onPigeon={() => {}} />; break
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
