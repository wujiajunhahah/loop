/**
 * Presence Harness —— 数据模型
 *
 * 对照 docs/product/loop-core-personas-dual-stage-one-day-mock.zh-CN.md
 * §2「产品中实际存在的对象」与 §4 / §7 的 JSON 样本设计。
 *
 * 产品单位不是一条 Memory，而是一个人在世时逐渐建立、可见、可校正的
 * Presence（数字存在）：公共身份层 + 原始生命资产 + 多个关系分支。
 * 本模块只描述数据契约与管线，不绑定任何 UI 或存储实现。
 */

export type EntityId = string

/** 深度可选：用于策略增量更新（patch 只需给出要改的子字段） */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

/** 一个真实的人（购买者/记录者/接收者/执行人共用） */
export interface Person {
  id: EntityId
  displayName: string
  preferredSelfName?: string
  timezone?: string
  lifeStage?: 'living_editable' | 'frozen' | 'recipient'
}

/** 在世编辑态 / 冻结释放态 / 暂停态 */
export type PresenceState = 'living_editable' | 'frozen_released' | 'suspended'

export interface Presence {
  id: EntityId
  ownerId: EntityId
  state: PresenceState
  version: number
  originalAssetCount: number
  reviewedAssetCount: number
  unreviewedAssetCount: number
  /** 已全部完成候选审核的资产（用于维护上面的计数） */
  reviewedAssetIds: EntityId[]
  branchIds: EntityId[]
  /** 本人批准的、可公开的身份描述（公共身份层） */
  publicSelfDescription?: string
  frozenAt?: string
}

export type BranchStatus = 'living_training' | 'released' | 'suspended'

/** 面向某位重要关系的专属分支（Relationship Branch） */
export interface RelationshipBranch {
  id: EntityId
  presenceId: EntityId
  creatorId: EntityId
  recipientId: EntityId
  relationshipType: string
  /** 创作者私下对接收者的称呼，如「阿瑜」 */
  creatorCallsRecipient?: string
  status: BranchStatus
  /** 经本人确认进入本分支的原始资产 */
  approvedSourceIds: EntityId[]
  /** 经本人确认的派生事实 / 表达规则 */
  confirmedDerivedIds: EntityId[]
  /** 本人批准的线稿形象资产（图像回应使用，原照片不被覆盖） */
  approvedCharacterAssetId?: EntityId
  /** 接收者侧呈现偏好；只能由接收者反馈调整，不能改写创作者 Presence */
  recipientPrefs?: {
    textPreference?: string
    imagePreference?: string
  }
  policy: GenerationPolicy
  releasedAt?: string
}

export type SourceModality = 'text' | 'audio' | 'image'

/**
 * 原始证据（Source Asset）。原始音频/照片/文字是 Presence 的证据来源，
 * 任何派生内容都只能作为索引和辅助理解，不能单独代表「Ta 真的说过」。
 */
export interface SourceAsset {
  id: EntityId
  ownerId: EntityId
  sourceType:
    | 'original_audio'
    | 'original_text'
    | 'original_photo'
    | 'guided_answer'
  modality: SourceModality
  capturedAt: string
  uri?: string
  /** 显式文字内容（照片/信件等） */
  text?: string
  transcript?: {
    text: string
    language?: string
    automaticConfidence?: number
    reviewedByCreator: boolean
    reviewedAt?: string
  }
  /** 录音前后对应的 Alloop 弱 Context 时间窗 */
  contextWindow?: {
    from: string
    to: string
    activityLabel?: string
    contextStrength?: 'weak' | 'medium' | 'strong'
    steps?: number
    activeSeconds?: number
    validHeartRateSamples?: number
    medianHeartRateBpm?: number
    validSpo2Samples?: number
    /** 永远不输出情绪/健康结论 */
    emotionInference?: null
    healthConclusion?: null
  }
  consent: {
    creatorConsented: boolean
    otherParticipantPresent: boolean
    modelTrainingAllowed: boolean
  }
  /**
   * 结构化提取提示（生产环境由 AI 提取，黑客松默认提取器按提示生成候选）。
   * 提示本身不是 Presence，必须经过本人确认。
   */
  extractionHints?: DerivedHint[]
  /** 引导式录音对应的关系席位问题 */
  guidedTopic?: string
  guidedReason?: string
  /** v2.2：引导方式（open_chat = 开放话头，散话归纳） */
  guidedStyle?: GuideStyle
  syntheticMock?: boolean
}

export type DerivedKind =
  | 'relationship_fact'
  | 'source_quote'
  | 'expression_rule'
  | 'forbidden_expression'
  | 'life_action'
  | 'address_rule'
  | 'preset_reply'

/**
 * 引导方式（v2.2：开放话头优先）。
 * open_chat：递一个话头让本人自由讲述，回答散乱正常，由 AI 事后归纳。
 */
export type GuideStyle =
  | 'open_chat'
  | 'situation_evoke'
  | 'story_invite'
  | 'ritual_discover'

