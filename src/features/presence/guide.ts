/**
 * 引导引擎（Guide）——v2.2
 *
 * 原则：引导者递「开放话头」，不做封闭确认、不问元问题。
 * - 开放话头：像串门的朋友一样抛出一个话题，让临终者自由讲述；
 * - 回答散乱是正常的，归纳是提取器的事，不是引导者的事；
 * - 引导者开场必须披露身份（不是接收者本人，所有内容先给本人过目）。
 *
 * 禁止出现的引导形态（由 assertOpenGuideLine 校验）：
 * - 封闭确认：「这句可以用来回应她吗？」「你是不是…？」
 * - 元问题：「你希望系统怎么回应？」「以什么方式说？」
 */
import { matchScenario, scenarioLine } from './scenarios'
import type { GuideStyle } from './types'

export interface GuideLine {
  style: GuideStyle
  /** 递出去的话头（开放、家常、不沉重） */
  line: string
  /** 开场披露：引导者身份 + 内容先给本人过目 */
  disclosure: string
}

/**
 * 信任开场（v2.3）。分寸感原则：
 * - 不自曝「我是 Loop / 引导者 / 不是阿瑜」——只有 AI 才需要澄清自己不是谁，
 *   那会暴露产品框架与机器感；
 * - 不念条款（「先给你过目，点头才放进去」）——真人只用一句话建立信任；
 * - 授权确认后置：开场只给「你说了算」的承诺，具体确认发生在表达之后。
 */
const DISCLOSURE_TEMPLATE =
  '咱们随便聊聊，你想到啥说啥。这些话怎么用、留给谁，最后都是你说了算。'

/** 元词、封闭问与直接索取式提问特征：引导话头里一旦出现即视为不合格 */
const FORBIDDEN_TOKENS = [
  '系统',
  '回应',
  '应该',
  '希望系统',
  '以什么方式',
  '是否',
  '能不能',
  '要不要',
  '可以吗',
  '行不行',
  '用什么称呼',
  '怎么称呼',
  '怎么回',
  '最不希望',
  '有什么你希望',
  '记得的吗',
]

/** 根据缺口情境生成开放话头（话头与期望标签来自场景库） */
export function composeGuideLine(
  situation: string,
  recipientName: string,
): GuideLine {
  const scenario = matchScenario(situation)
  return {
    style: 'open_chat',
    line: scenarioLine(scenario, recipientName),
    disclosure: DISCLOSURE_TEMPLATE.replaceAll('{recipient}', recipientName),
  }
}

/**
 * 校验引导语是否为合格的开放话头：
 * 不含元词、不是封闭问、不是元问题。
 */
export function assertOpenGuideLine(line: string): { ok: boolean; reason?: string } {
  const hit = FORBIDDEN_TOKENS.find((t) => line.includes(t))
  if (hit) {
    return { ok: false, reason: `引导语含元词/封闭词「${hit}」：${line}` }
  }
  // 以「吗/么/呢/吧？」结尾的疑问仍可能是开放问（如「你会怎么念叨她？」），
  // 但纯是非问（是否/能不能/要不要/可以吗）已在上方拦截。
  return { ok: true }
}
