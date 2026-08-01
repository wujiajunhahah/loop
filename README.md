# Loop Software MVP

> 记录者设计未来如何陪伴，Agent 让真实内容恰当地出现，接收者决定是否打开，硬件让这份关系真正被托付。

Loop 是一个面向香港 Physical Hackathon 的实体情感产品原型。它不是通用录音工具，也不是模拟逝者自由说话的聊天机器人；它保存真实内容，按关系和授权边界组织 Context，并通过实体硬件入口把内容交到特定接收者手中。

本仓库实现了一个无需后端、无需模型 API、无需真实硬件也能完整演示的 Software MVP。

## 已经做出的产品

当前版本打通了完整的产品闭环：

```text
记录内容
   ↓
指定接收者和关系
   ↓
审核 AI 使用权限
   ↓
创建未来共同计划
   ↓
绑定并托付模拟硬件
   ↓
接收者主动触发
   ↓
身份与关系验证
   ↓
Relationship Agent 加载授权 Context
   ↓
展示原始回忆与 AI 整理内容
   ↓
接收者决定接受、延后、跳过或永久关闭
   ↓
继续共同计划并留下新的回应
```

### 记录者端

- 支持文字、模拟语音和图片占位三种记录方式。
- 为每条内容指定接收者、关系、主题和“为什么留给对方”。
- 标记真实回忆、未来祝福、共同计划、仅原样播放或允许 AI 整理。
- 原始内容与 AI 整理预览分开展示。
- AI 整理默认关闭，记录者必须审核并确认边界后才能保存。
- AI 不能生成新记忆，也不能替记录者表达未说过的意志。

### Relationship Agent

- 按 `relationshipId` 和 `recipientId` 加载对象专属 Context。
- 校验 owner、relationship、recipient、policy、session 和内容来源。
- 私密内容在 Context 组装阶段直接排除。
- AI 整理内容必须经过记录者审核，且所有来源都在 allowlist 中。
- 只允许在接收者主动进入后的有效 session 中呈现内容。
- 管理共同计划的 `planned → invited → accepted → completed` 状态。

### 硬件模拟器

- 模拟设备绑定、身份验证和托付。
- 支持 `touch`、`tap`、`gesture`、`nfc`、`ble` 和软件模拟事件。
- 所有事件进入同一套标准化 HardwareEvent 管线。
- 验证接收者与托付对象是否一致。
- 拒绝未绑定设备、错误接收者和重复事件。
- 展示 produced、verified、rejected、consumed 生命周期。
- 没有真实硬件时自动使用 software fallback。

### 接收者端

- 接收者必须主动进入并确认身份，内容不会自动播放。
- 同时展示原始内容来源和授权后的 AI 整理内容。
- 原始声音只有在接收者主动点击后才播放。
- 接收者可以接受、延后、跳过或永久关闭。
- 共同计划是邀请，不是必须完成的任务。
- 接收者可以继续计划并留下自己的新关系记录。
- 接收者回应归接收者所有，不会被记录者的 Agent 当作授权素材使用。

## 核心安全边界

| 边界 | 当前实现 |
| --- | --- |
| 关系隔离 | relationship-specific 内容必须同时匹配关系和接收者 |
| 私密内容 | `private` 内容不会进入 Agent 可呈现 Context |
| AI 授权 | 只有 allowlist 内、来源完整、经 owner 审核的内容可以整理 |
| 原始标记 | 原始内容与 `ai_organized` 内容始终保留独立 provenance |
| 新意志生成 | `allowNewMemoryGeneration` 在领域模型中固定为 `false` |
| 接收者控制 | 默认不主动打扰，必须主动进入，可延后、跳过或永久关闭 |
| 硬件身份 | 绑定和托付分别验证 owner 与 recipient，错误身份不会进入 App |
| 离线演示 | 所有核心功能都有内存实现和 mock，不依赖网络或外部服务 |

## 快速运行

### 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本

### 安装和启动

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址，通常是：

```text
http://localhost:5173
```

项目使用 hash router，因此页面地址会显示为 `/#/capture`、`/#/recipient` 等形式。

## 完整 Demo 操作

Demo 使用固定人物：

| 身份 | ID | 角色 |
| --- | --- | --- |
| Mei | `person-mei` | 记录者、母亲 |
| Lin | `person-lin` | 接收者、女儿 |
| 关系 | `relationship-mei-lin` | 母亲与女儿 |
| 设备 | `loop-demo-device` | 模拟实体信物 |

### 1. 创建内容和计划

