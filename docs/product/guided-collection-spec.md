# 引导式采集规范 v2.5（Guided Collection Spec）

> 采集层的三条底线：**体量要轻**（一次一个话头）、**操作成本要低**（说/拍/写都行，
> 不用组织语言）、**有边界感且优雅**（引导者只递话头，不追问、不评价、可随时停）。
> 所有产出先给本人过目，确认权始终在本人手里。
> v2.5：场景库大幅延展（8 → 30 个「人-人」场景）；多模态能力矩阵化。非人主体
> （宠物/地方/物件等）暂不纳入。

## 1. 双通道采集

| 通道 | 触发 | 产物 | 处理 |
|------|------|------|------|
| 主动上传 | 本人随手拍照片、随口说一段话、写几句话 | `original_photo` / `original_audio` / `original_text` | 按原话分句 → 打标签 → 候选 |
| 引导式提问 | 合理场景（见 §2）触发开放话头 | `guided_answer`（`guidedStyle: open_chat`） | 散话归纳 `induceFromScatter` → 候选 |

两条通道都汇入同一条管线：**候选 → 本人确认 → 模式库**。
引导者永远不说「请你记录一下XXX」——只递话头，让本人自由讲述。

## 2. 场景库（v2.5：30 个「人-人」场景）

每个场景 = 触发情境关键词 + 一条开放话头 + 建议模态 + 期望主题标签。
话头全部必须通过 `assertOpenGuideLine` 校验（拦：元问题/封闭确认/直接索取）。
30 个场景覆盖真实关系里「说得出口与说不出口」的时刻，按主题分组：

| 组 | 场景 id（节选） | 触发情境（缺口） | 开放话头示例 | 模态 |
|----|----------------|-----------------|-------------|------|
| 日常与念叨 | `weather_nagging` `daily_voice` `family_recipes` `night_ritual` | 天冷/今天/做饭/睡前 | 你跟{recipient}念叨最多的是啥事？她老嫌你烦的那种。 | voice |
| 想念与陪伴 | `missing_moments` `worries_left` `her_habits` `what_she_likes` | 想念/放心不下/习惯 | 你平时想她的时候，脑子里都是些什么？ | voice + text |
| 初见与童年 | `first_meet` `her_childhood` `her_birth` | 第一次/小时候/出生 | 她出生那天，你记得什么？ | voice + photo |
| 回忆与见证 | `old_photos` `places_together` `family_photo_wall` | 照片/一起去过/照片墙 | 这张照片是在哪儿拍的？那会儿你们在干嘛？ | photo + voice |
| 故事与传承 | `life_stories` `advice_to_her` `what_i_want_her_to_keep` | 人生/叮嘱/想留下的 | 你这一辈子，最想讲给她的故事是哪一个？ | voice + text |
| 节日与仪式 | `holiday_rituals` | 节日/生日/过年 | 你们家过节日的时候，都是怎么过的？谁张罗，谁最热闹？ | voice + photo |
| 遗憾与未来 | `hangzhou_promise` `future_parent` `wishes_for_her` | 杭州/当了妈/祝愿 | 你们约好过要去的地方，哪个一直没去成？ | voice |
| 没说出口的 | `things_never_said` `apology_left` `gratitude_left` | 没来得及/道歉/感谢 | 有没有一直想说、还没说出口的话？ | voice |
| 重场景 | `farewell_words` `the_last_time` `her_voice` `my_own_story` | 告别/最后一次/声音 | 要是有一天你不在了，你最想让她记住你哪句话？ | voice |

未命中任何场景 → fallback：`聊聊{recipient}吧——你们俩最像的地方是什么？`

**场景使用纪律**：
- 一次只递一个话头；本人讲完即停，不连环追问；
- 本人可以跳过任何场景（跳过=零成本，不产生任何记录）；
- 话头只匹配情境关键词，不主动探测隐私话题；
- 重场景（告别/未说出口/遗憾）只在本人主动触碰时顺势使用，不主动开场。

## 3. 信任开场（v2.3 定稿，v2.5 沿用）

> 「咱们随便聊聊，你想到啥说啥。这些话怎么用、留给谁，最后都是你说了算。」

- 不自曝「我是 Loop / 引导者 / 不是阿瑜」——只有 AI 才需要澄清自己不是谁；
- 不念条款（「先给你过目，点头才放进去」）——真人只用一句话建立信任；
- 授权确认后置：开场只给「你说了算」的承诺，具体确认发生在表达之后。

