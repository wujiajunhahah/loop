/**
 * 生成层：只在本人批准的素材和约束范围内合成回应。
 *
 * 对照交互设计文档 §7.2 / §11 断言 5/6/7/12：
 * - 每条回应都必须携带来源锚点，没有来源就不生成；
 * - 生成只做「精简原话 + 批准的第一人称称呼」，不新增历史事实、承诺或遗愿；
 * - 不追加追问，一轮可以结束；
 * - 禁区表达在生成前硬过滤，命中则宁可不回。
 */
import type {
  DerivedContext,
  GenerationPolicy,
  Presence,
  PresenceResponse,
  RecipientExpression,
  RelationshipBranch,
  ResponseSource,
} from './types'
import { blockedPhrasesIn } from './policy'

export interface GenerationInput {
  branch: RelationshipBranch
  presence: Presence
  expression: RecipientExpression
  sources: ResponseSource[]
  confirmedDerived: readonly DerivedContext[]
  now: string
  newId: (prefix: string) => string
}

export function composeResponse(input: GenerationInput): PresenceResponse {
  const { branch, presence, expression, sources, confirmedDerived, now, newId } =
    input
  const policy = branch.policy
  const base = {
    id: newId('response'),
    expressionId: expression.id,
    branchId: branch.id,
    presenceVersion: presence.version,
    policyVersion: policy.version,
    presentation: {
      label: '我在回应',
      generationDisclosureVisible: true as const,
      sourceButtonVisible: true as const,
      originalAudioAutoplayed: false as const,
    },
    createdAt: now,
  }

  // 禁区硬过滤：命中禁区的来源不能进入生成
  const usable = sources.filter(
    (s) =>
      blockedPhrasesIn(s.quote, policy.textConstraints.blockedPhrases).length ===
      0,
  )
  if (usable.length === 0) {
    return {
      ...base,
      kind: 'no_source_found',
      sources: [],
      output: '没有找到 Ta 留下过的相关内容。',
    }
  }

  // 照片输入 → 独立图像回应（需本人批准形象 + 图像生成权限）
  if (
    expression.content.type === 'photo' &&
    policy.permissions.generateSeparateLineArtResponse &&
    branch.approvedCharacterAssetId
  ) {
    const best = usable[0]
    const caption = fitWithin(best.quote, policy.textConstraints.maxChineseCharacters)
      .out
    return {
      ...base,
      kind: 'grounded_image',
      output: caption,
      image: {
        caption,
        approvedCharacterAssetId: branch.approvedCharacterAssetId,
        recipientOriginalModified: false,
        creatorImageModelUsed: false,
      },
      sources: usable.slice(0, policy.textConstraints.requiredSourceAnchors),
    }
  }

  // 文字（或图像回退文字）→ 有来源的短回应
  const best = usable[0]
  const { out: trimmedQuote, trimmed } = fitWithin(
    best.quote,
    policy.textConstraints.maxChineseCharacters,
  )
  const withAddress = applyApprovedAddress(
    trimmedQuote,
    branch,
    policy,
    confirmedDerived,
  )
  const blocked = blockedPhrasesIn(
    withAddress,
    policy.textConstraints.blockedPhrases,
  )
  if (blocked.length > 0) {
    return {
      ...base,
      kind: 'no_source_found',
      sources: [],
      output: '没有找到 Ta 留下过的相关内容。',
    }
  }

  const canAdapt = policy.permissions.generateShortTextResponse
  return {
    ...base,
    kind: canAdapt && trimmed ? 'grounded_text' : 'grounded_quote',
    output: withAddress,
    sources: usable.slice(0, policy.textConstraints.requiredSourceAnchors),
  }
}

/** 把文本切分为句子（保留句末标点） */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^。！？!?]+[。！？!?]?/g)
  return matches ? matches.map((m) => m.trim()).filter(Boolean) : [text]
}

/**
 * 把文本压到最大字数：优先去掉开头句子，保留结尾的行动核心；
 * 仍超长则按字符硬截断。返回是否发生了精简。
 */
export function fitWithin(
  text: string,
  max: number,
): { out: string; trimmed: boolean } {
  const chars = [...text]
  if (chars.length <= max) return { out: text, trimmed: false }
  let sentences = splitSentences(text)
  while (sentences.length > 1 && [...sentences.join('')].length > max) {
    sentences = sentences.slice(1)
  }
  let out = sentences.join('')
  if ([...out].length > max) {
    out = [...out].slice(0, max).join('')
  }
  return { out, trimmed: out !== text }
}

/** 仅在本人确认过称呼规则、且输出尚未包含称呼时，前缀私密称呼 */
function applyApprovedAddress(
  text: string,
  branch: RelationshipBranch,
  policy: GenerationPolicy,
  confirmedDerived: readonly DerivedContext[],
): string {
  if (!policy.permissions.useApprovedFirstPersonStyle) return text
  const addressRuleConfirmed = confirmedDerived.some(
    (d) => d.kind === 'address_rule' && d.status === 'confirmed',
  )
  const name = branch.creatorCallsRecipient
  if (!addressRuleConfirmed || !name || text.includes(name)) return text
  return `${name}，${text}`
}