1. 从首页进入 **Recorder**。
2. 选择文字或模拟语音输入，写下真实内容。
3. 接收者选择 `Lin · Mother and daughter`。
4. 填写主题和“为什么留给这个人”。
5. 内容类型选择 **共同计划**。
6. 填写计划名称和未来邀请。
7. 进入审核页，按需要勾选 **允许 AI 整理这条记录**。
8. 确认已经审核原始内容、整理预览和使用边界。
9. 保存内容。

### 2. 模拟硬件绑定和托付

1. 从首页进入 **Hardware simulator**。
2. 点击 **Open simulator**，进入 **Bind**。
3. 保持默认值：

```text
Device ID: loop-demo-device
Owner identity: person-mei
Recipient identity: person-lin
```

4. 点击 **Verify and bind**。
5. 点击 **Verify and entrust**。

本地模拟身份凭证是 `LOOP-DEMO`，它只用于 Demo，不是生产认证方案。

### 3. 接收者主动触发并查看内容

1. 进入模拟器的 **Trigger** 页面。
2. 事件选择 `touch`，接收者保持 `person-lin`。
3. 点击 **Trigger event**。
4. App 验证事件并进入接收者入口。
5. Lin 点击 **主动进入**，再点击 **是我的，打开看看**。
6. 查看原始回忆和 AI 整理内容；原声不会自动播放。
7. 点击 **接受这段邀请**。
8. 点击 **继续这项计划**。
9. 写下 Lin 的新回应并保存。

### 重复演示

所有业务状态保存在内存中。刷新页面即可恢复固定 seed 数据并重新开始 Demo。硬件事件 ID 默认自动生成，因此可以连续触发；显式复用同一个事件 ID 时会被判定为重复事件并拒绝。

## 页面路由

| 路由 | 页面 |
| --- | --- |
| `#/` | 产品首页和三条 Demo 入口 |
| `#/capture` | 记录者入口 |
| `#/capture/new` | 新建内容 |
| `#/capture/review` | 原始内容、AI 整理和权限审核 |
| `#/capture/success` | 保存结果 |
| `#/hardware` | 硬件功能入口 |
| `#/hardware-simulator` | 模拟器总览 |
| `#/hardware-simulator/bind` | 设备绑定和托付 |
| `#/hardware-simulator/trigger` | 事件触发和生命周期检查 |
| `#/recipient` | 接收者入口 |
| `#/recipient/verify` | 接收者身份确认 |
| `#/recipient/memory/:id` | 回忆与 provenance 展示 |
| `#/recipient/plan/:id` | 共同计划邀请 |
| `#/recipient/complete` | 计划进度和新回应 |

## 技术架构

```text
src/app
  应用外壳、hash 路由、页面入口
       │
       ├── src/features/capture
       ├── src/features/recipient
       ├── src/features/agent
       └── src/features/hardware
                    │
src/adapters        │ 端口和离线实现
                    │
src/data            │ seed 与共享内存状态
                    │
src/domain          │ 领域实体、不变量和权限规则
```

主要技术：

- React 19
- TypeScript 7
- Vite 8
- Vitest 4
- Testing Library
- 原生 hash router
- 原生 CSS，无 UI 框架依赖

## 数据如何流动

1. `CaptureFlow` 通过 `ContextCaptureService` 保存原始 Memory。
2. 集成层更新同一关系的 policy allowlist 和 planned interaction。
3. `ContextAssembler` 加载 Relationship、RecipientSession、Policy、Memory 和 Plan。
4. `AgentPolicyEvaluator` 对每一条原始内容和 AI 整理内容分别判定权限。
5. `RelationshipAgent` 只呈现通过检查的最新关系内容和可用邀请。
6. `MockHardwareBridge` 验证绑定、托付、事件身份和重复事件。
7. `HardwareFlowController` 只把 verified 事件交给 recipient flow。
8. `RecipientExperience` 保留最终选择权，并通过 capture service 保存回应。

## 项目文件说明

以下是需要维护的源码和项目文件。`node_modules/`、`dist/` 和 `*.tsbuildinfo` 属于依赖、构建产物或缓存，不应手工修改。

### 根目录

