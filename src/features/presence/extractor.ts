/**
 * 默认提取器（RuleBasedExtractor）。
 *
 * 生产环境由 AI 完成转写、切片与情境摘要；本实现是黑客松的确定性替代。
 *
 * v2.2 新增「散话归纳」路径：对 guidedStyle = open_chat 的引导式资产，
 * 临终者的回答通常是散乱的（回忆、家常、担心混杂），提取器不再逐句照搬，
 * 而是：
 *   1. 分句并过滤口语元话语（「你说我这人是不是话多」这类自指句）；
 *   2. 按主题词典给每句打标签；
 *   3. 命中禁区的句子 -> forbidden_expression 候选；
 *   4. 有内容句子 -> source_quote 候选；
 *   5. 同一主题出现多次 -> 额外归纳 relationship_fact 候选（证明「多次聊到」）。
 *
 * 所有产出都是 candidate，是否进入 Presence 必须由本人确认。
 */
import type { DerivedContext, DerivedHint, GuideStyle, SourceAsset } from './types'

const LEXICON: Readonly<Record<string, string[]>> = {
  decision_self_doubt: ['决定', '怀疑', '做错', '后悔', '辞职', '离职', '犹豫'],
  daily_care: ['吃饭', '睡觉', '睡一觉', '饿', '外卖'],
  rain: ['伞', '雨', '湿'],
  evening: ['晚上', '今晚'],
  health: ['病', '疼', '药', '医院', '重病'],
  family: ['家', '女儿', '孩子', '爸爸', '妈妈', '儿子'],
  childhood: ['小时候', '那会儿', '打小'],
  companionship: ['一个人', '说话的人', '孤单', '陪着', '陪伴'],
  worry: ['怕', '担心', '放心不下'],
  white_lie: ['糊弄', '报喜', '不说', '瘦了'],
  intimacy_rule: ['打扰', '说破', '不主动', '不兴'],
  weather_care: ['加衣', '加衣服', '穿', '冷'],
  // v2.4：真实素材（生死议题/生命记录）需要的主题标签
  memory: ['回忆', '想起', '记得', '点点滴滴', '那时候'],
  grief: ['离世', '去世', '离开', '不在', '遗憾', '思念', '想她', '怀念', '死亡'],
  legacy: ['记录', '传承', '故事', '留给', '托付', '信使', '生命'],
  promise: ['约定', '答应', '说好', '没去成', '约好'],
  travel: ['杭州', '旅游', '旅行', '出行', '照片'],
  photo: ['照片', '拍照', '拍摄', '合影'],
  ritual: ['节日', '纪念日', '生日', '过年', '张罗', '热闹'],
  future: ['以后', '将来', '要是', '未来', '当妈'],
  // v2.5：人-人关系的补充主题（祖辈/兄弟姐妹/声音）
  kin: ['祖辈', '爷爷', '奶奶', '外公', '外婆', '兄弟', '姐妹', '家族'],
}

/** 禁区表达：出现即不能进入任何生成 */
const FORBIDDEN_PHRASES = [
  '妈妈永远支持你',
  '永远支持你',
  '我在天堂看着你',
  '你必须',
  '为了妈妈',
]

/** 口语元话语：散话中自我指涉、无信息量的句子特征 */
const META_TALK_MARKERS = ['你说我这人', '（笑）你说', '话多', '停不下来']

export interface PresenceExtractor {
  extract(asset: SourceAsset): Promise<DerivedContext[]>
}

