# 我在｜记录者与接收视角体验原型

一个围绕「真实留下、逐段授权、有分寸地抵达」设计的双视角移动端 Web 原型。

妈妈是当前核心用户，负责留下照片、原文、原声与物件故事。原型中的“女儿体验端”现阶段首先用于让妈妈预览：自己的内容未来会怎样被找到、引用和使用，接收者拥有哪些打开、暂停、隐藏与回应选择。进入真实托付阶段后，这一视角才由被授权的接收者使用。

项目依据生命受限创作者版 PRD 与 [Figma 信息架构](https://www.figma.com/design/DEfUNVysNpAa54Okn8PSxc/Untitled?node-id=0-1&p=f) 构建。媒体、页面状态和演示数据主要保存在浏览器本地；接收视角中的信使交互、HRV 状态与反馈已接入独立 FastAPI 后端，并在后端不可用时安全降级。

## 接收视角（女儿体验端）信鸽后端集成

当前 `visual-prototype` 已将女儿端“交给信使”从浏览器本地关键词匹配改为稳定的后端 `/api/v1` 调用。前端只消费回信、证据、呈现模式和反馈选项，因此页面组件可以继续独立迭代。

先启动 [`../pigeon-backend/`](../pigeon-backend/README.md)，再在本目录运行前端。Windows 可以直接使用：

```powershell
.\run.cmd
```

macOS / Linux 或未使用脚本时：

```bash
pnpm install
pnpm dev
```

访问：<http://127.0.0.1:5174/>。进入“女儿体验端”并打开体验后，选择“交给信使”。局域网内可使用 `http://运行电脑的IP:5174/`。

前端默认按当前网页的主机名连接 8010 端口，也可以通过 `VITE_PIGEON_API_BASE_URL` 覆盖；示例见 `.env.example`。女儿端 MVP 目前只开放文字输入。

女儿主页还会读取 `GET /api/conversation/voice-diary/recent`，在收到 Alloop/Omi 的 `POST /api/conversation/voice-diary` 后显示最近音频块的大小、格式和接收时间。该状态只代表后端可靠接收，不代表已经转写或完成 AI 分析。

## 视觉预览

<table>
  <tr>
    <td align="center"><img src="./docs/images/creator-home.png" width="240" alt="妈妈端首页" /><br /><b>妈妈端首页</b></td>
    <td align="center"><img src="./docs/images/memory-library.png" width="240" alt="混合媒体记忆" /><br /><b>混合媒体记忆</b></td>
    <td align="center"><img src="./docs/images/pigeon-compose.png" width="240" alt="信鸽记录编辑器" /><br /><b>信鸽记录编辑器</b></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/images/daughter-home.png" width="240" alt="女儿端首页" /><br /><b>女儿端首页</b></td>
    <td align="center"><img src="./docs/images/daughter-memory.png" width="240" alt="女儿端记忆详情" /><br /><b>记忆与原始来源</b></td>
    <td align="center"><img src="./docs/images/daughter-reply.png" width="240" alt="女儿端信鸽回信" /><br /><b>女儿端信鸽回信</b></td>
  </tr>
</table>

## 双端交互

### 妈妈端：单向保存与授权

```text
首页浏览
  → 点击加号
  → 选择照片 / 原声 / 文字
  → 存草稿或交给信使
  → 自动回到首页并显示保存状态
  → 内容进入记忆并按授权留给女儿
```

妈妈端不需要等待回信，也不会出现「信使带回的一段记忆」或关联反馈。发送中的页面刷新会恢复进度，最终只入库一次。

当前能力：

- 首页动态统计照片、文字、声音、物件与愿望。
- 图片上传最大 12 MB，最长边压缩至 1280 px 并保存为 JPEG。
- 支持音频文件与最长 60 秒的浏览器录音。
- 支持独立采集页、草稿、本人确认与逐段授权。
- 记忆支持搜索、类型筛选与类型数量。
- 内置 23 项混合媒体演示内容：2 张照片、9 条文字、7 段声音、4 个物件和 1 个愿望。
- 详情页展示日期、场景、原始来源、故事和原声状态。
- 每段记忆可单独调整女儿可见性，以及「回应」「探索」权限。
- 可预览女儿真正会看到的版本。

### 接收视角：预览未来打开与关系往返

```text
进入女儿端内容首页
  → 在互动历史查看自己的上传与信鸽往返
  → 在下方记忆区看妈妈真实留下的内容
  → 从底部语音框说话，或上传照片、相册与文件
  → 把自己的内容保存到「我的」或随时退出
```

当前能力：

- 进入女儿端后直接看到内容首页。
- 首页按「互动历史 → 记忆 → 语音输入」组织，上传内容不再与妈妈的记忆混排。
- 底部常驻语音输入框，并提供拍摄、相册、图片/音频文件和文字入口。
- 首页输入与上传会直接交给信鸽并进入互动历史，不再弹出独立编辑层。
- 每段照片、文字或声音详情页都有上下文对话框，发送内容会优先绑定当前回忆。
- 原声通过播放器由女儿主动播放。
- L1「轻一点」与 L2「多些细节」会实际过滤内容。
- 只展示妈妈已确认且明确授权给林崖的记录。
- 写给信使的内容会通过 `/api/v1` 在妈妈的真实记录中寻找关联，并返回具体证据。
- 后端可使用 OpenAI 或确定性的本地演示模型；两种模式都经过输出校验，不生成妈妈没有说过的话。
- 支持「很相关」「不相关」「太重了」「不要再出现」「这不是她的意思」反馈。
- 可隐藏或恢复记忆、暂停主动出现、删除自己的记录。
- 「我的」保存女儿自己的话、轻行动、补充与关系反思，不会被改写成妈妈的内容。

## 视觉语言

| 层级 | 设计规则 |
| --- | --- |
| 基础色 | 米白纸张 `#f6f2eb` / `#fffdf8` |
| 主色 | 深蓝灰 `#263b43` / `#536b79` |
| 辅助色 | 鼠尾草绿、暖陶色，用于关系、授权和情绪提示 |
| 叙事字体 | `Songti SC` / `STSong`，用于标题、引文与故事正文 |
| 操作字体 | `PingFang SC` / `Microsoft YaHei` / `system-ui` |
| 界面质感 | 纸张卡片、手写标签、缝线、柔和阴影、圆角和半透明导航 |
| 动效 | 信鸽承担静候、交付、寻找和带回记忆的状态反馈 |

记忆卡按照片、文字、声音和物件使用不同模板。声音卡使用波形与多组氛围色，不重复套用同一张无关图片。设置中的「减少动态效果」会将动画与过渡降至最低。

## 前端实现

### 技术栈

- React 19
- TypeScript 5.9
- Vite 7
- 原生 CSS，无 UI 框架
- Canvas 图片压缩
- FileReader / Data URL 本地媒体保存
- MediaRecorder 浏览器录音
- 原生 `fetch` 对接 FastAPI `/api/v1`，失败时使用明确的无匹配降级结果
- 无 React Router、无状态管理库

### 页面状态

页面由 `src/App.tsx` 内的 `Page` 状态机切换：

| 角色 | 页面 |
| --- | --- |
| 妈妈端 | `creator`、`capture`、`library`、`detail`、`settings` |
| 女儿端 | `recipient`、`gallery`、`echo`、`seek`、`wish`、`you` |

妈妈和女儿使用独立信使通道：妈妈通道是单向保存，完成后回到 `idle`；女儿通道保留发送、带回、阅读、反馈和历史往返。

### 本地状态

| Storage Key | 内容 |
| --- | --- |
| `wozai-seeds-v1` | 妈妈记忆、授权与上传媒体 |
| `wozai-capture-draft-v1` | 独立采集页草稿 |
| `wozai-messenger-state-v2` | 双角色信使通道与发送状态 |
| `wozai-messenger-history-v1` | 信使历史兼容数据 |
| `wozai-messenger-drafts-v1` | 双角色未发送草稿 |
| `wozai-recipient-data-v1` | 女儿接收设置、会话、浏览、隐藏、记录与反思 |
| `wozai-quiet-mode` | 减少动态效果 |
| `wozai-setting-*` | 智能整理、面容解锁演示与提醒频率 |
| `wozai-current-page-v1` | 当前页面，保存在 `sessionStorage` |

主要数据监听 `storage` 事件以支持同源多标签页同步。图片和音频以 Data URL 保存在浏览器本地；清理站点数据会删除用户新增内容。正式产品需要替换为鉴权、数据库和对象存储。

### 响应式与可访问性

- 大于 820 px：310 px 产品导航侧栏 + 430 px 手机设备框。
- 小于等于 820 px：移动端全屏 `100dvh`。
- 使用 `env(safe-area-inset-*)` 适配刘海屏和底部安全区。
- 对 390 px 以下宽度以及 950、720、480 px 以下高度做额外布局适配。
- 移动端主要操作控件约为 44 px 点击高度。
- 提供键盘 `focus-visible` 轮廓和常用 ARIA 状态。

## 视觉素材

```text
public/assets/
├── figma/    # 首页、记忆、信鸽流程的参考图与裁切源图
├── mascot/   # profile、delivering、returning-letter、idle、writing 信鸽透明素材
└── demo/     # 西湖家庭照、雨天道路、手写笔记与织物纹理
```

`writing.webp` 已保留但当前页面尚未接入，其余信鸽状态均已使用。网页中新上传的媒体保存在浏览器本地，不会写入 `public/assets/`。

## 目录结构

```text
.
├── docs/images/       # README 当前版本界面截图
├── public/assets/     # Figma、信鸽与记忆示例素材
├── src/
│   ├── App.tsx        # 数据模型、页面、双端流程与交互状态
│   ├── api/pigeon.ts  # 信鸽交互、HRV、语音接收状态与反馈契约
│   ├── main.tsx       # React 入口
│   └── styles.css     # 视觉系统、组件与响应式规则
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig*.json
└── vite.config.ts
```

## 本地运行

环境建议：Node.js 20.19+，pnpm 9+。

```bash
pnpm install
pnpm dev
```

生产构建与预览：

```bash
pnpm build
pnpm preview
```

开发服务绑定 `127.0.0.1`，端口以终端输出为准。

## 原型边界

- 信使交互与设备状态已有独立后端；媒体资产、账号体系、云备份和真实面容解锁仍未产品化。
- 演示声音卡没有对应音频文件时，只展示播放器状态并明确标注。
- 确定性本地模型只用于离线演示，不等同于完整的长期个性化检索。
- HRV 只影响轻柔/标准呈现与 outcome 记录，不解释为具体情绪或医学结论。
- AI 整理后的故事必须保留原始来源，并由记录者确认后才能交付。