export interface DerivedHint {
  kind: DerivedKind
  text: string
  /** 锚定的原话（creator 原句），用于生成有来源的回应 */
  quote?: string
  tags: string[]
  reason?: string
  /** preset_reply：本人预设的触发情境（如「阿瑜去了杭州」） */
  situation?: string
}

export type DerivedStatus = 'candidate' | 'confirmed' | 'rejected'

/** 从来源提取、等待或已经本人确认的信息（Derived Context） */
export interface DerivedContext {
  id: EntityId
  assetId: EntityId
  kind: DerivedKind
  text: string
  /** 锚定的创作者原话；只有非空时才能作为回应来源 */
  quote?: string
  tags: string[]
  reason?: string
  status: DerivedStatus
  approvedByCreator?: boolean
  confirmedAt?: string
  /** preset_reply：本人预设的触发情境（如「阿瑜去了杭州」） */
  situation?: string
}

export interface GenerationPolicy {
  branchId: EntityId
  version: number
  approvedByCreator: boolean
  approvedAt?: string
  permissions: {
    retrieveOriginalText: boolean
    playOriginalAudioOnRecipientRequest: boolean
    generateShortTextResponse: boolean
    useApprovedFirstPersonStyle: boolean
    generateSeparateLineArtResponse: boolean
    /** 以下四项必须为 false，策略层硬性约束，不靠 UI 提示 */
    modifyRecipientOriginalPhoto: boolean
    cloneVoice: boolean
    generateNewHistoricalFacts: boolean
    generateNewPromisesOrWishes: boolean
    useForModelTraining: boolean
    shareWithOtherRelationshipBranches: boolean
  }
  textConstraints: {
    maxChineseCharacters: number
    maxFollowUpQuestions: number
    requiredSourceAnchors: number
    blockedPhrases: string[]
  }
  delivery: {
    recipientInitiatedByDefault: boolean
    silentContextualEntryAllowed: boolean
    automaticVoicePlayback: boolean
  }
}

/** 释放：Presence 从在世编辑态转为接收态的控制 */
export interface ReleaseOrder {
  presenceId: EntityId
  executorId: EntityId
  approvedBranchIds: EntityId[]
  /** 未审核草稿、第三方未同意内容不释放 */
  requireAllPendingReviewed: boolean
  releasedAt: string
}

/** 接收者今天发向 Ta 的新内容（Recipient Expression） */
export interface RecipientExpression {
  id: EntityId
  branchId: EntityId
  authorId: EntityId
  mode: 'recipient_initiated' | 'silent_contextual' | 'rehearsal'
  content: {
    type: 'text' | 'photo' | 'audio'
    text?: string
    assetId?: string
  }
  createdAt: string
  currentContext?: {
    selfReportedState?: string
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night'
    weather?: string
    ringActivity?: string
    ringContextStrength?: 'weak' | 'medium' | 'strong'
    headphonesConnected?: boolean
    /** 必须保持 false/缺省；harness 拒绝任何把戒指数据解释为情绪的输入 */
    emotionInferredFromWearable?: false
    preciseLocationStored?: false
  }
}

export interface ResponseSource {
  assetId: EntityId
  derivedId: EntityId
  /** 创作者原话（来源锚点） */
  quote: string
  creatorReviewed: true
  relationshipMatch: true
  reason: string
}

export type ResponseKind =
  | 'grounded_text'
  | 'grounded_quote'
  | 'grounded_image'
  | 'no_source_found'

/** 旧 Context 与新 Context 交织后的输出（Presence Response） */
export interface PresenceResponse {
  id: EntityId
  expressionId: EntityId
  branchId: EntityId
  presenceVersion: number
  policyVersion: number
  kind: ResponseKind
  output?: string
  /** 图像回应描述（真实图像由渲染层生成，这里只描述依据） */
  image?: {
    caption: string
    approvedCharacterAssetId?: EntityId
    recipientOriginalModified: false
    creatorImageModelUsed: false
  }
  sources: ResponseSource[]
  presentation: {
    /** 「我在回应」 */
    label: string
    generationDisclosureVisible: true
    sourceButtonVisible: true
    originalAudioAutoplayed: false
  }
  createdAt: string
}

export interface RehearsalCorrection {
  rejectDerivedIds?: EntityId[]
  addBlockedPhrases?: string[]
  policyPatch?: DeepPartial<GenerationPolicy>
}

/** 预演结果：本人测试未来回应并纠正系统 */
export interface RehearsalResult {
  input: string
  response: PresenceResponse
  corrected: boolean
}

export interface RecipientFeedback {
  fit: 'like_her' | 'partly_like_her' | 'not_like_her'
  issue?: string
  futureTextPreference?: string
  futureImagePreference?: string
}

export type TimelineEntryKind =
  | 'recipient_expression'
  | 'presence_response'
  | 'recipient_voice_note'

/** 离世后属于接收者的关系时间线（Relationship Timeline） */
export interface RelationshipTimelineEntry {
  id: EntityId
  branchId: EntityId
  authorId: EntityId
  kind: TimelineEntryKind
  expressionId?: EntityId
  responseId?: EntityId
  createdAt: string
}
