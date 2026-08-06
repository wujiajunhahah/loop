/**
 * 多模态能力规范（Modalities）——v2.5
 *
 * 精炼后的采集模态能力矩阵。目的：让「随手说 / 随手拍 / 随手写」都能
 * 低成本进入同一条归纳管线，同时每个模态都有明确的呈现边界。
 *
 * 模态（4 种）：
 *  - audio：语音（随口说、对着照片说两句、唱一段）
 *  - image：照片（老照片翻拍、现状随手拍）
 *  - text：短文字（几句话、一句备忘）
 *  - video：影像（可选，采集成本略高，边界最严）
 *
 * 每种模态定义三件事：
 *  1. capture：怎么采集（操作成本最低的方式）
 *  2. infer：能归纳出什么（对应 extractor 的 DerivedKind）
 *  3. present：离世后怎么呈现（必须使用本人确认过的真实素材）
 *
 * 硬边界（所有模态通用）：
 *  - 不克隆声音、不生成新历史事实、不生成新承诺/愿望（policy 硬约束）；
 *  - 呈现只能基于本人确认过的真实素材（approvedSourceIds）；
 *  - 照片不修改接收者原图（modifyRecipientOriginalPhoto 恒为 false）。
 */
import type { DerivedKind, SourceModality } from './types'

export type Modality = Extract<SourceModality, 'audio' | 'image' | 'text'> | 'video'

export interface ModalityCapability {
  modality: Modality
  /** 采集方式（操作成本从低到高） */
  capture: readonly string[]
  /** 能从这种模态归纳出什么候选 */
  infer: readonly DerivedKind[]
  /** 离世后允许的呈现方式 */
  present: readonly string[]
  /** 该模态特有的边界 */
  boundary: string
}

export const MODALITY_CAPABILITIES: readonly ModalityCapability[] = [
  {
    modality: 'audio',
    capture: ['随口说一段', '对着老照片说两句', '哼一段调子'],
    infer: ['source_quote', 'relationship_fact', 'forbidden_expression', 'preset_reply'],
    present: ['原声片段回放（本人确认过的真实片段）', '短文字回应（引用原话）'],
    boundary: '永不克隆声音；原声只能播放真实片段。',
  },
  {
    modality: 'image',
    capture: ['翻拍一张老照片', '随手拍现在的日常'],
    infer: ['source_quote', 'relationship_fact', 'expression_rule'],
    present: ['照片在本人允许时展示给接收者', '线稿形象回应（基于本人批准的线稿资产）'],
    boundary: '不修改接收者原照片；不用创作者照片做生成素材；线稿必须来自本人批准的资产。',
  },
  {
    modality: 'text',
    capture: ['写几句话', '留一句备忘'],
    infer: ['source_quote', 'address_rule', 'expression_rule'],
    present: ['短文字回应（≤80 字，引用来源锚点）'],
    boundary: '文字回应必须有来源锚点；不生成新承诺/新愿望。',
  },
  {
    modality: 'video',
    capture: ['录一小段日常（可选）'],
    infer: ['source_quote', 'relationship_fact'],
    present: ['本人确认过的真实片段回放'],
    boundary: '采集成本最高，默认不引导；回放仅限本人确认片段。',
  },
]

/** 推荐模态：按场景期望标签与主体域返回采集建议（主模态在前） */
export function suggestModalities(
  expectedTags: readonly string[],
  domain?: string,
): readonly Modality[] {
  const wantsPhoto = expectedTags.some((t) =>
    ['photo', 'ritual', 'travel', 'legacy'].includes(t),
  )
  const wantsVoice =
    expectedTags.some((t) =>
      ['grief', 'memory', 'promise', 'companionship', 'family'].includes(t),
    ) || domain === 'pet'
  const base: Modality[] = []
  if (wantsVoice) base.push('audio')
  if (wantsPhoto) base.push('image')
  if (base.length === 0) base.push('audio', 'text')
  return base
}

/** 校验：一种模态是否在能力矩阵内 */
export function assertModalitySupported(modality: Modality): void {
  if (!MODALITY_CAPABILITIES.some((c) => c.modality === modality)) {
    throw new Error(`Unsupported modality: ${modality}`)
  }
}

/** 获取某模态的能力定义 */
export function capabilityOf(modality: Modality): ModalityCapability {
  const c = MODALITY_CAPABILITIES.find((m) => m.modality === modality)
  if (!c) throw new Error(`Unsupported modality: ${modality}`)
  return c
}
