# Presence Harness — 开发者指南

> **本 README 只讲一件事：`src/features/presence/` 这个 harness 是什么、做了什么、
> 怎么用、数据从哪来、往哪去。** 下一个接手这个模块的开发者，从这里开始。

---

## 0. 一句话

**把「一个人在世时留下的 content」蒸馏成「这个人」，再在 ta 缺席后，用有来源、
受策略约束的方式，陪伴特定的人。**

引擎本质上是一套 harness（2026-08-02 会议共识）：

```
输入：前人留下的 content（想对你说什么、希望你未来怎么做、某些情境注意什么）
输出：给遗族的、有来源、受策略约束的呈现
```

## 1. 背景

### 为什么有这个模块

Loop 是一个以「人终将缺席」为底层命题的实体情感产品（香港 Physical Hackathon）。
产品里有一个无法绕开的问题：**记录者的原始素材（录音/照片/文字）是散的、乱的、
口语化的，不能直接变成给接收者的陪伴内容。** 谁来说话、说什么、怎么说、哪些绝对
不能说，必须由记录者本人在世时一件件确认。

`presence/` 就是这一层：采集 → 归纳 → 本人确认 → 冻结 → 离世后服务。

### 不做什么（边界）

- 不模拟逝者自由说话（不生成新历史事实、新承诺、新愿望）；
- 不克隆声音、不改接收者原照片、不做情绪推断（策略层硬约束，不是 UI 提示）；
- 不强迫接收者「走出来」，不自动推送内容；
- 未经本人确认的内容，任何阶段都不可见、不可用。

## 2. 数据流总览

```
在世阶段（living_editable）
  ingest（收录原始资产，提取候选）
  -> confirm（本人确认资产归属分支 + 确认/拒绝派生内容）
  -> rehearse / applyCorrection（预演未来回应并纠正系统）
  -> freeze（可信执行人确认释放条件，冻结 Presence）

离世后阶段（frozen_released）
  respond（遗族新输入 + 弱 Context -> 有源检索 -> 策略约束生成 -> 呈现）
  recordRecipientFeedback（反馈只调整接收者自己的呈现偏好）
  recordVoiceNote（留声，不伪造已读、不强行回复）
```

### 采集层的闭环（v2.2+ 引入，本模块的核心增量）

```
缺口（情境）
  -> composeGuideLine（开放话头，来自场景库 scenarios.ts）
  -> 引导者递话头 + 信任开场（v2.3，不自曝身份）
  -> 临终者自由讲述（回答散乱是正常的）
  -> induceFromScatter（散话归纳为候选）
  -> 审核门（本人确认/拒绝/改写）
  -> 模式库（patterns）
```

**设计原则：散乱回答不是问题，而是素材。** 引导者不问「是/否」、不问「系统该怎么回」，
只把话头递出去；归纳是提取器的职责；确认权始终在本人手里。

## 3. 版本演进（这个模块做过什么）

| 版本 | 内容 | 位置 |
|------|------|------|
| v1 | harness 主引擎：ingest/confirm/rehearse/freeze/respond | `harness.ts` |
| v2.2 | 引导引擎（开放话头 + 校验器）、散话归纳路径 | `guide.ts`、`extractor.ts` |
| v2.3 | 信任开场重写：不自曝「Loop/引导者」，不念条款，≤50 字 | `guide.ts` |
| v2.4 | 场景库初版 8 个场景、LEXICON 补真实主题词 | `scenarios.ts`、`extractor.ts` |
| v2.5 | **场景库延展到 30 个「人-人」场景**、多模态能力矩阵 | `scenarios.ts`、`modalities.ts` |

> 范围决策：非人主体（宠物/地方/物件等）**暂不纳入**，场景库只做「人-人」关系。
> `types.ts` 里不保留 SubjectKind 之类未用的抽象，保持最小。

## 4. 代码地图

