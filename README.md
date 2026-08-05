# 我在（Wozai）

> 真实地留下，交给对的人，在未来有分寸地出现。

「我在」是一款以生命记录与关系托付为核心的情感陪伴产品。它帮助仍在生活中的记录者，用原声、影像、照片与文字留下真实的自己，亲自确认内容将给谁、如何出现、可以怎样使用；它不是数字复活，也不让 AI 代替任何人继续说话。

<p>
  <a href="https://www.wozai.space/"><strong>访问官方网站</strong></a>
  ·
  <a href="https://www.wozai.space/#story">观看 46 秒概念短片</a>
  ·
  <a href="https://www.wozai.space/assets/documents/wozai-flyer.zh-CN.pdf">查看宣传传单</a>
  ·
  <a href="./docs/README.md">阅读项目文档</a>
  ·
  <a href="./visual-prototype/README.md">查看交互原型</a>
</p>

<a href="https://www.wozai.space/">
  <img src="./landing/assets/og-cover.png" alt="我在——把想说的话，好好留下" width="100%" />
</a>

## 先从官网认识「我在」

[www.wozai.space](https://www.wozai.space/) 是项目当前最完整的公开入口，集中说明：

- 为什么要在还来得及的时候留下生命故事；
- 记录者如何保存原始内容、逐段确认并按关系授权；
- 接收者未来如何主动打开、暂停、跳过或关闭；
- AI 可以整理什么、不能代替人表达什么；
- 产品如何让每一次呈现都能回到真实来源。

官网同时提供[中英双语页面](https://www.wozai.space/en/)、[项目宣传传单](https://www.wozai.space/assets/documents/wozai-flyer.zh-CN.pdf)、共创订阅，以及一支明确标注为 AI 生成、并非功能录屏的[项目概念短片](https://www.wozai.space/#story)。官网源码与内容维护说明见 [`landing/`](./landing/README.md)。

## 用户与双视角

当前产品首先服务于仍在生活中的记录者，例如希望在有限时间里梳理生命内容、关系和托付方式的妈妈。

原型中的“女儿体验端”不是另一个独立获客端。现阶段它首先是一扇给记录者看的窗口：妈妈可以提前理解自己的内容会怎样抵达、接收者拥有什么选择、自己的生命资产将怎样产生关系价值，因此更安心地记录与授权。未来进入真实托付阶段后，同一套接收视角才由被授权的人主动使用。

```text
记录者留下原始内容
  → 本人确认与逐段授权
  → 从接收视角预览未来呈现
  → 调整内容、权限与托付方式
  → 未来由接收者自主打开
```

## Physical AI Hackathon：我们怎样扣题

本项目参加香港 Physical AI Hackathon 的 alloop 智能戒指赛道，选择“以人为本 / 人的状态识别与主动支持”。我们没有把完整产品硬改成健康管理工具，而是截取一条可以现场演示的垂直链路：**让生命记忆的对话与呈现，根据人的当下负荷变得更有分寸。**

Alloop 的 HRV 在这里是辅助状态信号，不用于诊断情绪，也不用于判断哪段记忆“更重要”。系统把它与用户的主动反馈放在一起，完成以下闭环：

| 闭环阶段 | 在「我在」中的实现 |
| --- | --- |
| 感知 | 接收 Alloop HRV 读数，以及用户在信使中的文字/语音交互 |
| 理解 | 从记录者已经确认的内容中寻找有证据的关联；HRV 只影响当次呈现强度 |
| 反馈 | 根据状态采用轻柔或标准模式，返回可追溯的原话与中性信使说明 |
| 改善 | 收集“很相关、太重了、不要再出现、这不是她的意思”等主观反馈，并结合交互前后 HRV 结果调整后续策略 |

这里的“学习”是学习**什么情境下适合检索哪类真实内容、以多大强度呈现**，不是学习生成更多“妈妈会说的话”。当前后端已经实现 HRV 分档、交互前后结果记录，以及“太重了 / 隐藏 / 只看原文”等安全偏好；基于正向结果提升相似情境排序，是下一步明确的策略扩展。

更完整的赛题对齐、AI 边界与演示口径见 [`docs/hackathon/alloop-track-alignment.md`](./docs/hackathon/alloop-track-alignment.md)。

## 当前可演示的内容

| 模块 | 当前状态 | 说明 |
| --- | --- | --- |
| 官方网站 | 可公开访问 | 产品定位、关系托付、边界、FAQ、共创入口与概念短片 |
| 双视角交互原型 | 可本地运行 | 记录、确认、授权、接收视角预览、信使交互与反馈 |
| 信鸽后端 | 已接入原型 | 稳定 `/api/v1`、有来源的回信、HRV 呈现策略、反馈与 outcome |
| Alloop / Omi 输入 | 接口与演示链路已具备 | HRV 上报、语音分块接收与最近接收状态；真实设备联调需在现场网络复验 |
| 充电器硬件模型 | 已提交 Rhino 7 源模型 | 毫米单位的可编辑 `.3dm` 文件；制造与装配仍需实物验证 |
| AI 概念短片 | 已进入官网 | 46 秒母女与信鸽叙事，用于表达产品愿景，不作为功能 Demo |

## 仓库导航

```text
.
├── landing/            # wozai.space 官方网站与概念短片
├── visual-prototype/   # 记录者端 + 接收视角高保真原型
├── pigeon-backend/     # FastAPI 信鸽交互、HRV、反馈与 outcome
├── app/                # Alloop Kit Flutter / BLE 起始工程
├── omi_simple/         # Omi 语音分块转发示例
├── src/                # Relationship Agent / 权限策略 Software MVP
├── ios/                # Capacitor iOS 工程
└── docs/               # Hackathon、产品、硬件文档与充电器 CAD 模型
```

建议按以下顺序阅读：

1. [官方网站](https://www.wozai.space/)：先理解产品。
2. [`docs/README.md`](./docs/README.md)：区分官网事实、当前实现与产品愿景。
3. [`visual-prototype/README.md`](./visual-prototype/README.md)：了解现场交互。
4. [`pigeon-backend/README.md`](./pigeon-backend/README.md)：了解 AI、HRV 与反馈契约。
5. [`docs/hardware/architecture.md`](./docs/hardware/architecture.md)：了解设备与软件边界。
6. [`docs/hardware/models/README.md`](./docs/hardware/models/README.md)：查看充电器 Rhino 7 模型与几何信息。

## 本地体验

官网无需安装前端依赖：

```bash
cd landing
python3 -m http.server 4173
```

高保真原型：

```bash
cd visual-prototype
pnpm install
pnpm dev
```

信鸽后端的启动、环境变量和接口示例见 [`pigeon-backend/README.md`](./pigeon-backend/README.md)。

## 产品边界

- 原始内容始终保留，AI 整理结果与记录者原话分开展示。
- 内容必须经过记录者确认，并按关系与内容逐段授权。
- HRV 只作为相对状态与呈现强度参考，不做医学或情绪诊断。
- AI 可以做检索、关联、分段和中性说明，但不能伪造新记忆、新承诺或新意志。
- 接收者主动进入后才呈现内容，并可以延后、跳过、隐藏或永久关闭。
- 接收者的回应属于接收者，不会被反写成记录者的表达。

## 联系

- 官网：[www.wozai.space](https://www.wozai.space/)
- 邮箱：[hello@wozai.space](mailto:hello@wozai.space)
