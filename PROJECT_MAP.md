# W·HERE 项目地图

这份文件回答三个问题：这个仓库里有什么、哪些已经做出来、各类“版本”分别指什么。

## 当前结论

这里不是多个互相独立的仓库或软件副本。当前有一个可运行应用：**W·HERE Offline Software MVP V2**，其中包含两个并行产品体验：**Echo Map** 和 **Memory Room**。除此之外，仓库还保存了展位设计 V2-V8、45 秒宣传视频工程、产品文档和工程协作记录。

当前可交付物：

| 交付物 | 当前版本或位置 | 状态 |
| --- | --- | --- |
| Web 应用 | 根目录 React/Vite 项目 | 可运行、可构建 |
| Echo Map 产品 | `#/recipient/echo-map` | 节点式 Agent 记忆旅程 |
| Memory Room 产品 | `#/game` | 五章节叙事记忆游戏 |
| 产品功能测试 | `src/**/*.test.ts(x)` | 20 个文件 / 201 项 |
| 浏览器 Judge Path | `tests/e2e/*.spec.ts` | desktop/mobile 共 8 项 |
| 展位立牌 | `booth/loop-booth-banner-v8.*` | V8 为唯一当前打印版 |
| 产品宣传片 | `videos/where-launch/renders/where-launch-demo.mp4` | 45 秒 16:9 Demo |
| 现场演示脚本 | `docs/DEMO_RUNBOOK.md` | 可直接照稿演示 |
| 产品理念 | `05_PRODUCT_CONCEPT_W_HERE.md` | W·HERE V1.0 概念文档 |

## 根目录结构

