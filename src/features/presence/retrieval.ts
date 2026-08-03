/**
 * 有源检索：接收者今天的新输入 + 弱 Context，在已确认的分支素材中
 * 检索真实来源。只允许使用本人确认、属于该分支的内容。
 *
 * 对照交互设计文档 §7.2：检索结果必须携带来源锚点（assetId、原话、
 * 匹配理由），只有通用模型知识的回应不算 Loop 回应。
 *
 * 匹配方式：素材标签（如 decision_self_doubt / rain）通过中文字典
 * 与输入文字、自报状态、天气、时段等弱 Context 关联，生成可解释的
 * 匹配理由；Context 只参与生活情境匹配，不输出任何情绪判断。
 */
import type {
  DerivedContext,
  RecipientExpression,
  ResponseSource,
} from './types'

interface MatchableDerived {
  derived: DerivedContext
  score: number
  reasons: string[]
}

/** 主题标签 -> 中文字典（标签是语义键，字典是匹配词） */
const TAG_KEYWORDS: Readonly<Record<string, string[]>> = {
  rain: ['下雨', '雨', '伞', '湿'],
  evening: ['晚上', '今晚', '下班'],
  morning: ['早上', '早晨', '早餐'],
  decision_self_doubt: ['做错', '辞职', '离职', '决定', '怀疑', '后悔', '犹豫', '放弃'],
  daily_care: ['吃饭', '睡觉', '睡一觉', '饿'],
  commute: ['通勤', '地铁', '公交', '路上'],
  health: ['病', '疼', '药', '医院'],
  family: ['家', '女儿', '孩子'],
}

/** 接收者自报状态 -> 主题标签映射（自报，不是戒指推断） */
const SELF_REPORTED_STATE_TAGS: Readonly<Record<string, string[]>> = {
  uncertain_after_major_decision: ['decision_self_doubt'],
  missing_someone: ['family', 'daily_care'],
}

/** 归一化：小写并去掉常见标点，便于中文关键词匹配 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[，。！？、,.!?;；:：""''\s]/g, '')
}

function tagHitsAny(
  tags: readonly string[],
  candidates: readonly string[],
): boolean {
  return candidates.some((c) => tags.includes(c))
}

function textHitsTag(text: string, tag: string): boolean {
  const keywords = TAG_KEYWORDS[tag]
  if (!keywords) return false
  return keywords.some((kw) => text.includes(normalize(kw)))
}

function textBonuses(
  expressionText: string,
  tags: readonly string[],
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0
  const text = normalize(expressionText)
  for (const tag of tags) {
    if (textHitsTag(text, tag)) {
      score += 3
      reasons.push(`输入文字命中主题「${tag}」`)
    }
  }
  return { score, reasons }
}

function contextBonuses(
  expression: RecipientExpression,
  tags: readonly string[],
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0
  const ctx = expression.currentContext

  if (ctx?.weather) {
    const hit =
      tags.includes(ctx.weather) ||
      tagHitsAny(tags, TAG_KEYWORDS[ctx.weather] ?? [])
    if (hit) {
      score += 2
      reasons.push(`当前天气「${ctx.weather}」与素材情境匹配`)
    }
  }
  if (ctx?.timeOfDay) {
    const hit =
      tags.includes(ctx.timeOfDay) ||
      tagHitsAny(tags, TAG_KEYWORDS[ctx.timeOfDay] ?? [])
    if (hit) {
      score += 1
      reasons.push(`当前时段「${ctx.timeOfDay}」与素材情境匹配`)
    }
  }
  if (ctx?.selfReportedState) {
    const stateTags = SELF_REPORTED_STATE_TAGS[ctx.selfReportedState] ?? []
    if (tagHitsAny(tags, stateTags)) {
      score += 2
      reasons.push(`接收者自报状态「${ctx.selfReportedState}」与素材主题匹配`)
    }
  }
  return { score, reasons }
}

/**
 * 对分支内已确认的派生内容打分排序，返回满足来源锚点要求的结果。
 * 只检索 confirmed + approved 的内容；候选/拒绝内容永远不可见。
 */
export function retrieveGroundedSources(
  expression: RecipientExpression,
  confirmedDerived: readonly DerivedContext[],
  limit = 2,
): ResponseSource[] {
  const text = expression.content.text ?? ''
  const matched: MatchableDerived[] = []

  for (const derived of confirmedDerived) {
    if (!derived.quote) continue
    const bonuses =
      expression.mode === 'rehearsal'
        ? textBonuses(text, derived.tags)
        : mergeBonuses(
            textBonuses(text, derived.tags),
            contextBonuses(expression, derived.tags),
          )
    if (bonuses.score > 0) {
      // 预设回应（本人主动为特定情境写好的话）优先于归纳内容
      const presetBonus =
        derived.kind === 'preset_reply' && derived.situation ? 4 : 0
      matched.push({
        derived,
        score: bonuses.score + presetBonus,
        reasons: [
          ...bonuses.reasons,
          ...(presetBonus > 0
            ? [`本人预设的情境回应「${derived.situation}」命中`]
            : []),
        ],
      })
    }
  }

  matched.sort((a, b) => b.score - a.score)
  return matched.slice(0, limit).map(({ derived, reasons }) => ({
    assetId: derived.assetId,
    derivedId: derived.id,
    quote: derived.quote ?? '',
    creatorReviewed: true,
    relationshipMatch: true,
    reason: reasons.join('；') || '与接收者新输入的主题相关',
  }))
}

function mergeBonuses(
  a: { score: number; reasons: string[] },
  b: { score: number; reasons: string[] },
): { score: number; reasons: string[] } {
  return { score: a.score + b.score, reasons: [...a.reasons, ...b.reasons] }
}
