# Loop Software MVP V2

Loop 是一个面向香港 Physical Hackathon 的实体情感产品原型。它保存真实内容，按关系和授权边界组织 Context，让特定接收者主动打开有来源的互动。它不是通用录音工具，也不是模拟逝者自由说话的聊天机器人。

当前版本是无需后端、无需模型 API、无需网络和无需真实硬件的离线 Software Demo。核心路径是：

```text
Context 录入（文字 / 模拟语音 / 图片描述）
  -> 关系 Agent
  -> 所有者审核内容和生成策略
  -> 接收者主动进入
  -> 来源可追溯的原始 / AI 内容
  -> 一次互动生成远行明信片
  -> 接收者回应或关闭
```

## 产品边界

- 录入保存 `Context`、`OriginalAsset`、已审核 `DerivedContent` 和完整 provenance。
- V2 关系明确区分 subject、recorder、recipient 和 buyer。
- Agent 只接受接收者主动进入后的有效 Interaction，并执行关系、接收者、来源、主题、策略和 owner review 检查。
- 原始内容显示为 `Original source`，受限整理显示为 `AI-generated`；没有自由聊天、人格模拟、新事实或重大决定生成。
- 默认触发策略为 `pull_only` / `user_opened`。硬件模拟器是可选且可替换的入口，不是核心 Demo 前置条件。
- 接收者回应会标记为 recipient-authored，不能成为记录者 Agent 的授权素材。
- 所有业务状态在内存中，刷新页面会重置；本地确定性 adapter 不代表生产模型、认证或持久化方案。

## 快速运行

环境要求：Node.js 20+、npm 10+。

```bash
npm install
npm run dev
```

Hash router 页面通常为 `http://localhost:5173/#/`。

## 完整 Demo

默认 Demo 数据使用 Mei 与 Lin 的母女关系：

| 身份 | ID | 角色 |
| --- | --- | --- |
| Mei | `person-mei` | subject、recorder、buyer |
| Lin | `person-lin` | recipient |
| 关系 | `relationship-mei-lin` | `entrusted` |
| 设备 | `loop-demo-device` | 可选模拟设备 |

### 1. Context 录入

1. 从首页进入 **Recorder**，点击 **Start a record**。
2. 选择 `Lin · Mother and daughter`，录入文字、模拟语音或图片描述。
3. 填写主题、为什么重要和至少一个使用场景。
4. 如需演示派生内容，勾选 **生成一条可逐项审核的 AI 摘要建议**。
5. 进入所有者审核，批准或编辑每条建议，并确认使用边界。
6. 保存已审核 Context。

### 2. 接收者主动进入和明信片

1. 从顶部导航进入 **Recipient**。
2. 点击 **主动进入**，再点击 **是我的，打开看看**。
3. 检查 `Original source`、`AI-generated`、Context ID、Asset ID、生成模式和触发原因。
4. 点击 **接受并保存明信片**。
5. 写下回应并保存，或选择关闭。

### 3. 可选硬件入口和离线 fallback

1. 进入 **Hardware simulator**，使用默认设备和身份。
2. 点击 **Verify and bind**，再点击 **Verify and entrust**。
3. 在 **Trigger** 中选择 `touch`，保持 `person-lin` 和 `user_opened`，点击 **Trigger event**。
4. 设备不可用时，允许的输入会转为可追溯的 software fallback；验证后的事件才会进入 Recipient。

硬件不参与主路径。无浏览器或媒体设备时，主流程仍由共享内存和确定性 adapter 完成。模拟语音与图片是文字/描述占位，不是打包的真实媒体文件。

## 页面路由

| 路由 | 页面 |
| --- | --- |
| `#/` | Demo 首页 |
| `#/capture` | 记录者入口 |
| `#/capture/new` | Context 编辑器 |
| `#/capture/review` | 原始内容、派生内容和策略审核 |
| `#/capture/success` | 保存结果 |
| `#/recipient` | 接收者入口 |
| `#/recipient/verify` | 接收者身份确认 |
| `#/recipient/memory/:id` | 来源与 provenance 展示 |
| `#/recipient/complete` | 远行明信片与回应 |
| `#/hardware-simulator` | 可选硬件模拟器 |
| `#/hardware-simulator/bind` | 设备绑定和托付 |
| `#/hardware-simulator/trigger` | 事件触发与生命周期 |

## 技术结构

```text
src/app       App Shell、hash router、页面入口
src/data      OfflineDemoService 共享 V2 内存状态
src/features  capture、agent、artifact、recipient、hardware
src/adapters  确定性 Agent、原始播放、硬件模拟器
src/domain    Context、关系、策略、Interaction、Artifact 合约
```

`src/data/offlineDemo.ts` 是本次集成的单一状态边界：Capture 写入的 Context、OriginalAsset、派生内容和策略会被 Recipient 的 Agent runtime 读取，完成 Interaction 后交给 `InteractionArtifactService` 生成 postcard。

## 质量检查

```bash
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

本次集成烟测覆盖 Context 录入、owner review、Recipient 主动进入、provenance、远行明信片、recipient response 和不可用硬件 software fallback。

## 当前限制

- 内存状态刷新即重置，没有数据库、账号系统或跨设备同步。
- AI 整理是 `DeterministicAgentGenerationAdapter` 本地预览，没有真实模型调用。
- `LOOP-DEMO` 是本地模拟凭证，不是生产级身份认证。
- 模拟语音使用文本 data URI，图片使用文字描述；本机未验证真实媒体播放。
- 默认 UI 聚焦 Mei 与 Lin 的一条关系，多关系管理和复杂权限 UI 尚未实现。
- 自动化集成、类型检查和生产构建已通过；若运行环境没有可用浏览器，真实浏览器布局、hash 点击和媒体播放仍需在现场设备复核。
