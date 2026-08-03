# W·HERE 原生 ChatGPT 交接文档

> 用途：把这份文档完整复制给 ChatGPT 网页端，让它负责产品策略、功能方案、视觉方向和图片/素材生成规划；再把它的输出交给本地编码执行方落地。

## 0. 复制给 ChatGPT 的开场指令

请把下面这份文档当作 W·HERE 项目的真实上下文。你负责的是产品负责人、交互设计师和视觉总监，不是直接修改代码。

你的输出必须区分：

1. 已经存在并经过验证的功能；
2. 当前正在进行但尚未验证的工作；
3. 你建议新增的产品或视觉方案；
4. 必须由本地编码方执行的具体任务。

不要把建议写成已经完成。不要发明真实用户、真实数据、用户评价、生产指标或已接入的 API。所有新增功能必须保持 W·HERE 的来源、关系授权、接收者控制权和 `pull_only` 边界。

当你设计图片时，请给出可直接交给图片生成工具的完整提示词、尺寸、构图、主体、留白、色彩、文件格式、透明背景要求、使用位置和版权/来源记录要求。不要只给一句“生成一张高级感图片”。

当你设计功能时，请给出：目标产品、用户、用户路径、页面状态、按钮文案、原始/AI/接收者三层内容区分、桌面与 `390x844` 移动端行为、失败/退出/刷新行为、验收标准和不应修改的接口。

## 1. 项目身份

项目名称：**W·HERE / 我在 W·HERE**

核心表达：**一份会回应的记忆。**

产品不是数字复活，不是假装某个人还在聊天，也不是自由人格克隆。产品要让一个人给特定关系留下真实、经过本人确认的内容；未来接收者主动靠近、分享今天的生活，系统从授权来源中给出克制、有来源、明确标记为 AI 的回应。

产品原则：

- 真实来源优先于拟真效果。
- 关系专属优先于公共人格模板。
- 接收者主动权优先于系统主动推送。
- AI 生成必须有来源、可识别、有边界。
- 过去支持今天的生活，不替接收者生活。
- 用户可以跳过、拒绝、隐藏、停止或离开，不被迫完成情绪流程。

## 2. 当前稳定产品结构

这是一个 React/Vite 应用，里面有两个不同的产品体验，共享同一个 W·HERE 底层平台。

### 产品一：Echo Map

- 路由：`#/recipient/echo-map`
- 来源：TASK-016 至 TASK-020。
- 类型：节点式、状态机驱动的 Agent 记忆旅程。
- 流程：身份确认 → 选择强度 → 查看提议 → 接受中性行动 → 打开记忆 → 留下回应 → 生成 postcard → 点亮节点。
- 重点：验证来源、授权、状态转换、退出权和完成完整性。
- 支持：`quiet`、`glimmer`、`deep`、Skip、Stop、Reject、Hide、重试和离开。

它更像有规则和状态机的 Agent Game，适合展示产品的安全边界与仪式化旅程。

### 产品二：Memory Room / 记忆旅程

- 路由：`#/game`
- 来源：TASK-023。
- 类型：五章节叙事型记忆游戏。
- 流程：**看见 → 说 → 寻找 → 去做 → 你在**。
- 重点：让用户浏览记忆、表达今天、探索线索、做一件现实行动，并可留下属于接收者的新章节。
- 没有：分数、连续签到、亲密度、失败惩罚、哀伤恢复指标或强制通关。
- Mei 只作为来源存在，不是一直在线的 NPC。

它更像沉浸式叙事游戏，适合展示 W·HERE 的情绪节奏和视觉世界。

### 共享底层

- Mei → Lin 的合成母女关系。
- Context、OriginalAsset、AI 派生内容、来源标记。
- `pull_only` / `user_opened` 主动进入原则。
- `recipient-authored` 接收者内容隔离。
- InteractionArtifact / postcard。
- 离线、内存态、刷新重置、无网络模型、无真实账号和无真实硬件。

两个产品不是两个代码副本，也不是简单换皮。它们共用数据边界，但有不同的交互目的、状态模型和视觉语言。

## 3. 已经做出来的能力

### 记录者能力

- 录入文字、模拟语音或图片说明。
- 填写主题、重要原因、使用场景、敏感度和情绪权重。
- 生成确定性的 AI 摘要建议。
- 批准、编辑、移除或拒绝 AI 建议。
- 原始素材、AI 派生内容、Context 和策略分层保存。

### 接收者能力

- 主动进入并确认关系。
- 输入今天的文字或照片描述。
- 查看 Original source、AI-generated、Context ID、Asset ID 和生成模式。
- 收藏远方回信。
- 保存只属于接收者的回应，不反写为记录者过去的事实。

### 硬件模拟能力

- owner 绑定、recipient 托付、凭证验证、触发事件和 software fallback。
- touch、tap、gesture、NFC、BLE 等抽象来源。
- 重复事件、错误身份和不允许 trigger reason 会被拒绝。

### 验证状态

```text
20 个 Vitest 测试文件 / 201 项测试通过
Playwright desktop/mobile 共 8 项通过
TypeScript typecheck 通过
Production build 通过
```

稳定提交基线：`7088db4 feat: add Memory Room product line`。

## 4. 当前正在进行但不能假设完成的工作

