# W·HERE 比赛视频工作流

这份文档用于在开发 W·HERE 的同时持续生成宣传素材，避免在提交前才集中录屏和剪辑。视频统一使用 [HyperFrames](https://github.com/heygen-com/hyperframes)：以 HTML 组织画面，通过确定性时间轴预览并渲染 MP4。

[返回 README](../README.md) · [AI Skills](AI_SKILLS.md) · [视频工作区](../videos/README.md) · [产品理念](../05_PRODUCT_CONCEPT_W_HERE.md)

## 推荐组合

| Skill | 用途 | 建议时机 | 典型时长 |
| --- | --- | --- | --- |
| `$motion-graphics` | 标题、功能揭晓、数据点、竖屏短片 | 每完成一个核心功能 | 5–10 秒 |
| `$pr-to-video` | 从 GitHub PR 生成 changelog 或功能讲解 | 每个重要 PR 合并前后 | 20–70 秒 |
| `$product-launch-video` | 从真实应用页面生成产品宣传片或站点导览 | 每个可演示里程碑 | 30–90 秒 |

主宣传片优先让 `$hyperframes` 路由到 `product-launch-video`。`motion-graphics` 负责短素材，`pr-to-video` 负责保留开发进度，不要为同一个视频混用多个主工作流。

## 环境要求

- Node.js 22 或更高版本。
- FFmpeg 可在终端直接调用。
- OpenCode 已加载 HyperFrames Skills。新安装 Skill 后，新开一个 OpenCode 窗口即可，无需关闭原窗口。
- 产品视频开始前，先运行 W·HERE，并确认实际端口。

```powershell
node --version
ffmpeg -version
npx hyperframes --version
npm run dev
```

当前机器已验证 Node.js 24、FFmpeg 8 和 HyperFrames CLI `0.7.88` 可用。

## 一次性安装或更新

Skills 来源是 HeyGen 官方 HyperFrames 仓库。需要重新安装或刷新时，在任意目录运行：

```powershell
npx hyperframes skills update product-launch-video
npx hyperframes skills update motion-graphics
npx hyperframes skills update pr-to-video
```

Skill 具备下载媒体、执行 FFmpeg 和调用外部服务的权限。使用前检查素材来源，不在提示词、项目文件或视频中放入 API Key、私人数据和未获授权的媒体。

## 比赛期间节奏

1. **功能完成时**：生成一条 5–10 秒功能短片，保留真实界面和一句核心价值。
2. **重要 PR 完成时**：生成一条变更视频，记录功能、前后差异和用户影响。
3. **每天结束前**：把当天可用片段、截图和文案放进对应的 `videos/<project>/`。
4. **演示闭环稳定后**：从正在运行的 W·HERE 页面生成 45–60 秒主宣传片。
5. **提交前**：只做文案、节奏和版式修订，不再临时重建整条视频。

## 生成产品主宣传片

先运行 W·HERE，再在新的 OpenCode 窗口中输入：

```text
$hyperframes
路由到 product-launch-video。
为正在运行的 W·HERE 制作一条 45 秒黑客松产品宣传片。
使用实际页面，不重建虚构界面。突出 Echo Map、真实来源、接收者主动权和离线体验。
先输出 16:9 主版本，再基于同一故事输出 9:16 短版本。
```

把实际地址补充给工作流，例如：

```text
产品地址：http://127.0.0.1:5174/#/recipient
```

推荐叙事顺序：

1. `WHERE? → HERE.` 品牌问题。
2. Mei 留下经过审核的真实记忆。
3. Lin 主动进入 Echo Map，而不是被系统推送。
4. 今天的雨与过去的叮嘱建立联系。
5. 展示 Original source、AI-generated 和 Context ID。
6. 以远方回信和“过去的记忆，回应现在的生活”收尾。

工作流会先建立 brief、抓取页面、生成 storyboard，再进入 HTML composition。Storyboard 和最终预览是两个不同的确认点；最终预览未确认前不渲染正式文件。

## 生成功能短片

适合 X、LinkedIn、Instagram、Shorts 或比赛现场大屏：

```text
$hyperframes
路由到 motion-graphics。
为 W·HERE 的 Echo Map 做一条 8 秒 9:16 功能揭晓短片。
使用真实产品截图；只展示节点点亮、来源标签和一句“过去的记忆，回应现在的生活”。
无旁白，动作克制，结尾保留品牌标识。
```

一条短片只讲一个功能或一个证据，不要把完整产品介绍压进 10 秒。

## 从 PR 生成进度视频

PR 必须存在于 GitHub，并且本机 `gh` 已登录：

```text
$hyperframes
路由到 pr-to-video。
把 owner/repo#123 做成面向非技术评委的 35 秒功能揭晓视频。
重点说明用户以前无法完成什么、这次新增了什么、真实界面如何证明它已经工作。
```

该工作流读取 PR、diff、提交和文件列表，不会把仓库页面当作产品网站抓取。没有 PR 时使用 `$motion-graphics`，不要虚构变更记录。

## 项目目录约定

所有视频项目放在仓库根目录的 `videos/` 下：

```text
videos/
└── where-launch/
    ├── BRIEF.md              已确认目标、受众、时长和画幅
    ├── STORYBOARD.md         分镜和画面资产选择
    ├── SCRIPT.md             旁白或屏幕文案（需要时）
    ├── frame.md              视觉系统
    ├── hyperframes.json      项目配置
    ├── capture/              页面抓取和来源材料
    ├── assets/               已冻结的本地媒体
    ├── compositions/         HTML 画面与总时间轴
    └── renders/              草稿和最终输出
```

一个视频目标对应一个目录，例如 `where-launch`、`echo-map-reveal`、`pr-123-feature`。不要把视频文件散放到仓库根目录，也不要把视频素材放进 `src/assets/`；后者属于产品运行时资源。

建议提交 `BRIEF.md`、`STORYBOARD.md`、`SCRIPT.md`、`frame.md`、`hyperframes.json` 和 compositions。大型 capture、音视频资产及 renders 是否进入 Git，按许可证和仓库容量单独决定。

## 检查、预览与渲染

工作流通常会自动执行这些步骤。手动检查时，在具体视频项目目录运行：

```powershell
npx hyperframes check
npx hyperframes preview
```

在最终预览确认后再渲染：

```powershell
npx hyperframes render --quality draft --output renders/draft.mp4
npx hyperframes render --quality high --output renders/video.mp4
ffprobe -v error -show_format renders/video.mp4
```

`check` 必须通过，但通过不等于视觉已经获批。必须检查桌面和竖屏画幅中的文字溢出、真实界面清晰度、字幕、品牌标识、音量和最后一帧。

## 发布前检查

- 视频中的产品行为与当前 Demo 一致，不展示尚未实现的功能。
- 明确区分本人原始内容、接收者内容和 AI 生成内容。
- 不把 W·HERE 描述成数字复活、人格克隆或主动情绪推送。
- 真实来源、关系范围、`pull_only` 和接收者退出权没有被宣传文案弱化。
- 音乐、图片、字体、Logo 和人物素材具备可用授权与来源记录。
- 旁白和字幕无 API Key、私人地址、真实账号或内部评审信息。
- 16:9 与 9:16 分别检查，不用简单裁切代替重新排版。
- 最终 MP4 可播放、时长合理、无黑帧，并保留一个无旁白版本作为现场备用。

## 故障处理

| 问题 | 处理方式 |
| --- | --- |
| Skill 在当前窗口不可见 | 新开 OpenCode 窗口并重新打开本项目 |
| 页面抓取失败 | 确认开发服务器和实际端口；不要使用失败抓取中的残缺素材 |
| 本地地址无法访问 | 使用终端显示的地址，不假定一定是 `5173` |
| 没有云端登录 | 选择 offline，继续使用本地可用引擎；不要把密钥写进仓库 |
| HTML 检查失败 | 先修复 `npx hyperframes check`，再打开最终预览 |
| 渲染太慢 | 用 draft 迭代，只对批准版本执行 high-quality render |

HyperFrames 的官方备用方案是 [Remotion Agent Skills](https://github.com/remotion-dev/skills)。除非 HyperFrames 遇到无法解决的兼容问题，不在比赛中途切换框架。
