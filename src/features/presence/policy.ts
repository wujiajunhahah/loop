/**
 * 策略层：Generation Policy 的硬性约束与硬过滤。
 *
 * 对照交互设计文档 §4.6 与 §11 断言 8：
 * 「未授权的声音克隆、跨关系共享和模型训练必须在策略层不可用，
 *  而不是只靠 UI 提示。」
 */
import type { DerivedContext, GenerationPolicy } from './types'
import { PresenceError } from './errors'

/** 生产策略时永远不允许被打开的权限（策略层硬约束） */
const HARD_FORBIDDEN_PERMISSIONS = [
  'modifyRecipientOriginalPhoto',
  'cloneVoice',
  'generateNewHistoricalFacts',
  'generateNewPromisesOrWishes',
  'useForModelTraining',
  'shareWithOtherRelationshipBranches',
] as const

export type HardForbiddenPermission = (typeof HARD_FORBIDDEN_PERMISSIONS)[number]

export function assertPolicySafe(policy: GenerationPolicy): void {
  for (const key of HARD_FORBIDDEN_PERMISSIONS) {
    if (policy.permissions[key]) {
      throw new PresenceError(
        'POLICY_UNSAFE',
        `Permission "${key}" must stay false at the policy layer.`,
      )
    }
  }
  if (policy.textConstraints.requiredSourceAnchors < 1) {
    throw new PresenceError(
      'POLICY_UNSAFE',
      'requiredSourceAnchors must be at least 1: every response needs a source anchor.',
    )
  }
}

/** 判断文本是否命中禁区；命中返回命中的短语列表，否则返回空数组 */
export function blockedPhrasesIn(
  text: string,
  blockedPhrases: readonly string[],
): string[] {
  return blockedPhrases.filter((phrase) => phrase.length > 0 && text.includes(phrase))
}

/** 候选来源是否携带禁区表达；携带则不能进入生成 */
export function isSourceBlocked(
  derived: DerivedContext,
  policy: GenerationPolicy,
): boolean {
  const quote = derived.quote ?? ''
  return blockedPhrasesIn(quote, policy.textConstraints.blockedPhrases).length > 0
}
