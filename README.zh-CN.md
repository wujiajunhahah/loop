<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

<h1 align="center">我在 · Wozai</h1>

<p align="center"><strong>把想说的话，好好留下。交给对的人，在未来有分寸地出现。</strong></p>

<p align="center">
  一个参加香港 Physical AI Hackathon、以生命记录和关系托付为核心的项目。
</p>

<p align="center">
  <a href="https://www.wozai.space/"><img alt="官方网站" src="https://img.shields.io/badge/官方网站-wozai.space-162b3c?style=for-the-badge"></a>
  <a href="https://github.com/wujiajunhahah/loop/discussions"><img alt="GitHub Discussions" src="https://img.shields.io/badge/Discussions-参与讨论-2c61d6?style=for-the-badge&logo=github&logoColor=white"></a>
  <img alt="Physical AI Hackathon" src="https://img.shields.io/badge/Hackathon-Physical_AI-d57863?style=for-the-badge">
</p>

<p align="center">
  <a href="https://github.com/wujiajunhahah/loop/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/wujiajunhahah/loop?style=flat-square&logo=github"></a>
  <img alt="Last commit" src="https://img.shields.io/github/last-commit/wujiajunhahah/loop?style=flat-square">
  <img alt="Repository size" src="https://img.shields.io/github/repo-size/wujiajunhahah/loop?style=flat-square">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=162b3c">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python-009688?style=flat-square&logo=fastapi&logoColor=white">
  <img alt="Flutter" src="https://img.shields.io/badge/Flutter-Alloop_Kit-54c5f8?style=flat-square&logo=flutter&logoColor=white">
  <img alt="Alloop 智能戒指" src="https://img.shields.io/badge/Wearable-Alloop_Ring-668b78?style=flat-square&logo=bluetooth&logoColor=white">
  <img alt="中英双语" src="https://img.shields.io/badge/Docs-English_%2B_简体中文-eae3d5?style=flat-square">
</p>

<p align="center">
  <a href="https://www.wozai.space/"><strong>官方网站</strong></a>
  · <a href="#ui-演示">UI 演示</a>
  · <a href="https://www.wozai.space/#story">46 秒概念短片</a>
  · <a href="https://www.wozai.space/assets/documents/wozai-flyer.zh-CN.pdf">宣传传单</a>
  · <a href="./docs/presentation/wozai-physical-ai-hackathon-final-pitch.pptx">决赛路演 PPT</a>
  · <a href="./docs/README.md">项目文档</a>
  · <a href="./apps/visual-prototype/README.md">交互原型</a>
</p>

<a href="https://www.wozai.space/">
  <img src="./landing/assets/og-cover.png" alt="我在——把想说的话，好好留下" width="100%" />
</a>

## 「我在」是什么？

「我在」是一款以真实生命记录和关系托付为核心的情感陪伴产品。它帮助仍在生活中的记录者，用自己的原声、影像、照片、文字和物件故事留下真实的自己，再亲自决定这些内容交给谁、如何出现、可以怎样使用。

它不是数字复活。AI 可以整理、检索、关联和解释证据，但不能替记录者创造一段新的回忆、承诺、意志或从未说过的话。