| 文件 | 作用 |
| --- | --- |
| `README.md` | 项目介绍、运行方式、Demo 手册和文件索引 |
| `00_PROJECT_CONTEXT.md` | 产品背景、核心原则、MVP 范围和技术方向 |
| `01_PROMPT_CODEX_DESKTOP.md` | Codex 桌面协作角色说明 |
| `02_PROMPT_OPENCODE.md` | OpenCode 执行角色和任务约束 |
| `03_WORKFLOW.md` | 多窗口、分支、任务和报告协作流程 |
| `package.json` | npm 脚本、运行依赖和开发依赖 |
| `package-lock.json` | 锁定依赖的精确版本，保证安装可复现 |
| `index.html` | Vite 应用 HTML 入口和 React 挂载节点 |
| `vite.config.ts` | Vite React 插件及 Vitest jsdom 环境配置 |
| `tsconfig.json` | TypeScript project references 总配置 |
| `tsconfig.app.json` | 浏览器端 React 代码的 TypeScript 配置 |
| `tsconfig.node.json` | Vite 配置等 Node 环境文件的 TypeScript 配置 |
| `.env.example` | 外部服务环境变量模板；当前离线 Demo 不要求密钥 |
| `.gitignore` | Git 忽略规则 |

### 应用入口与样式

| 文件 | 作用 |
| --- | --- |
| `src/main.tsx` | 创建 React root，挂载整个 App，并加载全局样式 |
| `src/vite-env.d.ts` | 注入 Vite 客户端类型声明 |
| `src/app/App.tsx` | 应用外壳、顶部导航、hash router 和全部页面映射 |
| `src/app/pages/HomePage.tsx` | 首屏产品说明和 Recorder、Recipient、Hardware 三个入口 |
| `src/app/pages/CapturePage.tsx` | 将 capture 路由交给 `CaptureFlow` |
| `src/app/pages/RecipientPage.tsx` | 将 recipient 路由交给 `RecipientExperience` |
| `src/app/pages/HardwarePage.tsx` | 硬件功能说明和模拟器入口 |
| `src/styles/global.css` | 全局设计 token、布局、表单、记录端和接收端响应式样式 |

### 共享 UI

| 文件 | 作用 |
| --- | --- |
| `src/shared/ui/ButtonLink.tsx` | hash 路由按钮链接 |
| `src/shared/ui/PageHeader.tsx` | 页面 eyebrow、标题、描述和操作区 |
| `src/shared/ui/StatusPanel.tsx` | 离线模式和系统状态展示 |
| `src/shared/ui/index.ts` | 统一导出共享 UI 组件 |

### 领域模型

| 文件 | 作用 |
| --- | --- |
| `src/domain/models.ts` | Person、Relationship、Memory、AgentPolicy、Plan、Session 等核心实体 |
| `src/domain/policy.ts` | Agent 是否可使用某条 Memory 的领域级权限规则 |
| `src/domain/hardware.ts` | 基础硬件事件创建与事件类型规则 |
| `src/domain/index.ts` | 统一导出领域模型和规则 |
| `src/domain/models.test.ts` | Memory、Session 和领域不变量测试 |
| `src/domain/policy.test.ts` | 私密内容、关系隔离、接收者匹配和 allowlist 测试 |
| `src/domain/hardware.test.ts` | 基础硬件事件模型测试 |

### Adapter 端口与实现

| 文件 | 作用 |
| --- | --- |
| `src/adapters/contracts/services.ts` | Capture、Store、Agent、Hardware、Playback 的基础服务接口 |
| `src/adapters/contracts/index.ts` | 统一导出基础服务接口 |
| `src/adapters/agent/InMemoryAgentContextRepository.ts` | 为 Agent 提供关系、记忆、策略、计划和 session 的内存查询 |
| `src/adapters/agent/MockRelationshipAgent.ts` | 无模型 API 的确定性 Relationship Agent adapter |
| `src/adapters/agent/index.ts` | 统一导出 Agent adapters |
| `src/adapters/hardware/types.ts` | 设备绑定、身份凭证、事件、反馈和生命周期类型 |
| `src/adapters/hardware/HardwareBridge.ts` | 硬件无关的 bridge 接口 |
| `src/adapters/hardware/MockHardwareBridge.ts` | 绑定、托付、验证、去重、反馈和 fallback 的内存实现 |
| `src/adapters/hardware/index.ts` | 统一导出硬件 adapter API |
| `src/adapters/hardware/MockHardwareBridge.test.ts` | 硬件身份、重复事件、fallback 和反馈测试 |

### 数据与集成状态

| 文件 | 作用 |
| --- | --- |
| `src/data/seed.ts` | Mei、Lin、母女关系、家庭菜回忆、权限、计划和 session 固定数据 |
| `src/data/mockServices.ts` | 基础 RelationshipStore、Capture、Agent、Hardware 和 Playback 内存服务 |
| `src/data/services.ts` | 组装共享 demo state，并连接 capture、Relationship Agent、plan 和 playback |

### Capture 功能

| 文件 | 作用 |
| --- | --- |
| `src/features/capture/CaptureFlow.tsx` | 记录输入、接收者选择、内容标记、权限审核、保存和计划创建流程 |
| `src/features/capture/CaptureFlow.test.tsx` | 表单校验、AI 边界和保存流程测试 |

