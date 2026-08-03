// @vitest-environment node
/**
 * v2.4 引导场景库测试。
 * 验证：
 * - 每个场景话头都通过 assertOpenGuideLine（开放、不封闭、不元问）；
 * - 场景覆盖真实素材关键词（离世/杭州/照片/信使/约定）；
 * - 扩展后的 LEXICON 能给真实转写打上主题标签；
 * - 未命中的情境走兜底场景。
 */
import { describe, expect, it } from 'vitest'
import { RuleBasedExtractor } from './extractor'
import { assertOpenGuideLine, composeGuideLine } from './guide'
import {
  FALLBACK_SCENARIO,
  GUIDE_SCENARIOS,
  matchScenario,
  scenarioLine,
} from './scenarios'
import { MODALITY_CAPABILITIES, suggestModalities } from './modalities'
import type { SourceAsset } from './types'

describe('场景库：话头全部合格', () => {
  it('每个场景话头都通过 assertOpenGuideLine', () => {
    for (const s of GUIDE_SCENARIOS) {
      const line = scenarioLine(s, '阿瑜')
      expect(assertOpenGuideLine(line).ok, `${s.id}: ${line}`).toBe(true)
    }
  })

  it('每个场景都有建议模态与期望标签（不空）', () => {
    for (const s of GUIDE_SCENARIOS) {
      expect(s.suggestedModalities.length).toBeGreaterThan(0)
      expect(s.expectedTags.length).toBeGreaterThan(0)
    }
  })

  it('场景库已大幅延展：至少 25 个「人-人」场景', () => {
    expect(GUIDE_SCENARIOS.length).toBeGreaterThanOrEqual(25)
  })

  it('覆盖真实素材的核心缺口情境', () => {
    const cases: Array<[string, string]> = [
      ['天冷加衣的表达边界', 'weather_nagging'],
      ['想念的时刻', 'missing_moments'],
      ['纪念日怎么过', 'holiday_rituals'],
      ['翻到老照片', 'old_photos'],
      ['杭州之约没去成', 'hangzhou_promise'],
      ['阿瑜当了妈以后', 'future_parent'],
      ['想讲给她的人生故事', 'life_stories'],
      ['告别与嘱托', 'farewell_words'],
    ]
    for (const [situation, expectedId] of cases) {
      expect(matchScenario(situation).id, situation).toBe(expectedId)
    }
  })

  it('未命中的情境走兜底场景', () => {
    const s = matchScenario('完全无关的情境描述')
    expect(s.id).toBe(FALLBACK_SCENARIO.id)
    const line = scenarioLine(s, '阿瑜')
    expect(assertOpenGuideLine(line).ok).toBe(true)
  })

  it('新增「人-人」场景都能命中（道歉/感恩/她的声音/最后一次/出生）', () => {
    const cases: Array<[string, string]> = [
      ['一直欠她一句道歉', 'apology_left'],
      ['想谢谢她这些年', 'gratitude_left'],
      ['她的声音和口头禅', 'her_voice'],
      ['最后一次见面', 'the_last_time'],
      ['她出生那天', 'her_birth'],
    ]
    for (const [situation, expectedId] of cases) {
      expect(matchScenario(situation).id, situation).toBe(expectedId)
    }
  })

  it('composeGuideLine 返回的场景话头与场景库一致', () => {
    const g = composeGuideLine('杭州之约', '阿瑜')
    expect(g.line).toBe(scenarioLine(matchScenario('杭州之约'), '阿瑜'))
  })
})