export class RuleBasedExtractor implements PresenceExtractor {
  async extract(asset: SourceAsset): Promise<DerivedContext[]> {
    if (asset.extractionHints && asset.extractionHints.length > 0) {
      return asset.extractionHints.map((hint, index) =>
        this.toCandidate(asset, hint, index),
      )
    }
    const transcriptText = asset.transcript?.text
    if (!transcriptText) return []

    // v2.2：开放话头产生的散乱回答 -> 归纳路径
    if (asset.guidedStyle === 'open_chat' || asset.sourceType === 'guided_answer') {
      return this.induceFromScatter(asset, transcriptText)
    }

    return splitSentences(transcriptText)
      .filter((sentence) => [...sentence].length >= 8)
      .map((sentence, index) =>
        this.toCandidate(
          asset,
          {
            kind: 'source_quote',
            text: sentence,
            quote: sentence,
            tags: matchTags(sentence),
            reason: '从逐字稿自动切分，等待本人确认。',
          },
          index,
        ),
      )
  }

  /**
   * 散话归纳：回答散乱是正常的，把散话归纳成候选，
   * 而不是要求本人给出「干净」的回答。
   */
  private induceFromScatter(
    asset: SourceAsset,
    transcriptText: string,
  ): DerivedContext[] {
    const sentences = splitSentences(transcriptText)
      .map((s) => s.trim())
      .filter((s) => [...s].length >= 6)
      .filter((s) => !META_TALK_MARKERS.some((m) => s.includes(m)))

    const candidates: DerivedContext[] = []
    let index = 0

    for (const sentence of sentences) {
      // 禁区识别：本人自然提到但明确否定/不想被使用的表达
      const forbidden = FORBIDDEN_PHRASES.find((p) => sentence.includes(p))
      if (forbidden) {
        candidates.push(
          this.toCandidate(
            asset,
            {
              kind: 'forbidden_expression',
              text: forbidden,
              tags: [],
              reason: '从开放闲聊中识别：本人提及并否定的表达，进入禁区',
            },
            index++,
          ),
        )
        continue
      }

      const tags = matchTags(sentence)
      candidates.push(
        this.toCandidate(
          asset,
          {
            kind: 'source_quote',
            text: sentence,
            quote: sentence,
            tags,
            reason: '从开放闲聊中切出的原话，等待本人确认。',
          },
          index++,
        ),
      )
    }

    // 归纳：同一主题出现多次 -> 额外生成 relationship_fact 候选
    const topicCount = new Map<string, number>()
    for (const c of candidates) {
      if (c.kind !== 'source_quote') continue
      for (const tag of c.tags) {
        topicCount.set(tag, (topicCount.get(tag) ?? 0) + 1)
      }
    }
    for (const [tag, count] of topicCount) {
      if (count < 2) continue
      const best = candidates
        .filter((c) => c.kind === 'source_quote' && c.tags.includes(tag))
        .sort((a, b) => (b.quote?.length ?? 0) - (a.quote?.length ?? 0))[0]
      candidates.push(
        this.toCandidate(
          asset,
          {
            kind: 'relationship_fact',
            text: `开放闲聊中多次聊到「${tag}」相关的事（${count} 处）`,
            quote: best?.quote,
            tags: [tag],
            reason: `从散话中归纳：同一主题出现 ${count} 次，可作为关系事实候选`,
          },
          index++,
        ),
      )
    }

    return candidates
  }

  private toCandidate(
    asset: SourceAsset,
    hint: DerivedHint,
    index: number,
  ): DerivedContext {
    return {
      id: `derived-${asset.id}-${index}`,
      assetId: asset.id,
      kind: hint.kind,
      text: hint.text,
      quote: hint.quote,
      tags: hint.tags,
      reason: hint.reason ?? asset.guidedReason,
      status: 'candidate',
    }
  }
}

function matchTags(text: string): string[] {
  const tags: string[] = []
  for (const [tag, keywords] of Object.entries(LEXICON)) {
    if (keywords.some((kw) => text.includes(kw))) tags.push(tag)
  }
  return tags
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^。！？!?]+[。！？!?]?/g)
  return matches ? matches.map((m) => m.trim()).filter(Boolean) : [text]
}

export function guideStyleOf(asset: SourceAsset): GuideStyle | undefined {
  return asset.guidedStyle
}
