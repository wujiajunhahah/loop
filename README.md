# W·HERE

> 一份会回应的记忆。

W·HERE 是一个软件优先的关系化数字记忆原型：记录者为重要亲友留下经过本人确认的真实内容与使用边界；未来，接收者主动靠近、分享今天的生活，系统再从已授权来源中给出克制、有来源、明确标记为 AI 的回应。

它不是数字复活，也不是自由聊天的人格克隆。它验证的是一条更具体的产品闭环：**真实记忆、关系专属、来源可追溯、AI 有边界、双方有控制权。**

![React](https://img.shields.io/badge/React-19-202522?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-7-202522?style=flat-square&logo=typescript&logoColor=3178C6)
![Vite](https://img.shields.io/badge/Vite-8-202522?style=flat-square&logo=vite&logoColor=FFD62E)
![Vitest](https://img.shields.io/badge/tests-201%20passed-1f6753?style=flat-square)
![Playwright](https://img.shields.io/badge/browser%20checks-8%20passed-2e7d5b?style=flat-square)
![Offline](https://img.shields.io/badge/demo-offline-d7674c?style=flat-square)

## 先看什么

| 目的 | 入口 |
| --- | --- |
| 不知道仓库里有什么 | [项目地图](PROJECT_MAP.md) |
| 第一次运行和操作 | [傻瓜式使用教程](docs/USER_GUIDE.md) |
| 2 分钟黑客松演示 | [Demo Runbook](docs/DEMO_RUNBOOK.md) |
| 产品和工程边界 | [产品理念](05_PRODUCT_CONCEPT_W_HERE.md) |
| 区分两个产品 | [双产品说明](docs/PRODUCT_LINES.md) |
| 交给原生 ChatGPT | [ChatGPT 交接文档](docs/CHATGPT_NATIVE_HANDOFF.md) |
| 全部文档索引 | [docs/README.md](docs/README.md) |
| 当前展位设计 | [booth/README.md](booth/README.md) |
| 当前宣传片工程 | [videos/README.md](videos/README.md) |

## 当前交付

这是一个 **Offline Software MVP V2**，默认演示关系为 `Mei -> Lin`，母女关系，预置雨天记忆。

| 交付物 | 当前事实 |
| --- | --- |
| Web 应用 | 根目录 React + TypeScript + Vite 应用 |
| 核心闭环 | 记录者采集 -> 所有者审核 -> 接收者主动进入 -> 有来源回应 -> 远方回信 |
| 产品一 | Echo Map：节点式、状态机驱动的 Agent 记忆旅程 |
| 产品二 | Memory Room：看见、说、寻找、去做、你在的五章节记忆游戏 |
| 硬件 | 绑定、托付、触发和 software fallback 模拟器 |
| 测试 | 20 个 Vitest 文件 / 201 项测试 |
| 浏览器验收 | Playwright desktop/mobile 共 8 项 |
| 生产构建 | 已通过 |
| 网络和后端 | 无网络、无数据库、无 API Key |
| AI | 本地确定性生成适配器，不是真实云端大模型 |

## 双产品结构

当前仓库包含一个 W·HERE 底层平台和两条并行产品线：

| 产品 | 入口 | 交互模型 | 用途 |
| --- | --- | --- | --- |
| **Echo Map** | `#/recipient/echo-map` | 强度、提议、行动、记忆、postcard、节点状态机 | 验证 Agent 旅程的来源、授权、退出权和完成完整性 |
| **Memory Room** | `#/game` | 看见、说、寻找、去做、你在五章节 | 验证无分数、可离开、能把记忆带回生活的叙事游戏 |

它们不是两个代码副本，也不是同一个产品的换皮页面。两个产品共用 Context、关系授权、来源、Agent 和 artifact 基础设施，但具有不同的状态模型、视觉语言和演示目标。详细比较见 [双产品说明](docs/PRODUCT_LINES.md)。

## 共享产品闭环

```text
记录者留下真实内容
        ↓
本人审核 AI 建议、关系范围和使用边界
        ↓
接收者主动进入并确认身份
        ↓
接收者分享今天发生的事
        ↓
Agent 从授权 Context 找到有来源的有限回应
        ↓
收藏一封远方回信，并独立保存接收者自己的话
```

## 已实现功能

### 记录者流程

- 为指定关系录入文字、模拟语音或图片说明。
- 填写主题、重要原因、使用场景、敏感度和情绪权重。
- 生成确定性的 AI 摘要建议。
- 批准、编辑、移除或拒绝 AI 建议。
- 将原始素材、AI 派生内容、Context 和生成策略分开保存。

### 接收者流程

- 接收者必须主动进入并确认关系，不自动推送。
- 输入今天的文字或照片描述。
- 查看原始来源、AI 生成内容、Context ID、Asset ID 和生成模式。
- 收藏远方回信并保存一条只属于接收者的回应。
- 页面刷新或直接访问深层 URL 时不会伪造授权或完成状态。

### Echo Map Journey

- 选择 `quiet`、`glimmer` 或 `deep` 强度。
- 查看提议，接受 W·HERE 提供的中性行动并主动确认完成。
- 打开原始记忆、查看来源、留下回应、生成 postcard、点亮节点。
- 支持 Skip、Stop、Reject、Hide、重试和离开后的授权撤销。

### Memory Room / 记忆旅程

- 在独立 `#/game` 路由运行五章节连续体验。
- “看见”浏览 Mei 主动留下的分层记忆。
- “说”允许 Lin 写下今天，也允许跳过。
- “寻找”通过声音、物品和路线探索来源线索，没有答错惩罚。
- “去做”提供明确标记为 W·HERE 建议的现实行动，不伪装成 Mei 的要求。
- “你在”展示 Lin 今天写下的新章节；没有填写时不会生成替代内容。
- 没有分数、签到、亲密度、失败惩罚或强制通关。

### 信物模拟器

- 模拟 owner 绑定、recipient 托付、身份凭证和硬件事件。
- 支持 touch、tap、gesture、NFC、BLE 和软件入口合约。
- 拒绝错误身份、重复事件和不允许的触发原因。
- 设备不可用时可以使用 software fallback，不阻断核心软件 Demo。

### 来源和安全边界

- 只允许 entrusted relationship 内的接收者访问。
- 拒绝 private、跨关系、无来源或超出 policy 的内容。
- 拒绝新增重要事实、重大决定、未审核意图和高风险输出。
- 所有 AI 内容明确标记，并保留来源 Context/Asset 追踪。
- 接收者的新内容使用 `recipient-authored` 标记，不会反写成记录者的过去。

## 30 秒快速体验

要求 Node.js 20+ 和 npm 10+：

```bash
git clone https://github.com/lavine888/HKhackthon-loop.git
cd HKhackthon-loop
npm install
npm run dev
```

打开终端显示的本地地址，通常是：

```text
http://localhost:5173/#/
```

然后按以下路径操作：

```text
收到回应
→ 主动进入
→ 继续到今天的回应
→ 使用雨天 Demo 内容
→ 让过去的记忆回应现在
→ 收藏这封远方回信
```

## 2 分钟 Echo Map 演示

```text
收到回应
→ 主动进入
→ 进入 Echo Map 旅程
→ 选择 glimmer
→ 查看来源与中性行动
→ 采用中立动作
→ 我已经做了
→ 打开原始内容
→ 留下 Lin 今天的回应
→ 保存并生成明信片
→ 收藏明信片并点亮节点
```

直接打开 `#/recipient/echo-map` 不会绕过身份确认，必须从接收者入口主动进入。

## 页面入口

| 路由 | 功能 |
| --- | --- |
| `#/` | W·HERE 首页 |
| `#/capture/new` | 关系化 Context 编辑器 |
| `#/capture/review` | 原始素材、AI 建议与使用边界审核 |
| `#/recipient` | 接收者主动入口 |
| `#/recipient/verify` | 身份确认 |
| `#/recipient/share` | 分享今天的文字或照片描述 |
| `#/recipient/memory/:id` | 查看真实来源与 AI 回应 |
| `#/recipient/complete` | 收藏远方回信和接收者内容 |
| `#/recipient/echo-map` | Echo Map Journey |
| `#/game` | Memory Room 五章节记忆游戏 |
| `#/hardware-simulator` | 可选硬件模拟器 |

## 仓库结构

```text
src/                    Web 应用源码
  app/                  应用壳、Hash Router、页面入口
  data/                 离线 Demo 的共享内存集成边界
  domain/               Context、关系、策略、互动和 artifact 合约
  features/             capture、agent、artifact、recipient、journey、hardware
                        game（Memory Room）
  adapters/             确定性 Agent、播放和硬件模拟适配器
tests/e2e/              Playwright 真实浏览器验收
docs/                   使用、演示、隐私、资产和工程文档
booth/                  展位立牌 Base/V2-V8，V8 是当前打印版
videos/                 独立 HyperFrames 宣传视频工程
.loop/                  任务、claim、report、决策和风险记录
.agents/                项目级开发 Skills
.opencode/              OpenCode agents、commands 和 Skills
.codex/                 Codex hooks 配置
```

详细的版本判断和“哪些东西不要移动”见 [PROJECT_MAP.md](PROJECT_MAP.md)。

## 版本说明

- 软件不是多个文件夹版本，主要通过 Git 提交演进：初始 MVP -> Capture/Agent/Recipient/Hardware -> V2 provenance -> W·HERE -> Echo Map。
- Echo Map 和 Memory Room 是同一 W·HERE 平台上的两条产品线，不是历史版本覆盖关系。
- `booth/` 里的 V2-V7 是设计历史，**V8 是唯一当前交付版**，打印前只看 [booth/README.md](booth/README.md)。
- `videos/where-launch/` 是独立宣传片工程，当前 MP4 位于 `videos/where-launch/renders/where-launch-demo.mp4`。
- 依赖、测试配置和当前工作状态以根目录配置、[PROJECT_MAP.md](PROJECT_MAP.md) 与 [.loop/STATUS.md](.loop/STATUS.md) 为准。

## 验证命令

```bash
npm run test          # Vitest 单元和集成测试
npm run typecheck     # TypeScript 检查
npm run build         # production build
npm run verify        # test + typecheck + build
npm run test:e2e      # Playwright desktop/mobile 验收
npm run test:e2e:headed
git diff --check
```

第一次运行浏览器验收时，如果本机没有 Playwright Chromium：

```bash
npx playwright install chromium
```

## 当前限制

- 所有状态只存在浏览器内存中，刷新后恢复预置 Demo。
- 没有账号、数据库、加密存储、跨设备同步、导出删除或访问审计。
- AI 是离线确定性适配器，不是真实大模型调用。
- `LOOP-DEMO` 是模拟凭证，不是生产身份认证。
- 语音和图片目前是文字占位或照片描述，不接入真实媒体。
- 当前只演示一名记录者与一名接收者，不处理完整家庭网络。
- 生产安全边界和未解决事项见 [PRIVACY_SECURITY.md](docs/PRIVACY_SECURITY.md)。

## 项目文档

- [项目地图](PROJECT_MAP.md)：整个仓库的总览和版本解释。
- [文档索引](docs/README.md)：按使用、产品边界和开发流程查找文档。
- [双产品说明](docs/PRODUCT_LINES.md)：Echo Map 与 Memory Room 的定位、流程和区别。
- [ChatGPT 原生交接](docs/CHATGPT_NATIVE_HANDOFF.md)：把方案、图片和功能任务交给网页端 ChatGPT 的上下文包。
- [傻瓜式使用教程](docs/USER_GUIDE.md)：从安装到完整闭环。
- [Demo Runbook](docs/DEMO_RUNBOOK.md)：比赛现场操作和恢复路径。
- [产品理念](05_PRODUCT_CONCEPT_W_HERE.md)：品牌、定位和叙事边界。
- [隐私与安全](docs/PRIVACY_SECURITY.md)：当前 Demo 与生产方案的差距。
- [资产权利](docs/ASSET_RIGHTS.md)：头像、截图、字体和视频素材登记。
- [AI Skills](docs/AI_SKILLS.md)：项目级开发和审查能力。
- [视频工作流](docs/VIDEO_WORKFLOW.md)：HyperFrames 制作流程。
- [第三方 Notices](THIRD_PARTY_NOTICES.md)：第三方工具和许可证来源。

## License

当前仓库未声明公开开源许可证。第三方工具和素材来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与 [ASSET_RIGHTS.md](docs/ASSET_RIGHTS.md)。
