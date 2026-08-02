# 我在 W·HERE

> **一份会回应的记忆。** 让一个人在生前留下真实内容与使用边界，让过去的记忆在亲友主动靠近时回应现在的生活。

![React](https://img.shields.io/badge/React-19-202522?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-7-202522?style=flat-square&logo=typescript&logoColor=3178C6)
![Vite](https://img.shields.io/badge/Vite-8-202522?style=flat-square&logo=vite&logoColor=FFD62E)
![Tests](https://img.shields.io/badge/tests-195%20passed-1f6753?style=flat-square)
![Mode](https://img.shields.io/badge/demo-offline-d7674c?style=flat-square)

**[第一次使用？点击这里打开傻瓜式中文教程](docs/USER_GUIDE.md)**

[产品理念](05_PRODUCT_CONCEPT_W_HERE.md) · [主要能力](#主要能力) · [快速启动](#快速启动) · [演示路线](#演示路线) · [技术说明](#技术说明)

---

## 产品简介

W·HERE 是一个软件优先的“可回应数字记忆陪伴”原型。记录者为一名重要亲友留下经过本人确认的文字、声音或图片说明；未来，接收者可以主动分享今天发生的事，系统再从已授权的真实内容中生成克制、有来源、明确标记为 AI 的回应。

它不是数字复活，也不是可以无所不答的人格克隆。这里优先保证四件事：**真实来源、关系专属、生成有边界、双方有控制权。**

## 主要能力

| 能力 | 当前可以做什么 | 为什么重要 |
| --- | --- | --- |
| 关系化记忆采集 | 为指定接收者录入文字、模拟语音或图片说明 | 留下的是“我与你之间”，不是公共人格模板 |
| 所有者审核 | 检查原始素材，批准、编辑、移除或拒绝 AI 建议 | AI 不能替记录者决定什么代表自己 |
| 接收者主动进入 | 只有接收者点击进入并确认身份后才加载内容 | 默认 `pull_only`，不做强情绪推送 |
| 现在连接过去 | 接收者提交今天的文字或照片描述，Agent 从真实旧 Context 中寻找回应 | 完成“过去的记忆回应现在的生活” |
| 来源与 AI 标记 | 同屏展示原始内容、Context ID、Asset ID、生成模式和 AI 状态 | 用户能分清本人原话与模型生成 |
| 远方回信 | 把“今天 + 真实来源 + 有限回应”保存为纪念物 | 一次互动可以被收藏和回看 |
| 内容隔离 | 接收者的新内容标记为 `recipient-authored` | 不会反向写成记录者生前的事实 |
| 信物模拟入口 | 模拟绑定、托付、触发和软件 fallback | 没有戒指、NFC 或 BLE 设备也能演示完整闭环 |
| Echo Map Journey | 以可退出、可跳过的路径体验记忆节点与明信片 | 展示更具仪式感的接收者体验，但不替代核心闭环 |

## 演示路线

```text
记录者留下真实内容
        ↓
本人审核 AI 建议与使用边界
        ↓
接收者主动进入并分享今天
        ↓
过去 Context 生成有来源的有限回应
        ↓
保存“今天收到的远方回信”
```

只想快速看到结果时，可以直接进入顶部导航的 **收到回应**。系统已经预置 Mei 留给 Lin 的雨天记忆，输入“今天下雨，我又忘记带伞了”即可体验回应与来源追踪。

需要完整比赛演示时，请按 **留下记忆 → 收到回应 → 收藏远方回信** 的顺序操作。每一步的按钮和填写示例都写在 **[完整新手教程](docs/USER_GUIDE.md)** 中。

## 快速启动

环境要求：Node.js 20+、npm 10+。

```bash
git clone https://github.com/lavine888/HKhackthon-loop.git
cd HKhackthon-loop
npm install
npm run dev
```

浏览器打开：**http://localhost:5173/#/**

本项目不需要后端、数据库、API Key 或真实硬件。所有 Demo 数据保存在浏览器内存中，刷新页面会恢复预置状态。

## 产品原则

- **真实高于拟真**：宁可少回答，也不编造重要记忆。
- **回应高于复刻**：提供能承接倾诉的记忆载体，不假装一个人仍然活着。
- **本人拥有控制权**：记录者决定留下什么、给谁看、AI 可以如何使用。
- **接收者拥有主动权**：接收者决定何时进入、是否继续、何时退出。
- **AI 必须可识别**：所有生成内容均有标记，并能追溯到真实 Context。
- **硬件不是前提**：软件闭环优先，实体信物只是采集、身份或仪式入口。

## 当前状态

| 项目 | 状态 |
| --- | --- |
| 产品形态 | Offline Software MVP V2 |
| 默认关系 | Mei → Lin，母女关系 |
| 核心触发 | `pull_only` / `user_opened` |
| 网络依赖 | 无 |
| 后端与数据库 | 暂无，使用内存状态 |
| AI 实现 | 本地确定性生成适配器 |
| 自动化验证 | 19 个测试文件 / 195 项测试通过 |
| Production build | 通过 |

## 页面入口

| 路由 | 用途 |
| --- | --- |
| `#/` | W·HERE 体验首页 |
| `#/capture/new` | 关系化 Context 编辑器 |
| `#/capture/review` | 原始素材、AI 建议与使用边界审核 |
| `#/recipient` | 接收者主动进入 |
| `#/recipient/verify` | 接收者身份确认 |
| `#/recipient/share` | 分享今天的文字或照片描述 |
| `#/recipient/memory/:id` | 查看当下输入、真实来源与 AI 回应 |
| `#/recipient/complete` | 收藏远方回信并留下接收者内容 |
| `#/recipient/echo-map` | Echo Map Journey 体验 |
| `#/hardware-simulator` | 可选硬件模拟器 |

## 技术说明

```text
src/app       应用壳、Hash Router、页面入口
src/data      离线 Demo 的共享内存边界
src/domain    Context、关系、策略、互动与纪念物合约
src/features  capture、agent、artifact、recipient、journey、hardware
src/adapters  确定性生成、原始播放与硬件模拟适配器
```

`OfflineDemoService` 是软件 Demo 的单一集成边界。Capture 写入的原始素材、审核后派生内容和生成策略，会被关系 Agent 按当前接收者动态读取；接收者的 Present Context 独立保存，不会进入记录者来源链；完成互动后再由 `InteractionArtifactService` 生成远方回信。

## 质量验证

```bash
npm run verify
git diff --check
```

`npm run verify` 会依次执行全部测试、TypeScript 检查和 production build。

## 当前限制

- 状态仅保存在内存中，刷新后重置；尚无账号、数据库或跨设备同步。
- 当前 AI 是确定性离线 Demo，不是实际大模型调用。
- `LOOP-DEMO` 是模拟凭证，不是生产身份认证方案。
- 模拟语音使用文字占位，图片输入使用照片描述，尚未接入真实媒体上传。
- 当前核心闭环聚焦一名记录者与一名接收者，不处理完整家庭网络。
- 本项目是产品与比赛原型，不提供医疗、法律、财务或重大人生决策建议。

## 相关文档

- **[傻瓜式使用教程](docs/USER_GUIDE.md)**：从安装到完成远方回信的逐步操作。
- **[最新产品理念](05_PRODUCT_CONCEPT_W_HERE.md)**：品牌、定位、MVP 与产品原则。
- [项目背景](00_PROJECT_CONTEXT.md)：工程背景与 V2 定义。
- [.loop/DECISIONS.md](.loop/DECISIONS.md)：关键工程决策。
- [.loop/RISKS.md](.loop/RISKS.md)：已知风险与缓解方式。
