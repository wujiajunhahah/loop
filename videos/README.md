# W·HERE 视频索引

## 当前交付

| 项目 | 路径 | 说明 |
| --- | --- | --- |
| 45 秒宣传片 | `where-launch/renders/where-launch-demo.mp4` | 1920x1080、中文、无旁白产品 Demo |
| 视频源工程 | `where-launch/` | 独立 HyperFrames composition |
| 叙事 brief | `where-launch/BRIEF.md` | 受众、时长、角度和边界 |
| 分镜 | `where-launch/STORYBOARD.md` | 场景和节奏依据 |
| 审查帧 | `where-launch/snapshots/` | 关键帧与 contact sheet |

该目录不是另一个 W·HERE 应用版本。`where-launch` 只负责从真实产品截图和 HTML composition 生成宣传视频。

## 源文件与生成物

- 保留：`index.html`、`compositions/`、`assets/`、`BRIEF.md`、`STORYBOARD.md`、`frame.md`、`hyperframes.json`、`meta.json`。
- 当前交付：`renders/where-launch-demo.mp4`。
- 审查证据：`snapshots/`、`capture/`、`capture-edge/`。
- 可重新生成并已忽略：`.hyperframes/`、`.thumbnails/`、draft render。

## 命令

在 `videos/where-launch/` 中运行：

```bash
npm run dev
npm run check
npm run render
```

项目当前固定使用 `hyperframes@0.7.88`，以保证已有 composition 可重复渲染。修改或重新渲染前应先按 HyperFrames 工作流检查版本兼容性。