TASK-024 是一个独立的视觉世界任务，目标是统一 app shell、首页、记录者、接收者、硬件、Echo Map 和 Memory Room 的视觉语言。

它要求：

- 用一个“两个时间相遇”的视觉机制贯穿产品。
- 让接收者和游戏体验更有空间感、触感，而不是卡片堆叠。
- 让记录者和硬件页面保持效率和可读性。
- 保留路由、文案意图、测试、数据边界和交互状态。
- 通过 desktop 与 `390x844` 截图验收。

TASK-024 尚未作为稳定提交完成。你可以提供视觉方向和图片资产方案，但不要声称它已经实现。

## 5. 技术结构

```text
src/app/                  Hash Router、页面入口、产品壳
src/data/                 OfflineDemoService 共享内存集成边界
src/domain/               Context、关系、策略、互动、artifact 合约
src/features/capture/     记录者采集与审核
src/features/agent/       recipient-scoped Agent runtime
src/features/recipient/   接收者核心流程
src/features/journey/     Echo Map 状态机、编排和界面
src/features/game/        Memory Room 五章节游戏
src/features/artifact/    postcard / interaction artifact
src/features/hardware/    硬件绑定、触发和 fallback 模拟
src/adapters/             确定性生成、播放、硬件适配器
tests/e2e/                Playwright desktop/mobile 验收
docs/                     产品、演示、隐私、资产和交接文档
booth/                    展位设计 Base/V2-V8，V8 是当前打印版
videos/                   独立 HyperFrames 宣传视频工程
.loop/                    任务、claim、report、风险和决策记录
```

## 6. 设计与方案的硬约束

任何新功能或视觉方案必须遵守：

- 不改变 `pull_only` 和接收者主动进入原则。
- 不把 AI 生成内容伪装成 Mei 的原话。
- 不把 Lin 今天写的内容写入 Mei 的 Context。
- 不新增网络 API、真实模型、持久化、账号或硬件，除非明确创建新的任务并经过验证。
- 不使用真实个人数据、未登记图片、未授权头像或未记录版权的素材。
- 不把产品做成墓园、纪念馆、奢侈悼念品、泛 wellness 或标准 SaaS 模板。
- 不用分数、连续签到、亲密度或情绪完成率衡量用户关系。
- 必须支持键盘、屏幕阅读器、减少动效和 `390x844` 移动端。
- 必须有 loading、error、empty、retry、back、exit 和 refresh 行为。
- 必须保持原始、AI-organized、recipient-authored 三层可辨识。

## 7. 请原生 ChatGPT 输出什么

每次请优先输出一个可以执行的方案，而不是泛泛的灵感。建议格式：

```text
目标产品：Echo Map 或 Memory Room
方案名称：
要解决的问题：
目标用户和场景：
用户路径：
新增或修改的页面：
每个页面的状态：
原始 / AI-organized / recipient-authored 如何区分：
桌面布局：
390x844 移动布局：
按钮和文案：
失败、退出、刷新和重试：
需要生成的图片或素材：
图片生成提示词：
图片尺寸和格式：
资产文件名与使用位置：
版权/来源登记要求：
允许修改的文件：
禁止修改的文件：
验收标准：
```

## 8. 图片方案交接格式

如果你生成了图片或准备让图片工具生成图片，请同时提供：

```text
asset_id:
asset_name:
purpose:
target_product: Echo Map | Memory Room | shared shell
dimensions:
format: PNG | JPG | WebP | SVG
transparent_background: yes | no
subject:
composition:
palette:
safe_crop:
alt_text:
usage_path:
license_or_source:
do_not_use_as:
```

素材必须能落到具体页面和具体状态，不能只作为装饰。W·HERE 的关键视觉应该帮助用户看见“来源、现在、关系和选择”，而不是遮住产品状态。

## 9. 功能方案交接格式

如果你设计了新功能，请把它变成本地执行方可以审查的任务：

1. 指定是 Echo Map、Memory Room 还是共享平台。
2. 指定用户从哪个路由进入、完成什么动作、何时可以退出。
3. 指定会新增哪些状态和失败路径。
4. 指定哪些内容来自 Mei、哪些由 AI 整理、哪些由 Lin 写下。
5. 指定允许修改的文件范围。
6. 指定 desktop、mobile、键盘、减少动效和测试验收。
7. 明确列出不做什么，避免方案扩大成另一个未授权产品。

## 10. 交给本地编码方时使用的句式

```text
请根据 docs/CHATGPT_NATIVE_HANDOFF.md 和下面这份方案执行。

目标产品：
目标路由：
方案原文：
必须生成或接入的素材：
允许修改的文件：
禁止修改的文件：
验收标准：

请先检查当前代码与方案是否冲突；若冲突，指出冲突并选择最小实现，不要擅自扩展产品范围。完成后运行对应测试、typecheck、build、Playwright 和 git diff --check，并报告实际完成内容与未完成内容。
```

## 11. 给原生 ChatGPT 的重要提醒

请不要把 W·HERE 写成“让逝者复活”或“和逝者自由聊天”的产品。请不要编造用户反馈、市场数据、真实人物素材或生产能力。请把情绪价值建立在用户选择、真实来源、材料、节奏和关系上下文上，而不是让系统替用户完成哀伤。

如果无法判断方案应该属于 Echo Map 还是 Memory Room，先给出两种归属的差异和推荐，不要直接混合两个产品的状态模型。
