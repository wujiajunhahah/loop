# Loop

### Leave something true.

Loop 是一个软件优先的生命 Context 与关系 Agent 原型。记录者把真实的声音、文字和故事留给一个具体的人；接收者在自己愿意的时候主动打开，看到有来源、有边界、可追溯的内容，并把这次相遇保存成一张远行明信片。

> Loop 不模拟一个可以自由聊天的“逝者”，也不依赖戒指、HRV 或被动采集。
> 它把真实记录、关系授权和接收者控制放在第一位。

| | 当前状态 |
| --- | --- |
| 产品形态 | Offline Software MVP V2 |
| 运行方式 | 无后端、无网络、无 API Key、无真实硬件 |
| 默认关系 | Mei -> Lin，母女关系 |
| 核心触发 | `pull_only` / `user_opened` |
| 验证状态 | 15 个测试文件 / 81 个测试，typecheck 与 production build 通过 |

## 2 分钟 Demo

```text
记录 Context -> owner review -> recipient 主动进入
             -> 原始内容 + AI 派生内容 + provenance
             -> InteractionArtifact / 远行明信片 -> recipient response
```

### 1. 记录一段内容

1. 启动应用后进入 **Recorder**，点击 **Start a record**。
2. 选择 `Lin · Mother and daughter`。
3. 输入原始内容、主题、重要原因和至少一个使用场景。
4. 可选勾选 AI 摘要建议，然后进入 **Owner review**。
5. 逐条批准、编辑、移除或拒绝建议，确认使用边界并保存。

### 2. 由接收者主动打开

1. 进入 **Recipient**，点击 **主动进入**。
2. 选择 **是我的，打开看看**。
3. 检查以下信息：
   - `Original source`：原始内容，保持不变；
   - `AI-generated`：基于批准来源的整理内容；
   - 来源 `Context ID` / `Asset ID`；
   - `generation mode`；
   - `trigger reason`。
4. 点击 **接受并保存明信片**，然后留下接收者回应。

### 3. 硬件不可用也能演示

Hardware simulator 是可选入口，不是软件闭环的前置条件。进入 **Hardware simulator**，完成模拟身份验证和托付后触发 `touch`；设备不可用时，系统会生成带 `originalSource` 的可追溯 software fallback。未经验证的事件不会进入 Recipient。

## 产品边界

### 保留真实内容

- 原始素材、原始 Asset、AI 派生内容和生成结果分层保存。
- 原始内容不会被 AI 摘要覆盖。
- 每个 Agent 输出必须包含来源 Context ID、AI 标记、生成模式和触发原因。

### 关系和权限优先

- 明确区分 `subject`、`recorder`、`recipient` 和 `buyer`。
- Agent 只读取当前接收者关系下经过 owner review 的来源。
- `private` Context、跨关系内容和未批准主题会被拒绝。
- 接收者回应标记为 `recipient-authored`，不会回写成记录者 Agent 的上下文。

### 接收者始终掌握主动权

- 默认触发策略是 `pull_only`。
- 只有接收者主动进入后，Agent 才会加载内容。
- 不做随机强推、HRV 情绪识别、自由人格聊天或高风险建议。
- 硬件可以是戒指、NFC、BLE、桌面物件或软件模拟器，但不是 MVP 依赖。

## 本地运行

环境要求：Node.js 20+、npm 10+。

```bash
npm install
npm run dev
```

打开 `http://localhost:5173/#/`。所有业务状态都在浏览器内存中，刷新页面会重置当前 Demo 状态。

## 页面入口

| 路由 | 用途 |
| --- | --- |
| `#/` | Demo 首页 |
| `#/capture/new` | Guided Context 编辑器 |
| `#/capture/review` | 原始内容、AI 派生内容和策略审核 |
| `#/recipient` | 接收者主动进入 |
| `#/recipient/verify` | 接收者身份确认 |
| `#/recipient/memory/:id` | 原始内容与 provenance 展示 |
| `#/recipient/complete` | 远行明信片与回应 |
| `#/hardware-simulator` | 可选硬件模拟器 |
| `#/hardware-simulator/bind` | 设备绑定和托付 |
| `#/hardware-simulator/trigger` | 事件触发与 software fallback |

## 技术结构

```text
src/app       App Shell、hash router、页面入口
src/data      OfflineDemoService 共享离线状态边界
src/domain    Context、关系、策略、Interaction、Artifact 合约
src/features  capture、agent、artifact、recipient、hardware
src/adapters  确定性 Agent、原始播放、硬件模拟器
```

`OfflineDemoService` 是集成 Demo 的单一内存边界：Capture 写入的 Context、OriginalAsset、审核后的 DerivedContent 和策略，会被 Recipient 的 Agent runtime 动态读取；完成互动后交给 `InteractionArtifactService` 生成 postcard。

## 质量验证

```bash
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

集成测试覆盖完整路径：新建 Context、owner review、动态 Context 流入接收者体验、来源追踪、AI 分层、远行明信片、recipient response，以及不可用硬件的 software fallback。

## 当前限制

- 状态仅保存在内存中，没有数据库、账号系统或跨设备同步。
- AI 整理使用本地 `DeterministicAgentGenerationAdapter`，不是实际模型调用。
- `LOOP-DEMO` 只是本地模拟凭证，不是生产认证方案。
- 模拟语音使用文本 data URI，图片使用文字描述；尚未声称提供真实媒体采集。
- 当前 UI 聚焦一对一 Mei / Lin 关系，多关系管理和复杂权限 UI 尚未实现。
- 真实浏览器布局、媒体播放和硬件适配仍需在现场设备复核。

## Project Context

产品定义、工程决策和夜间质量报告位于：

- `00_PROJECT_CONTEXT.md`：产品背景与 V2 定义；
- `.loop/DECISIONS.md`：集成边界与持久决策；
- `.loop/RISKS.md`：已知风险与缓解措施；
- `.loop/reports/`：按轮次记录的实现证据。