describe('多模态能力矩阵', () => {
  it('四类模态都有采集/归纳/呈现/边界定义', () => {
    expect(MODALITY_CAPABILITIES.map((m) => m.modality)).toEqual([
      'audio',
      'image',
      'text',
      'video',
    ])
    for (const c of MODALITY_CAPABILITIES) {
      expect(c.capture.length).toBeGreaterThan(0)
      expect(c.infer.length).toBeGreaterThan(0)
      expect(c.present.length).toBeGreaterThan(0)
      expect(c.boundary.length).toBeGreaterThan(0)
    }
  })

  it('suggestModalities：照片类标签 -> 推荐 image；生死/回忆类 -> 推荐 audio', () => {
    expect(suggestModalities(['photo', 'travel'])).toContain('image')
    expect(suggestModalities(['grief', 'memory'])).toContain('audio')
    const fallback = suggestModalities(['daily_care'])
    expect(fallback.length).toBeGreaterThan(0)
  })
})

describe('扩展 LEXICON：真实素材能打上标签', () => {
  const REAL_TRANSCRIPT = `我曾经经历真实的经历过一个事件，就是我妈妈的离世。我妈妈离世的时候，我刚刚从大学毕业，所以那个时候其实我也很懵懂，也没来得及留下很多。所以导致到当下的时候，我再回忆起他的时候，我只有寥寥的几张照片。
当我痛苦的时候，我在家里崩溃的大哭的时候，我只能捧着我妈妈的照片对她说，妈妈，我好想你。但是其实那一刻我非常的希望他能够给我一个回应。但是很遗憾的是，我没有。
我记得在生前的时候，我们约定想去杭州旅游。但是那个时候他的身体已经不允许出行了。这个时候，我希望我能够去杭州旅游的时候，把我还在杭州拍摄的照片发给这个信使，然后这个信使带着我妈妈的回忆来告诉我，宝，我收到了。
当下我们每个人都有可能或无意中或有意的会接触死亡这个命题。这个命题是不可逃避的。当我在重病的时候，可能是我已经非常明确的知道我的身体出现了状况的时候，我会把这个命题想的更加的明确一些。
因为我希望把我的人生，把我的故事能够记录下来，给到我，传承给我爱的人。让这件事情能够变成，当有一天我不在了，这个发生在我身上的遗憾不会再发生。`

  function realAsset(): SourceAsset {
    return {
      id: 'asset-real-founder-02',
      ownerId: 'person-founder',
      sourceType: 'guided_answer',
      modality: 'audio',
      capturedAt: '2026-08-02T14:00:00+08:00',
      guidedStyle: 'open_chat',
      guidedTopic: '跟你聊聊你发起这个项目的初衷',
      transcript: { text: REAL_TRANSCRIPT, language: 'zh-CN', reviewedByCreator: false },
      consent: { creatorConsented: true, otherParticipantPresent: false, modelTrainingAllowed: false },
    }
  }

  it('真实转写切出有主题标签的 source_quote', async () => {
    const extractor = new RuleBasedExtractor()
    const candidates = await extractor.extract(realAsset())
    const quotes = candidates.filter((c) => c.kind === 'source_quote')
    const tagged = quotes.filter((c) => c.tags.length > 0)
    // 关键主题至少被命中一次：离世(grief)、杭州(travel)、照片(photo)、约定(promise)、信使(legacy)
    const allTags = new Set(quotes.flatMap((c) => c.tags))
    for (const tag of ['grief', 'travel', 'photo', 'promise', 'legacy', 'memory']) {
      expect(allTags.has(tag), `应命中 ${tag}`).toBe(true)
    }
    expect(tagged.length).toBeGreaterThan(0)
  })

  it('杭州之约重复出现 -> 归纳出 travel 主题的 relationship_fact', async () => {
    const extractor = new RuleBasedExtractor()
    const candidates = await extractor.extract(realAsset())
    const travelFact = candidates.find(
      (c) => c.kind === 'relationship_fact' && c.tags.includes('travel'),
    )
    expect(travelFact).toBeDefined()
    expect(travelFact?.text).toContain('处')
  })

  it('所有归纳产物仍是 candidate，等待本人确认', async () => {
    const extractor = new RuleBasedExtractor()
    const candidates = await extractor.extract(realAsset())
    expect(candidates.every((c) => c.status === 'candidate')).toBe(true)
  })
})
