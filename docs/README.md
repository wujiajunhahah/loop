# 「我在」项目文档导航

本目录把产品愿景、Hackathon 垂直 Demo 和当前代码实现分开描述，避免把长期规划误写成已经完成的功能。

## 三层事实

| 层级 | 回答的问题 | 主要入口 |
| --- | --- | --- |
| 官方产品表达 | 「我在」是谁、为谁服务、坚持什么边界 | [官方网站](https://www.wozai.space/) / [根 README](../README.md) |
| Hackathon 垂直切片 | Alloop 戒指、HRV、对话与反馈如何构成闭环 | [赛题对齐说明](./hackathon/alloop-track-alignment.md) |
| 当前实现 | 哪些界面、接口和设备通路今天可以运行 | [视觉原型](../visual-prototype/README.md) / [信鸽后端](../pigeon-backend/README.md) |

阅读任何方案时，建议先确认它属于“已实现”“可用模拟数据演示”“现场待联调”还是“产品愿景”。

## Hackathon

- [`hackathon/alloop-track-alignment.md`](./hackathon/alloop-track-alignment.md)：主题一“以人为本”的扣题逻辑、HRV 定义、AI 学习边界和现场 Demo 口径。
- [`hardware/architecture.md`](./hardware/architecture.md)：戒指、手机、后端与前端的系统关系。
- [`hardware/support-matrix.md`](./hardware/support-matrix.md)：不同硬件输入的支持范围。
- [`hardware/smart-ring.md`](./hardware/smart-ring.md)：智能戒指接入说明。
- [`hardware/omi.md`](./hardware/omi.md)：Omi 语音输入通路。
- [`hardware/ios-validation.md`](./hardware/ios-validation.md)：iOS 验证记录。

## 产品与体验

- [`product/guided-collection-spec.md`](./product/guided-collection-spec.md)：引导式生命内容采集规范。
- [`product/loop-core-personas-dual-stage-one-day-mock.zh-CN.md`](./product/loop-core-personas-dual-stage-one-day-mock.zh-CN.md)：双阶段人物与单日体验样例。
- [`product/loop-creator-data-mock-v2.json`](./product/loop-creator-data-mock-v2.json)：创作者模拟数据。
- [`../visual-prototype/README.md`](../visual-prototype/README.md)：记录者端与接收视角预览的页面、状态和交互。

## 代码模块

- [`../landing/README.md`](../landing/README.md)：官方网站内容与维护方式。
- [`../pigeon-backend/README.md`](../pigeon-backend/README.md)：FastAPI 契约、HRV 分档、信使回信和反馈 outcome。
- [`../app/README.zh-CN.md`](../app/README.zh-CN.md)：Alloop Kit Flutter / BLE 起始工程。
- [`../HRV_INTEGRATION.md`](../HRV_INTEGRATION.md)：Software MVP 的 HRV 集成说明。

## 统一术语

- **记录者 / 创作者**：仍在生活中、记录并授权自己生命内容的人，是当前核心用户。
- **接收视角预览**：原型中的“女儿端”在当前阶段首先供记录者理解未来呈现与使用方式。
- **接收者**：未来被明确授权、并自主决定是否打开内容的人。
- **原始内容**：记录者亲自留下的声音、文字、照片、视频或物件故事。
- **信使说明**：AI 生成的中性组织文字，必须与记录者原话清楚区分。
- **学习**：调整检索、排序和呈现强度；不修改原始内容，也不学习替记录者创造新表达。