理解产品最完整的入口是中英双语的[官方网站](https://www.wozai.space/)。官网集中呈现产品故事、托付流程、未来接收体验、AI 边界、[概念短片](https://www.wozai.space/#story)和[项目宣传传单](https://www.wozai.space/assets/documents/wozai-flyer.zh-CN.pdf)。

## UI 演示

<p align="center">
  <img src="./docs/assets/demo/wozai-ui-walkthrough.gif" alt="我在记录者端与未来接收视角 UI 演示" width="100%" />
</p>

<p align="center"><em>高保真视觉原型中的记录者体验，以及面向记录者展示的未来接收视角预览。</em></p>

## 一个产品，两种视角

产品的核心用户是仍在生活中的记录者，例如希望在有限时间里梳理生命内容、关系和托付方式的妈妈。

原型中的“女儿体验端”不是另一个独立获客端。现阶段它首先是一扇给记录者看的接收视角预览：妈妈可以提前理解自己的内容未来会怎样被找到、引用和体验，知道接收者拥有哪些选择，并在正式托付前调整内容和权限。

```text
记录者留下真实原始内容
  → 本人逐段确认与授权
  → 预览未来的接收视角
  → 调整内容、权限与托付方式
  → 被授权的接收者自主决定是否打开
```

## Physical AI Hackathon

「我在」参加香港 Physical AI Hackathon 的 alloop 支持赛道，选择“以人为本 / 人的状态识别与主动支持”。

我们的垂直场景是：**让重要生命记忆的对话与呈现，能够感知人的当下承接能力，同时不把「我在」变成医疗产品或泛健康管理工具。**

Alloop HRV 在这里是辅助状态信号，不用于诊断情绪，也不用于判断哪段记忆“更重要”。系统把它与用户的主动反馈放在一起，形成以人为本的闭环：

| 闭环 | 在「我在」中的含义 |
| --- | --- |
| 感知 | 接收 Alloop HRV，以及用户在信使中的文字或语音交互 |
| 理解 | 只从记录者已经确认的内容中寻找有证据的关联；HRV 只调节呈现强度 |
| 反馈 | 以轻柔或标准模式，呈现可追溯的原话与中性信使说明 |
| 改善 | 结合交互前后信号，学习“很相关、太重了、不要再出现、这不是她的意思”等主动反馈 |

这里的“学习”是改善**检索、排序和呈现策略**，不是生成更多“妈妈可能会说的话”。完整的扣题逻辑和演示叙事见[赛题对齐说明](./docs/hackathon/alloop-track-alignment.md)。

## 项目工具箱

仓库将官方网站保留在顶层，作为对外产品入口；可运行客户端、后端服务和分析工具分别归入 `apps/`、`services/` 与 `tools/`，让根目录清楚，同时保留完整的 Hackathon 工作成果。

```text
loop/
├── landing/       # 官方网站
├── apps/          # 产品应用与设备客户端
├── services/      # 正式接口与转发实验
├── tools/         # 离线分析工具
├── data/          # 有说明的样例数据
├── docs/          # 产品、赛题、硬件与路演资料
├── config/        # 集成参考配置
├── artifacts/     # 二进制交付归档
├── scripts/       # 维护脚本
└── .loop/         # 工程决策与历史记录
```

| 路径 | 包含内容 | 入口 |
| --- | --- | --- |
| [`landing/`](./landing/README.md) | 中英双语官网、概念短片、宣传传单、FAQ 与共创订阅 | [www.wozai.space](https://www.wozai.space/) |
| [`apps/`](./apps/README.md) | 视觉原型、Alloop Flutter 客户端、Omi 记录端和 Vite/Capacitor Software MVP | 应用导航 |
| [`services/`](./services/README.md) | FastAPI 信使后端与早期本地转发实验 | 服务导航 |
| [`tools/`](./tools/README.md) | 14 天可穿戴 CSV 数据的离线分析实验 | 工具导航 |
| [`data/sample_data/`](./data/sample_data/README.zh-CN.md) | 测量与活动量模拟数据 | 数据字典 |
| [`docs/hardware/models/`](./docs/hardware/models/README.md) | 可编辑的 Rhino 7 充电器 / 外壳 CAD 源模型 | `.3dm` 模型 |
| [`docs/`](./docs/README.md) | Hackathon、产品、架构、硬件、隐私与演示文档 | 文档导航 |
| [`config/`](./config/README.md) | 归档的 Flutter、Firebase 与 Android 参考配置 | 配置导航 |
| [`artifacts/relay/`](./artifacts/relay/README.md) | 已打包的 Android relay 演示与离线工具 | 交付归档 |
| [`scripts/`](./scripts/README.md) | 小型跨平台维护脚本 | 脚本说明 |
| [`.loop/`](./.loop/) | 设计决策、风险、接口请求、审计与开发任务记录 | 项目记录 |

## 快速体验

### 官方网站

```bash
cd landing
python3 -m http.server 4173
```

打开 <http://localhost:4173>。

### 高保真体验原型

```bash
cd apps/visual-prototype
pnpm install
pnpm dev
```

打开 <http://127.0.0.1:5174/>。

### 信鸽后端

```bash
cd services/pigeon-backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

打开 <http://127.0.0.1:8010/docs>。Windows 启动方式、环境变量、HRV 示例和稳定的 `/api/v1` 契约见 [`services/pigeon-backend/README.md`](./services/pigeon-backend/README.md)。

## Discussions 与共同开发

我们欢迎开发者、设计师、硬件创作者、研究者、故事创作者，以及所有认真思考记忆、死亡、关系与 AI 边界的人一起参与。

[GitHub Discussions](https://github.com/wujiajunhahah/loop/discussions) 是最适合开始交流的地方：

- 讨论产品场景与以关系为中心的交互；
- 探索 HRV、Physical AI、Alloop、Omi、BLE 和硬件方案；
- 研究有来源的检索、AI 信使说明、授权、隐私与安全；
- 分享界面、工业设计、CAD、文档和翻译建议；
- 在提出较大的代码或架构改动前，先对齐问题与边界。

我们也欢迎聚焦、清楚的 Issue 和 Pull Request。对于方向较大的改动，建议先发起 Discussion，让产品边界、技术上下文和现场演示保持一致。

请不要在公开的 Discussions、Issues 或 Pull Requests 中上传真实病历、私人家庭记忆、账号密钥、设备 Token 或其他敏感个人数据。

<p align="center">
  <a href="https://github.com/wujiajunhahah/loop/discussions"><img alt="发起 Discussion" src="https://img.shields.io/badge/发起_Discussion-打开_GitHub_Discussions-2c61d6?style=for-the-badge&logo=github&logoColor=white"></a>
</p>

## 团队

<p align="center">
  <img src="./docs/assets/team/wozai-team-physical-ai-hackathon-2026.jpg" alt="我在团队参加 2026 Physical AI Hackathon 的现场合影" width="100%" />
</p>

<p align="center"><em>一起在 2026 Physical AI Hackathon 现场创造「我在」的团队。</em></p>

## 产品边界

- 原始内容始终保留，AI 整理结果与记录者原话分开展示。
- 内容必须经过记录者确认，并按内容、关系逐段授权。
- HRV 只作为相对状态与呈现强度参考，不做医学或情绪诊断。
- AI 可以做检索、关联、分段和中性说明，但不能伪造新记忆、新承诺、新意志或记录者没说过的话。
- 接收者主动进入后才呈现内容，并可以延后、跳过、隐藏或永久关闭。
- 接收者的回应属于接收者，不会被反写成记录者的表达。

## 项目资料

- 官方网站：[www.wozai.space](https://www.wozai.space/)
- 概念短片：[在线观看](https://www.wozai.space/#story)
- UI 演示：[动态原型演示](./docs/assets/demo/wozai-ui-walkthrough.gif)
- 项目传单：[中文 PDF](https://www.wozai.space/assets/documents/wozai-flyer.zh-CN.pdf)
- 决赛路演 PPT：[Physical AI Hackathon 演示文稿](./docs/presentation/wozai-physical-ai-hackathon-final-pitch.pptx)
- 充电器 / 外壳模型：[Rhino 7 源文件](./docs/hardware/models/wozai-charger-model.rhino7.3dm)
- 文档导航：[`docs/README.md`](./docs/README.md)

## 联系

- 官网：[www.wozai.space](https://www.wozai.space/)
- Discussions：[github.com/wujiajunhahah/loop/discussions](https://github.com/wujiajunhahah/loop/discussions)
- 邮箱：[hello@wozai.space](mailto:hello@wozai.space)
