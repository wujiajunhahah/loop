// @vitest-environment node
/**
 * v2.2 引导引擎与散话归纳测试。
 * 用 mock 数据中的真实散乱回答验证：
 * - 开放话头生成：不出现元问题、封闭确认；
 * - 散话归纳：从一段散乱闲聊中归纳出禁区、原话、重复主题事实；
 * - 所有归纳产物都是 candidate，等待本人确认。
 */
import { describe, expect, it } from 'vitest'
import { RuleBasedExtractor } from './extractor'
import { assertOpenGuideLine, composeGuideLine } from './guide'
import type { SourceAsset } from './types'

const OPEN_CHAT_TRANSCRIPT =
  '（沉默了一会儿）想她小时候……放学回来书包一扔就喊饿。我那会儿在厂里，回来晚了，她就蹲在门口等，跟个小狗似的。……现在她在深圳，忙，我也不老打扰她。上次视频我看她瘦了，问她是不是没好好吃饭，她说吃了吃了，我一看那外卖盒子就知道糊弄我。……她打小就丢三落四，下雨不带伞，我嘴上说又忘了吧，还不是把伞塞给她。天冷了也不知道加衣服，得念叨着才穿。……我这病啊，其实我不怕，我就是怕她以后一个人，遇着事了连个说话的人都没有。她爸嘴笨，不会哄人。（说起前两天看的电视剧）里头妈妈说什么「妈妈永远支持你」，我说这都什么话，太假了，我也不是什么都支持。还有「我在天堂看着你」那种，听着就难受，我可不兴说这个。（笑）你说我这人是不是话多，一聊她就停不下来。'

function openChatAsset(): SourceAsset {
  return {
    id: 'asset-test-open-chat-01',
    ownerId: 'person-lan',
    sourceType: 'guided_answer',
    modality: 'audio',
    capturedAt: '2026-10-18T15:14:56+08:00',
    guidedStyle: 'open_chat',
    guidedTopic: '跟阿姨聊聊阿瑜吧——你平时想她的时候，脑子里都是些什么？',
    transcript: {
      text: OPEN_CHAT_TRANSCRIPT,
      language: 'zh-CN',
      reviewedByCreator: false,
    },
    consent: {
      creatorConsented: true,
      otherParticipantPresent: false,
      modelTrainingAllowed: false,
    },
  }
}

describe('引导引擎：开放话头', () => {
  it('按缺口情境生成开放话头，替换接收者称呼', () => {
    const g = composeGuideLine('天冷加衣的表达边界', '阿瑜')
    expect(g.style).toBe('open_chat')
    expect(g.line).toContain('阿瑜')
    expect(assertOpenGuideLine(g.line).ok).toBe(true)
  })

  it('话头不含元问题（系统/回应/应该/以什么方式）', () => {
    const g = composeGuideLine('陈瑜成为母亲后的育儿建议', '阿瑜')
    expect(g.line).not.toContain('系统')
    expect(g.line).not.toContain('回应')
    expect(g.line).not.toContain('应该')
    expect(g.line).not.toContain('以什么方式')
  })

  it('话头不是封闭确认（是否/能不能/要不要/可以吗）', () => {
    const g = composeGuideLine('天冷加衣的表达边界', '阿瑜')
    for (const token of ['是否', '能不能', '要不要', '可以吗', '行不行']) {
      expect(g.line).not.toContain(token)
    }
  })

  it('信任开场：家常、简短、授权在本人；不自曝「Loop/引导者/不是阿瑜」', () => {
    const g = composeGuideLine('想念', '阿瑜')
    expect(g.disclosure).toContain('随便聊聊')
    expect(g.disclosure).toContain('你说了算')
    // 分寸感：不暴露产品框架，不自曝身份
    expect(g.disclosure).not.toContain('Loop')
    expect(g.disclosure).not.toContain('引导者')
    expect(g.disclosure).not.toContain('不是阿瑜')
    // 简短：一句话建立信任，不念条款
    expect([...g.disclosure].length).toBeLessThan(50)
  })

  it('校验器能识别不合格引导语（旧版元问题被拦截）', () => {
    const badLines = [
      '你最不希望系统怎么回？',
      '这句可以用来回应她吗？',
      '以你和阿瑜的关系来看，你希望系统以什么方式说？',
      '你希望系统以什么方式说？',
    ]
    for (const line of badLines) {
      expect(assertOpenGuideLine(line).ok).toBe(false)
    }
  })

  it('旧版直接提问（v2.0 引导词）全部不合格', () => {
    const legacy = [
      '如果阿瑜发来一句「我可能做错了」，你最不希望系统怎么回？',
      '你平时会用什么称呼？',
      '未来回应是否可以使用「天冷加衣」类生活叮嘱？',
      '如果阿瑜以后有了孩子，有什么你希望她记得的吗？',
    ]
    for (const line of legacy) {
      expect(assertOpenGuideLine(line).ok).toBe(false)
    }
  })
})