```text
Loop/
|-- src/                    当前 Web 应用源码
|-- tests/e2e/              Playwright 真实浏览器验收
|-- docs/                   面向用户、演示和交付的文档
|-- booth/                  展位立牌 V2-V8，V8 为 current
|-- videos/                 独立 HyperFrames 宣传视频工程
|-- .loop/                  TASK-009 至 TASK-022 的工程记录
|-- .agents/                Codex 项目级开发 Skills
|-- .opencode/              OpenCode agents、commands 与 Skills
|-- .codex/                 Codex hooks 配置
|-- 00_PROJECT_CONTEXT.md   工程背景与 V2 产品边界
|-- 01_PROMPT_*.md          历史协作提示词
|-- 02_PROMPT_*.md          历史协作提示词
|-- 03_WORKFLOW.md          多 Agent 工程工作流
|-- 04_SOFTWARE_UPDATE_*.md 早期软件阶段记录
|-- 05_PRODUCT_CONCEPT_*.md 当前产品理念
|-- README.md               项目首页与启动说明
|-- package.json            Web 应用命令和依赖
`-- *config.*               Vite、TypeScript、Playwright 配置
```

`node_modules/`、`dist/`、`*.tsbuildinfo`、HyperFrames 缓存和 Playwright 失败报告均为可重新生成的输出，不代表新版本。

## 已实现功能

### 两条产品线

| 产品 | 结构 | 当前作用 |
| --- | --- | --- |
| Echo Map | 强度、提议、行动、记忆、回应、postcard、点亮节点 | 验证来源、授权、状态转换和完成完整性 |
| Memory Room | 看见、说、寻找、去做、你在 | 验证无分数、可离开、把关系记忆带回现实生活的叙事体验 |

完整对比见 `docs/PRODUCT_LINES.md`。

### 1. 记录者留下记忆

- 为指定关系录入文字、模拟语音或图片说明。
- 保存主题、重要原因、适用场景、敏感度和关系范围。
- 生成一条确定性的 AI 摘要建议。
- 记录者可以批准、编辑、移除或拒绝 AI 建议。
- 原始素材、AI 派生内容、授权策略分别保存，不互相覆盖。

作用：证明 AI 使用的是本人审核过的关系化记忆，而不是公共人格资料。

### 2. 接收者主动获得回应

- 接收者必须从 `收到回应` 主动进入并确认关系。
- 可以输入今天的文字或照片描述。
- 系统从已授权的真实 Context 中返回原始来源和有限 AI 回应。
- 页面展示 Context ID、Asset ID、生成模式和 `pull_only` 触发策略。
- 可以收藏远方回信，并独立保存接收者自己的话。

作用：完成“过去的真实记忆回应今天”的核心闭环，同时避免把接收者的新内容写成记录者生前事实。

### 3. Echo Map Journey

- 选择 `quiet`、`glimmer` 或 `deep` 体验强度。
- 检查提议、接受 W·HERE 提供的中立动作、主动确认完成。
- 打开原始记忆，区分 Original source 与 AI-generated。
- 留下或省略回应，生成 postcard，再选择是否点亮节点。
- 支持 Skip、Stop、Reject、Hide 和失败重试。
- 刷新或直接打开旅程 URL 不能绕过身份确认。

作用：把同一套来源、授权和退出权包装成更有仪式感的可玩体验。

### 4. Memory Room / 记忆旅程

- 以五章节连续流程运行：看见、说、寻找、去做、你在。
- 区分 Mei 原始来源、W·HERE 建议和 Lin 今天写下的内容。
- 可以跳过文字、返回上一章、寻找多条线索并随时离开。
- 没有分数、连续签到、亲密度、答错惩罚或强制通关。

作用：证明 W·HERE 不只是回应工具，也可以成为有边界的叙事记忆游戏。

### 5. 信物与硬件模拟器

- 模拟 owner 绑定、recipient 托付、凭证验证和触发事件。
- 支持 touch、tap、gesture、NFC、BLE 与软件来源合约。
- 验证重复事件、错误身份和不允许的 trigger reason。
- 没有真实硬件时可使用 software fallback。

作用：证明实体戒指、NFC 或桌面物件可以成为入口，但核心产品不依赖硬件。

### 6. 安全与来源边界

- 只允许 entrusted relationship 内的 recipient 访问。
- 拒绝 private、跨关系或无来源 Context。
- 拒绝新增事实、重大决定、未审核意图和高风险输出。
- AI 内容必须明确标记，且可追溯到 Context 与 Asset。
- 当前 Demo 无网络请求、后端、数据库或 API Key。

作用：把“不是数字复活、不是自由人格克隆”落实为运行时规则，而不仅是文案。

## 已实现但未在主界面完整开放

- `bounded_persona_inference` 领域能力存在，但当前 Demo policy 不允许。
- artifact 合约支持 postcard、letter、memory card，UI 当前只创建 postcard。
- planned interaction、context assembler 和 feedback preference 的部分领域代码存在，但没有完整用户流程。
- 硬件协议包含多种来源，主 Demo 只接受 `user_opened`。

这些代码属于能力储备，不应在演示中描述成已上线功能。

## 尚未实现

- 真实账号、登录、身份认证、数据库和跨设备同步。
- 真实语音/图片上传、录音、摄像头和媒体播放。
- 真实 LLM、云端 Agent、API 调用和模型供应商。
- 真实 NFC、BLE、戒指固件或传感器。
- 天气、位置、纪念日主动触发和通知。
- 多接收者家庭网络、持久同意撤销、导出删除和审计日志。

## 版本怎么理解

### 软件版本

- `package.json` 仍为 `0.1.0`，产品阶段名称是 **Offline Software MVP V2**。
- Git 中共有 26 个提交里程碑，从 React/Vite 初版、Capture/Agent/Recipient/Hardware，到 V2 provenance，再到 W·HERE 与 Echo Map。
- 当前工作区在 `agent/loop-v2-integration` 上包含大量未提交完善内容；它们不是多个文件夹副本。

### 展位版本

- `booth/` 保存 Base、V2、V3、V4、V5、V6、V7、V8 的设计演变。
- **V8 是唯一当前交付版**；V2-V7 只用于追溯，不应发送打印。
- 相对头像路径仍被 HTML/SVG 使用，因此当前不物理移动这些文件。

### 视频版本

- `videos/where-launch/` 是独立 HyperFrames 项目，不是第二个 Web 应用。
- 当前交付视频是 `renders/where-launch-demo.mp4`。
- `snapshots/` 是审查帧，`.hyperframes/` 和 `.thumbnails/` 是可删除缓存。

## 从哪里开始

| 你想做什么 | 打开哪里 |
| --- | --- |
| 运行软件 | `README.md` |
| 第一次完整操作 | `docs/USER_GUIDE.md` |
| 两分钟比赛演示 | `docs/DEMO_RUNBOOK.md` |
| 区分两个产品 | `docs/PRODUCT_LINES.md` |
| 交给原生 ChatGPT | `docs/CHATGPT_NATIVE_HANDOFF.md` |
| 查看全部文档 | `docs/README.md` |
| 找当前展位文件 | `booth/README.md` |
| 找宣传视频 | `videos/README.md` |
| 查看任务演进 | `.loop/STATUS.md` 和 `.loop/tasks/` |
| 判断隐私/生产边界 | `docs/PRIVACY_SECURITY.md` |

## 不建议现在做的整理

- 不移动 `src/`、`tests/` 或根目录配置文件，构建路径依赖这些位置。
- 不合并 `.agents/` 与 `.opencode/`，两者服务不同运行器。
- 不删除两个 HardwareBridge 路径，它们仍被运行时代码或测试引用。
- 不把 booth V2-V7 与 V8 混成一个“final”文件；README 的权威索引比文件名可靠。
- 在当前大量改动提交前，不进行大规模重命名或目录迁移。
