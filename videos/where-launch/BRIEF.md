---
workflow: product-launch-video
flow: automation
storyboard: no
message: "过去留下的真实记忆，能够在接收者主动靠近时回应今天的生活"
destination: website-demo
aspect: 1920x1080
language: zh-CN
audience: hackathon-judges
length: 45s
angle: "雨天母女关系闭环：真实记忆 -> 主动进入 -> 有来源的有限回应 -> 远方回信"
narration: no
style_preset: editorial-forest
---

## Intent

为 W·HERE 制作一版 45 秒黑客松产品宣传 Demo。它是产品宣传片，不是完整页面导览；使用当前真实应用界面证明产品闭环已经工作。基调温暖、安静、克制，不把产品描述为数字复活或人格克隆。

## Assets

- http://127.0.0.1:<runtime-port>/#/recipient — 当前 W·HERE 接收者体验，运行后以实际端口抓取。
- ../../05_PRODUCT_CONCEPT_W_HERE.md — 产品定位、Demo 故事和表达边界。
- ../../docs/VIDEO_WORKFLOW.md — 比赛视频叙事顺序与发布检查。

## Customizations

- 重点展示 Echo Map、真实原始来源、AI 生成明确标记、Context ID、`pull_only` 和接收者退出权。
- 使用应用自身的真实页面作为主要视觉资产，不重建虚构产品界面。
- 首版输出 16:9；9:16 版本留待主故事确认后重新排版。

## Notes

- 推荐叙事：`WHERE? -> HERE.` 品牌问题；Mei 留下经审核记忆；Lin 主动进入 Echo Map；雨天连接过去；来源与 AI 标记；远方回信收尾。
- 不使用数字永生、AI 复活、逝者养成、治愈哀伤或主动强情绪推送叙事。
- 所有生成内容必须表现为有来源、有授权、有边界、有标记。
- 自动化单版执行，不使用中途 storyboard review；最终渲染仍遵循预览确认门槛。
- 当前 HeyGen 未登录，且本地 Kokoro / MusicGen 未安装；首版采用无旁白、无配乐的屏幕文案版本。
- HyperFrames Chromium 无法在当前 Windows 环境启动，页面改由系统 Edge 从本地应用冻结为真实截图。