describe('散话归纳：开放闲聊 -> 候选', () => {
  it('从散乱回答中归纳出禁区表达候选', async () => {
    const extractor = new RuleBasedExtractor()
    const candidates = await extractor.extract(openChatAsset())
    const forbidden = candidates.filter(
      (c) => c.kind === 'forbidden_expression',
    )
    expect(forbidden.some((c) => c.text.includes('妈妈永远支持你'))).toBe(true)
    expect(forbidden.some((c) => c.text.includes('我在天堂看着你'))).toBe(true)
  })

  it('从散乱回答中切出有内容原话候选（怕她一个人 / 外卖盒子）', async () => {
    const extractor = new RuleBasedExtractor()
    const candidates = await extractor.extract(openChatAsset())
    const quotes = candidates
      .filter((c) => c.kind === 'source_quote')
      .map((c) => c.quote ?? '')
    expect(quotes.some((q) => q.includes('怕她以后一个人'))).toBe(true)
    expect(quotes.some((q) => q.includes('外卖盒子就知道糊弄我'))).toBe(true)
    expect(quotes.some((q) => q.includes('天冷了也不知道加衣服'))).toBe(true)
  })

  it('过滤口语元话语（「你说我这人是不是话多」不入库）', async () => {
    const extractor = new RuleBasedExtractor()
    const candidates = await extractor.extract(openChatAsset())
    const all = candidates.map((c) => `${c.text} ${c.quote ?? ''}`).join(' ')
    expect(all).not.toContain('话多')
    expect(all).not.toContain('停不下来')
  })

  it('同一主题多次出现 -> 归纳出 relationship_fact 候选（童年 3 处）', async () => {
    const extractor = new RuleBasedExtractor()
    const candidates = await extractor.extract(openChatAsset())
    const facts = candidates.filter((c) => c.kind === 'relationship_fact')
    const childhood = facts.find((f) => f.tags.includes('childhood'))
    expect(childhood).toBeDefined()
    // 「小时候」「那会儿」「打小」三句命中童年主题
    expect(childhood?.text).toContain('3 处')
    expect(childhood?.quote).toBeDefined()
  })

  it('归纳产物全部是 candidate，等待本人确认', async () => {
    const extractor = new RuleBasedExtractor()
    const candidates = await extractor.extract(openChatAsset())
    expect(candidates.length).toBeGreaterThan(3)
    expect(candidates.every((c) => c.status === 'candidate')).toBe(true)
    expect(candidates.every((c) => c.approvedByCreator === undefined)).toBe(true)
  })

  it('保留原逐字稿路径（非 open_chat 资产仍按分句切分）', async () => {
    const extractor = new RuleBasedExtractor()
    const asset: SourceAsset = {
      id: 'asset-test-plain-01',
      ownerId: 'person-lan',
      sourceType: 'original_audio',
      modality: 'audio',
      capturedAt: '2026-10-18T10:43:18+08:00',
      transcript: {
        text: '先吃饭，睡一觉，第二天再看。你第二天还觉得不对，再改也来得及。',
        language: 'zh-CN',
        reviewedByCreator: false,
      },
      consent: {
        creatorConsented: true,
        otherParticipantPresent: false,
        modelTrainingAllowed: false,
      },
    }
    const candidates = await extractor.extract(asset)
    expect(candidates.length).toBe(2)
    expect(candidates.every((c) => c.kind === 'source_quote')).toBe(true)
  })
})
