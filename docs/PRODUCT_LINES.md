# W·HERE 双产品说明

W·HERE 当前不是两个独立仓库，也不是两套重复源码。它是**一个共享底层平台，加上两个可以分别演示的产品体验**。

## 共享底层平台

两个产品共同使用：

- Mei → Lin 的关系和接收者授权边界；
- OriginalAsset、Context、AI 派生内容和来源标记；
- `pull_only` / `user_opened` 的主动进入原则；
- recipient-authored 内容隔离；
- postcard / InteractionArtifact；
- 离线、内存态、合成数据和无真实模型边界。

共享这些能力不代表两个产品相同。它们的交互模型和用途不同。

## 产品一：Echo Map

| 项目 | 说明 |
| --- | --- |
| 产品名称 | Echo Map Journey |
| 路由 | `#/recipient/echo-map` |
| 来源 | TASK-016 至 TASK-020 |
| 产品形态 | 节点式 Agent 记忆旅程 |
| 核心流程 | 身份确认 → 强度 → 提议 → 中性行动 → 记忆 → 回应 → postcard → 点亮节点 |
| 状态模型 | 显式 journey state machine |
| 用户控制 | Skip、Stop、Reject、Hide、退出、失败重试 |
| 核心价值 | 用可验证状态和来源边界证明“AI 记忆旅程可以有仪式感，但不能伪造完成” |

Echo Map 更接近一个**有规则、有节点、有状态转换的 Agent Game**。它强调旅程完整性、来源验证、操作可撤回和只有用户主动确认后才能继续。

## 产品二：Memory Room

| 项目 | 说明 |
| --- | --- |
| 产品名称 | Memory Room / 记忆旅程 |
| 路由 | `#/game` |
| 来源 | TASK-023 |
| 产品形态 | 五章节叙事型记忆游戏 |
| 核心流程 | 看见 → 说 → 寻找 → 去做 → 你在 |
| 状态模型 | 当前浏览器会话内的 chapter progress |
| 用户控制 | 可跳过文字、返回上一章、随时离开、无正式通关门槛 |
| 核心价值 | 把关系记忆从“观看内容”转化为“观察、表达、探索和回到生活”的连续体验 |

Memory Room 更接近一个**叙事型、沉浸式、无分数的记忆游戏**。它没有分数、连续签到、亲密度或哀伤恢复指标，也不会把 Mei 变成一直在线的 NPC。

## 两个产品的区别

| 维度 | Echo Map | Memory Room |
| --- | --- | --- |
| 主要结构 | 节点和状态机 | 五章节叙事 |
| 主要目标 | 验证来源、状态和授权边界 | 验证情绪节奏和连续可玩体验 |
| 主要动作 | 选择强度、接受行动、生成 postcard、点亮节点 | 看记忆、写今天、找线索、做现实行动、留下新章节 |
| 完成观 | 完整性校验后点亮节点 | 可以离开，不要求正式通关 |
| 视觉语言 | Echo Map、节点、提议和 postcard | 深色 Memory Room、章节轨道、记忆抽屉和线索板 |
| 产品角色 | Agent journey / game system | Narrative memory game |

## 当前状态

- Echo Map 已进入稳定 Demo 路径，并由 desktop/mobile Playwright 覆盖。
- Memory Room 已完成 first playable、组件测试和 desktop/mobile browser smoke。
- 两个产品都运行在同一个 Vite 应用中，但可以通过各自路由独立演示。
- 当前都使用内存状态和合成内容，不应描述成生产服务。