```
src/features/presence/
├── types.ts        数据契约：Person / SourceAsset / DerivedContext /
│                   RelationshipBranch / GenerationPolicy / PresenceResponse …
├── harness.ts      PresenceHarness 主引擎（管线编排 + 策略 + 状态翻转）
├── extractor.ts    RuleBasedExtractor：把资产切成候选。
│                   open_chat 走 induceFromScatter（散话归纳），其余按原话分句。
│                   内含 LEXICON 主题词典、FORBIDDEN_PHRASES 禁区、META_TALK_MARKERS。
├── guide.ts        引导引擎：composeGuideLine + assertOpenGuideLine + 信任开场。
│                   话头实际来自 scenarios.ts，本文件只做组合与校验。
├── scenarios.ts    场景库（v2.5：30 个「人-人」场景 + fallback）。
│                   matchScenario(情境) -> GuideScenario（含话头/模态/期望标签/边界）。
├── modalities.ts   多模态能力矩阵（audio/image/text/video 的采集/归纳/呈现/边界）。
├── policy.ts       策略安全断言（assertPolicySafe，硬约束不可打开）。
├── generation.ts   回应合成：有源检索结果 -> 策略约束 -> 输出。
├── retrieval.ts    有源检索：从已确认派生内容中找可用来源。
├── repository.ts   仓储契约 + 内存实现（可替换持久化）。
├── seed.ts         周岚/陈瑜种子数据：真实走一遍蒸馏管线（集成示例）。
├── index.ts        模块出口
├── guide.test.ts       12 条：引导引擎 + 散话归纳（v2.2 Mock）
├── scenarios.test.ts   14 条：场景库全量话头校验 + 多模态矩阵 + 真实素材打标
└── harness.test.ts     26 条：主引擎不变量
```

## 5. 场景库怎么用、怎么扩

### 匹配

```ts
import { matchScenario, scenarioLine } from './scenarios'

const s = matchScenario('杭州之约没去成')   // -> hangzhou_promise
const line = scenarioLine(s, '阿瑜')        // -> '你们约好过要去的地方，哪个一直没去成？'
```

### 新增场景的铁律

1. **话头必须通过 `assertOpenGuideLine`**——不能含元词（系统/回应/应该/以什么方式）、
   封闭确认（是否/能不能/要不要/可以吗）、直接索取（用什么称呼/最不希望/有什么你希望/记得的吗）。
   `scenarios.test.ts` 会全量兜底，不合格直接红。
2. 每个场景带 `boundary`（什么不做）——重场景（告别/没来得及说的话）只在本人
   主动触碰时触发，默认允许拒绝。
3. `expectedTags` 必须能在 `extractor.ts` 的 LEXICON 里找到对应词（打不上标签的
   场景等于白设计）。
4. 关键词避免与已有场景子串冲突（如「孩子」会误中「毛孩子」，已踩过坑）。

## 6. 多模态能力

| 模态 | 采集 | 可归纳 | 呈现 | 硬边界 |
|------|------|--------|------|--------|
| audio | 随口说、对着照片说、哼一段 | source_quote / relationship_fact / forbidden_expression / preset_reply | 原声片段回放、短文字引用 | **永不克隆声音** |
| image | 翻拍老照片、随手拍 | source_quote / relationship_fact / expression_rule | 本人允许时展示、线稿形象回应 | 不修改接收者原图；线稿须本人批准资产 |
| text | 写几句、留备忘 | source_quote / address_rule / expression_rule | 短文字回应（≤80 字，带来源锚点） | 不生成新承诺/新愿望 |
| video | 录一小段（可选） | source_quote / relationship_fact | 确认过的真实片段回放 | 采集成本最高，默认不引导 |

`modalities.ts` 提供 `MODALITY_CAPABILITIES`（能力矩阵）和 `suggestModalities(期望标签)`
（场景库按期望标签自动推荐采集模态）。

## 7. 测试

```bash
npx vitest run src/features/presence   # 50 条，全部通过
npm run typecheck                       # 干净
```