## 4. 多模态能力矩阵（v2.5 新增）

四种采集模态，每种定义「怎么采集 / 能归纳什么 / 离世后怎么呈现 / 硬边界」：

| 模态 | 采集方式 | 可归纳 | 呈现 | 硬边界 |
|------|---------|--------|------|--------|
| audio | 随口说一段、对着老照片说两句、哼一段 | source_quote / relationship_fact / forbidden_expression / preset_reply | 原声片段回放（确认过的真实片段）、短文字引用 | 永不克隆声音 |
| image | 翻拍老照片、随手拍日常 | source_quote / relationship_fact / expression_rule | 本人允许时展示照片、线稿形象回应 | 不修改接收者原图；线稿须用本人批准资产 |
| text | 写几句话、留一句备忘 | source_quote / address_rule / expression_rule | 短文字回应（≤80 字，带来源锚点） | 不生成新承诺/新愿望 |
| video | 录一小段日常（可选） | source_quote / relationship_fact | 确认过的真实片段回放 | 采集成本最高，默认不引导 |

多模态能力由 `modalities.ts` 提供（`MODALITY_CAPABILITIES` + `suggestModalities`）；
场景库按期望标签自动推荐模态（照片类标签→image，生死/回忆类→audio）。

## 5. 多模态 tag 规范

主题标签是采集→归纳→检索的公共语言。一条素材可以带多个主题标签；
模态本身不单独打 tag（由 `SourceAsset.modality` 承担）。

### 主题标签词典（LEXICON）

| 标签 | 关键词（示例） | 说明 |
|------|---------------|------|
| `weather_care` | 加衣/加衣服/穿/冷 | 生活叮嘱 |
| `daily_care` | 吃饭/睡觉/饿/外卖 | 日常起居 |
| `health` | 病/疼/药/医院 | 健康相关 |
| `family` | 家/女儿/孩子/爸爸/妈妈 | 家人关系 |
| `childhood` | 小时候/那会儿/打小 | 童年回忆 |
| `companionship` | 一个人/说话的人/孤单/陪着 | 陪伴需求 |
| `worry` | 怕/担心/放心不下 | 牵挂 |
| `rain` | 伞/雨/湿 | 具体事件 |
| `evening` | 晚上/今晚 | 时间情境 |
| `white_lie` | 糊弄/报喜/不说/瘦了 | 善意的谎 |
| `intimacy_rule` | 打扰/说破/不主动/不兴 | 相处分寸 |
| `decision_self_doubt` | 决定/怀疑/做错/后悔 | 决策焦虑 |
| `memory` | 记得/回忆/那时候/以前/老照片 | 回忆（v2.4 新增） |
| `promise` | 约定/约好/答应过/说好了 | 约定与承诺（v2.4 新增） |
| `travel` | 杭州/旅游/旅行/去成/出门 | 出行（v2.4 新增） |
| `legacy` | 传下来/传下去/老物件/故事/留给 | 传承（v2.4 新增） |
| `grief` | 离世/去世/走了/离开/遗憾 | 离别与思念（v2.4 新增） |
| `future` | 以后/将来/当妈/要是 | 对未来的想象（v2.4 新增） |
| `ritual` | 节日/纪念日/生日/过年/热闹 | 节日仪式（v2.4 新增） |
| `photo` | 照片/相册/拍/合影 | 影像素材（v2.4 新增） |

### 使用规则

- 同一主题多次出现 → 归纳为 `relationship_fact` 候选（「多次聊到XX相关的事（N 处）」）；
- 命中禁区表达（如「妈妈永远支持你」）→ `forbidden_expression` 候选，确认后写入分支策略硬过滤；
- 口语元话语（「你说我这人是不是话多」）→ 直接过滤，不入库；
- tag 由提取器确定性打标（黑客松阶段）；生产环境由 AI 打标，tag 枚举保持一致。

## 6. 与产品其他部分的衔接

- 引导式资产：`SourceAsset.sourceType: 'guided_answer'`，`guidedStyle: 'open_chat'`，
  `guidedScenarioId` 记录来自哪个场景（便于统计场景覆盖与话头有效性）；
- 主动上传资产：`original_photo` / `original_audio` / `original_text`，走原话分句路径；
- 归纳产物全部是 `candidate`，`confirmDerived(approved=true/false)` 决定去留；
- 禁区的确认会同步写入所属分支的 `policy.textConstraints.blockedPhrases`，
  离世后生成阶段被硬性拦截。