### Agent 功能

| 文件 | 作用 |
| --- | --- |
| `src/features/agent/types.ts` | Relationship Context、权限判定、呈现内容和计划状态类型 |
| `src/features/agent/errors.ts` | 明确的 Agent 错误码和错误类型 |
| `src/features/agent/AgentPolicyEvaluator.ts` | 分别判定原始播放和 AI 整理是否被授权 |
| `src/features/agent/ContextAssembler.ts` | 验证关系、接收者 session、policy，并组装隔离后的 Context |
| `src/features/agent/RelationshipAgent.ts` | 从授权 Context 选择内容并形成 recipient view |
| `src/features/agent/PlannedInteractionService.ts` | 共同计划状态机和关系范围内的计划查询 |
| `src/features/agent/index.ts` | 统一导出 Agent 功能 API |
| `src/features/agent/agent.test.ts` | 跨关系隔离、私密内容、未授权 AI、session 和计划状态测试 |

### Recipient 功能

| 文件 | 作用 |
| --- | --- |
| `src/features/recipient/session.ts` | Demo 接收者、共同计划和 RecipientSession helper |
| `src/features/recipient/RecipientExperience.tsx` | 主动进入、身份确认、内容呈现、选择、计划和回应完整体验 |
| `src/features/recipient/session.test.ts` | 接受、延后、跳过和永久关闭状态测试 |
| `src/features/recipient/RecipientExperience.test.tsx` | 从主动进入到留下回应的 UI 流程测试 |

### Hardware 功能

| 文件 | 作用 |
| --- | --- |
| `src/features/hardware/simulatorStore.ts` | 创建全局 simulator bridge 和 flow controller |
| `src/features/hardware/recipientNotifier.ts` | 将 verified 硬件事件通知 App 并进入 recipient 路由 |
| `src/features/hardware/HardwareFlowController.ts` | 触发事件、校验 verified 状态、通知接收者并消费事件 |
| `src/features/hardware/HardwareSimulatorPage.tsx` | 模拟器总览、绑定托付页和事件触发页 |
| `src/features/hardware/hardwareSimulator.css` | 模拟器专属布局、控件和生命周期样式 |
| `src/features/hardware/index.ts` | 统一导出 Hardware 功能 API |
| `src/features/hardware/recipientNotifier.test.ts` | 浏览器事件通知和路由测试 |
| `src/features/hardware/HardwareFlowController.test.ts` | 六类事件、错误身份和消费流程测试 |
| `src/features/hardware/HardwareSimulatorPage.test.tsx` | 模拟器页面交互测试 |

### 测试配置

| 文件 | 作用 |
| --- | --- |
| `src/test/setup.ts` | 注册 Testing Library 的 DOM matcher，并清理测试环境 |

### 集成记录

| 文件 | 作用 |
| --- | --- |
| `.loop/DECISIONS.md` | 集成期采用共享离线状态、统一硬件 bridge 和真实 Agent 边界的决策 |
| `.loop/RISKS.md` | 内存持久化、占位媒体和 mock 身份凭证等已知风险 |
| `.loop/requests/agent-interface.md` | Agent workstream 提出的基础接口调整请求 |
| `.loop/requests/hardware-interface.md` | Hardware workstream 提出的 bridge 和路由接入请求 |
| `.loop/reports/foundation.md` | 项目基础架构交付报告 |
| `.loop/reports/capture.md` | Capture 功能交付报告 |
| `.loop/reports/agent.md` | Relationship Agent 交付与安全规则报告 |
| `.loop/reports/recipient.md` | Recipient Experience 交付报告 |
| `.loop/reports/hardware.md` | Hardware Bridge 和模拟器交付报告 |
| `.loop/reports/integration.md` | 四个功能分支联调、验证和已知限制报告 |

## 质量检查

```bash
npm run typecheck
npm test
npm run build
```

当前集成基线：

- TypeScript 类型检查通过
- 11 个测试文件、45 个测试通过
- Vite 生产构建通过
- 不需要 API key、网络、后端或真实硬件

## 当前限制

- 页面刷新后内存状态会重置，当前版本没有持久化数据库。
- 模拟语音使用占位 URI，没有打包真实音频文件。
- `LOOP-DEMO` 只是本地验证值，不是生产级认证。
- AI 整理为确定性本地预览，没有调用真实大模型。
- 当前 MVP 聚焦 Mei 与 Lin 的一条母女关系，多关系管理 UI 尚未实现。

这些限制不会阻断现场 Demo，并且不会通过删除权限校验、关系隔离或原始内容标记来规避。