| 文件 | 条数 | 覆盖 |
|------|------|------|
| `guide.test.ts` | 12 | 开放话头生成、旧版引导词拦截、散话归纳（禁区/原话/重复主题事实）、元话语过滤 |
| `scenarios.test.ts` | 14 | **场景库 30 个话头全量校验**、真实创始人转写打标、多模态矩阵 |
| `harness.test.ts` | 26 | 蒸馏管线不变量（来源锚点、策略硬约束、禁区硬过滤、审核门…） |

## 8. Mock 数据（重要）

### 在哪

`docs/product/loop-creator-data-mock-v2.json`（文件名保留 v2，实际 schemaVersion 已是 **3**）。

### 是什么

周岚（记录者，乳腺癌晚期）/ 陈瑜（女儿，接收者）的全量关系数据 Mock：
`person → setup → assets(7) → derived(16) → patterns(6) → branches(3) → entrustment → release → hardware → timeline → gaps(5)`。

### 怎么用

- **Mock 不是静态展示文件，是 harness 的输入契约参考。** 字段对照 `types.ts`；
- 代码里的真实种子数据在 `seed.ts`（走完整蒸馏管线），Mock JSON 是给产品/文档
  看的全量快照 + 缺口清单；
- `gaps` 数组是**下一步采集的待办**：每个缺口带 `guidedScenarioId`（对应场景库）
  和 `nextGuideLine`（开放话头）。接上 UI 后，这就是「引导引擎驱动对话流」的数据源。

### 更新它的三条规则（务必遵守）

1. **schemaVersion 跟着 harness 版本走**：harness 升级（如 v2.6 加了新场景/新字段），
   先改 Mock 的 description 和字段，再改代码，保持一致；
2. **guided assets 必须带 `guidedScenarioId`**：新增引导式资产时，从 `scenarios.ts`
   的场景库里选一个匹配的场景 id 填上；找不到匹配就用通用话头（fallback）或补场景；
3. **gaps 的 `nextGuideLine` 必须来自场景库**：不要手写新话头，否则会绕过
   `assertOpenGuideLine` 校验（这是刻意设计的护栏）。

### 当前状态（v3，已对齐 v2.5）

- 3 个 guided assets 已关联场景库（`missing_moments` / `hangzhou_promise`，
  名字来历资产无直配场景，属称呼规则类）；
- `gaps` 从 2 条扩到 5 条，全部带 `guidedScenarioId`；
- 真实创始人转写（杭州之约/妈妈离世）已在 `scenarios.test.ts` 中作为打标验证素材，
  尚未落入 Mock 资产库——**下一步可以做 `loadCreatorData(json)` 把真实素材灌进 harness**。

## 9. 使用示例

```ts
import { PresenceHarness, createInMemoryPresenceRepository } from './index'
import { buildLanYuReleasedFixture } from './seed'

const { harness, branch } = await buildLanYuReleasedFixture()

const response = await harness.respond({
  id: 'expression-1',
  branchId: branch.id,
  authorId: 'person-yu',
  mode: 'recipient_initiated',
  content: { type: 'text', text: '我今天提了离职。手一直在抖，我不知道是不是做错了。' },
  createdAt: new Date().toISOString(),
})
// response.output: 有来源的原话回应；response.sources: 来源锚点
```

## 10. 核心不变量（harness.test.ts 覆盖）

1. 未经本人确认的候选永远不可用；未审核草稿不随分支释放。
2. 每条回应必须有 ≥ 1 个来源锚点（`requiredSourceAnchors`），可回溯到原话。
3. 生成只做「精简原话 + 批准的第一人称称呼」，不新增历史事实、承诺或遗愿。
4. 声音克隆、跨关系共享、模型训练、修改接收者原图在**策略层**不可打开。
5. 本人确认的禁区表达成为硬过滤词，命中禁区宁可沉默。
6. 硬件 Context 只参与生活情境与媒介匹配，永远不携带情绪推断。
7. 接收者反馈只调整自己的呈现偏好，不能改写创作者 Presence。
8. 一轮有价值的互动在一轮后结束，不追加追问。
