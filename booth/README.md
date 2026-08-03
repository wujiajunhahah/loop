# W·HERE Booth Banner

展位立牌规格为 `750 x 2000 mm`，对应官方模板的 `3:8` 比例。所有设计内容保持在约 56 mm 的横向安全区内。

## 当前交付版本

**V8 - Strict Official Template** 是当前权威版本。提交打印或比赛材料时只使用下列文件：

| 用途 | 文件 |
| --- | --- |
| 可编辑矢量源 | `loop-booth-banner-v8.svg` |
| 打印包装页面 | `loop-booth-banner-v8.html` |
| 打印 PDF | `loop-booth-banner-v8.pdf` |
| 屏幕预览 | `loop-booth-banner-v8-preview.png` |
| 人物矢量资源 | `avatars/` |

V8 固定官方顶部 `0–280 mm` 区域，将底部圆形图案起点保持在约 `1680 mm`，W·HERE 内容只出现在中间深蓝区域。除非明确开始 V9，不覆盖这些文件。

## 目录规则

当前文件因历史导出和相对资源引用暂时保留在同一目录。新增版本遵循以下规则：

1. 新设计使用带版本号的同名四件套：`svg`、`html`、`pdf`、`preview.png`。
2. 只有 README“当前交付版本”中列出的 PDF 可以发送打印。
3. 带 `final`、`team` 的历史文件仍是历史导出，不自动比当前版本更新。
4. HTML 和 SVG 引用 `avatars/`；移动文件前必须同时验证所有相对路径和打印输出。
5. 临时截图、浏览器下载和无版本号的新导出不继续加入本目录。

后续确需物理归档时，目标结构如下；应在一次独立改动中移动并验证，不与产品源码修改混在一起：

```text
booth/
├── current/             当前 SVG、HTML、PDF 和 preview
├── archive/v2...v7/     历史版本
├── assets/avatars/      团队头像
└── README.md            权威交付索引
```

## 历史版本索引

| 版本 | 定位 | 主要文件 |
| --- | --- | --- |
| Base / V2 | 产品优先的早期远距离阅读版本 | `loop-booth-banner.*`、`loop-booth-banner-v2-*` |
| V3 | Tender Provenance 关系观测图 | `loop-booth-banner-v3-*`、`loop-booth-v3-philosophy.md` |
| V4 | V2 Refined | `loop-booth-banner-v4-*` |
| V5 | W·HERE 品牌概念与 `WHERE? → HERE.` | `loop-booth-banner-v5-*` |
| V6 | `当我还在 / 勿忘我 / 为了你` 叙事 | `loop-booth-banner-v6-*` |
| V7 | Life, Death, and Context | `loop-booth-banner-v7-*` |
| V8 | 严格遵循官方上下模板边界 | `loop-booth-banner-v8-*` |

V2–V7 仅用于追溯设计演变，不应标记为 current，也不应在未比较 V8 的情况下发送给打印方。
