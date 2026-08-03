# Loop AI Skills 使用指南

本项目把前端设计、产品质量和宣传视频拆成不同阶段。Skill 是工作方法，不是越多越好；每个阶段只指定一个主 Skill，其他 Skill 只负责复核。

[返回 README](../README.md) · [产品自迭代 Loop](../.loop/autonomous/README.md) · [Demo Runbook](DEMO_RUNBOOK.md) · [比赛视频工作流](VIDEO_WORKFLOW.md)

## 已安装 Skill

| Skill | 主要能力 | 本项目用途 | 来源与许可证 |
| --- | --- | --- | --- |
| `$frontend-design` | 选择明确视觉方向并实现完整前端体验 | 日常视觉实现和页面打磨 | Anthropic，Apache-2.0 |
| `$oil-frontend` | 用户任务、数据源、状态边界、组件归属和旧逻辑清理 | 产品前端实现与重构的工程主 Skill | [oil-oil/oil-frontend](https://github.com/oil-oil/oil-frontend)，MIT |
| `$oiloil-ui-ux-guide` | 设计系统访谈、页面规则和 P0/P1/P2 UI/UX 审查 | 里程碑审查；现阶段默认使用 `review` | [oil-oil/ui-ux-guide](https://github.com/oil-oil/ui-ux-guide)，Apache-2.0 |
| `$hallmark` | 主题与宏结构选择、反 AI 味检查、截图或 URL 设计 DNA 提取 | 视觉方向研究和无修改审计 | [Nutlope/hallmark](https://github.com/Nutlope/hallmark)，MIT |
| `$impeccable` | 产品/品牌模式、59 条确定性检测、响应式/边界强化、最终 polish | 比赛交付前的可重复质量门 | [pbakaus/impeccable](https://github.com/pbakaus/impeccable)，Apache-2.0 |
| Superpowers 精简工程包 | 系统化调试、完成前验证、独立代码审查 | 所有功能、bugfix 和重大重构的代码质量门 | [obra/superpowers](https://github.com/obra/superpowers)，MIT |
| `$webapp-testing` | Playwright 本地页面操作、截图、浏览器日志和交互验收 | 现场 Demo 的真实浏览器路径和视口回归 | [anthropics/skills](https://github.com/anthropics/skills)，Apache-2.0 |
| `$hyperframes` | HTML 时间轴、分镜、媒体、预览和 MP4 渲染 | 所有视频需求的统一入口 | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) |

Hallmark、Oil Frontend、OilOil UI/UX Guide、Superpowers 精简工程包和 `webapp-testing` 已由 `skills` CLI 复制到项目级 `.agents/skills/`，来源与哈希记录在 `skills-lock.json`。Impeccable 同时安装到 `.agents/skills/impeccable/` 和 `.opencode/skills/impeccable/`。`frontend-design` 位于 `.opencode/skills/frontend-design/`。

Impeccable 安装器同时检测到项目级 Codex，并生成 `.codex/hooks.json`。该 hook 在 Codex 编辑 UI 后运行 detector，只报告问题、不修改代码；首次使用 Codex 打开本项目时，需要在 `/hooks` 中检查并批准。OpenCode 只加载 Skill，不执行这份 Codex hook。

新装或更新 Skill 后需要新开 OpenCode 窗口，当前窗口不会热加载配置期文件。

## 选择规则

### 实现功能或修复代码

Superpowers 只安装三个与 Loop 兼容的工程 Skill，没有安装它的全局 bootstrap、强制 brainstorming/TDD、自动 worktree 或分支收尾。

| Skill | 触发时机 | 在 Loop 中的作用 |
| --- | --- | --- |
| `$systematic-debugging` | bug、测试失败、构建失败或行为异常 | 先复现、检查近期改动、追踪数据流和根因，再做一个最小修复 |
| `$verification-before-completion` | 准备声称任务完成、修复成功或测试通过 | 运行能证明声明的完整新鲜命令，读取退出码和失败数量后再报告 |
| `$requesting-code-review` | 完成重大功能、复杂 bugfix 或准备集成 | 给独立 reviewer 精确的需求和 diff 范围，按 Critical/Important/Minor 处理发现 |

调试调用示例：

```text
使用 $systematic-debugging 调查 Echo Map 刷新后状态异常。
先稳定复现并追踪 JourneySession 和 hash route 的数据流；没有根因证据前不要改代码。
```

完成前验证：

```text
使用 $verification-before-completion 检查当前 TASK。
根据 acceptance criteria 选择完整命令，至少运行 npm run verify 和 git diff --check；只报告本轮实际输出。
```

重大改动代码审查：

```text
使用 $requesting-code-review 审查当前 TASK 相对 base commit 的 diff。
只提供任务要求、BASE_SHA、HEAD_SHA 和修改说明，不把实现窗口的结论灌输给 reviewer。
```

Superpowers 的原始说明有“所有 bugfix 必须先写失败测试”等强制规则。Loop 采用风险相称的测试策略：可稳定自动化的回归必须补测试；纯 CSS、浏览器差异或外部环境问题可以使用可复现 smoke evidence，不能为了满足形式写脆弱测试。

### 实现或修改产品界面

主 Skill：`$oil-frontend`。

它先确认用户任务、业务对象、权威数据源、状态作用域和代码归属，再处理页面、组件、Hook、类型和 CSS。W·HERE 的关系隔离、来源追踪、`pull_only`、offline adapter 和 hardware fallback 都是产品约束，不是应被自动删除的 legacy。

```text
使用 $oil-frontend 改进接收者身份确认流程。
保留 relationship scope、pull_only 和现有离线 fallback；先确认权威数据源和状态边界，再修改代码并补测试。
```

需要视觉实现时，同一任务再使用 `$frontend-design`，但不允许它重写已确定的产品流程。

```text
使用 $frontend-design 在现有设计语言内打磨 Echo Map。
保持当前信息架构、路由、真实来源标签和退出能力，只改视觉层与交互反馈。
```

### 评审现有页面

主 Skill：`$oiloil-ui-ux-guide` 的 `review` 模式。它输出 P0/P1/P2 问题、证据、修复和验收点，不直接强加新风格。

```text
使用 $oiloil-ui-ux-guide 的 review 模式审查 #/recipient/echo-map。
目标用户是第一次接触产品的黑客松评委；主任务是在两分钟内理解真实来源、接收者主动权和 postcard 结果。
输出 P0/P1/P2 清单，不修改代码。
```

只有明确决定重做设计系统时才使用其 `design` 模式。当前 W·HERE 已有品牌、页面和 CSS，不把普通页面调整升级成全局 design-system 访谈。

### 检查“AI 味”或研究参考

Hallmark 默认用于审计，不作为全局自动生成器。

```text
使用 $hallmark audit 审查 src/features/journey 和首页。
只输出有文件证据的 ranked punch list，不修改代码，不改变产品文案和信息架构。
```

从合法参考中提取设计 DNA：

```text
使用 $hallmark study <截图或公开 URL>。
提取宏结构、字体角色、颜色锚点和组件语言；不要复制像素、付费模板或品牌资产。
```

Hallmark 的主题和宏结构适合新页面或明确 redesign。它要求的某些状态和排版规则较绝对；当它与真实产品任务、现有设计系统或可访问性事实冲突时，不执行该条建议。

### 比赛交付前检查

Impeccable 用于最后的确定性检查和有限修订：

```text
$impeccable critique #/recipient/echo-map
$impeccable audit src/
$impeccable harden recipient flow
$impeccable adapt recipient flow
$impeccable polish recipient flow
```

命令职责：

| 命令 | 作用 |
| --- | --- |
| `critique` | 评审层级、清晰度、认知负担和情绪表达 |
| `audit` | 检查响应式、可访问性、性能和技术质量 |
| `harden` | 补齐溢出、错误、边界和异常状态 |
| `adapt` | 检查移动端和不同视口 |
| `polish` | 在功能稳定后做一次最终一致性修订 |
| `live` | 浏览器中选择元素并比较视觉变体 |

Impeccable 明确要求有限检查：桌面与移动端批量检查一次、集中修复一次、最多再确认一次，然后停止。不要把 `polish` 变成无限循环。

CLI 确定性扫描可以单独运行：

```powershell
npx impeccable detect src/
npx impeccable detect --json src/
```

### 制作宣传视频

任何视频请求先进入 `$hyperframes`，由它选择 `$product-launch-video`、`$motion-graphics` 或 `$pr-to-video`。完整流程见 [比赛视频工作流](VIDEO_WORKFLOW.md)。

### 浏览器验收

`$webapp-testing` 用于真实本地浏览器的 reconnaissance → action：等待 `networkidle`，读取渲染后的 DOM，执行用户动作，保存失败截图和浏览器日志。它是浏览器证据工具，不替代 Vitest、typecheck 或 build。

```text
使用 $webapp-testing 验收 W·HERE 两分钟 judge path。
服务器已运行在 http://127.0.0.1:5174；检查 1440x1000 和 390x844，覆盖身份确认、Echo Map、来源展示和 postcard。
失败时保存 screenshot/trace，成功时不要生成临时资产。
```

## 黑客松推荐顺序

```text
产品任务和状态正确性
  $oil-frontend
        ↓
代码根因、验证与独立审查
  $systematic-debugging → $verification-before-completion
  重大改动再用 $requesting-code-review
        ↓
现有设计语言内实现
  $frontend-design
        ↓
里程碑 UI/UX 审查
  $oiloil-ui-ux-guide review
        ↓
反 AI 味只读检查
  $hallmark audit
        ↓
响应式、边界和最终质量门
  $impeccable audit → harden/adapt → polish
        ↓
真实浏览器 judge path
  $webapp-testing
        ↓
真实页面生成宣传视频
  $hyperframes
```

不要在同一轮让 Hallmark、Impeccable 和 Frontend Design 同时重新设计页面。审计输出先进入一个有范围的 `.loop/tasks/TASK-*.md`，下一轮只修最重要的一组问题。

## 冲突优先级

出现规则冲突时，按下面顺序处理：

1. W·HERE 产品边界、隐私、来源、关系隔离和接收者控制权。
2. 当前任务的 acceptance criteria 和 allowed files。
3. `.loop` 的 claim、并发所有权、预算和停止条件。
4. 现有应用行为、路由、测试与 design tokens。
5. Superpowers 精简工程包的根因、验证和审查纪律。
6. Oil Frontend 的任务、状态和代码归属规则。
7. 当前阶段指定的主设计 Skill。
8. 其他 Skill 的审计建议。

任何 Skill 都不能自行新增事实、用户评价、使用人数、转化率、真实 AI/媒体/硬件能力，也不能把 mock 或 offline Demo 描述为生产能力。

## 更新与验证

更新通过 `skills` CLI 安装的三个 Skill：

```powershell
npx skills update hallmark oil-frontend oiloil-ui-ux-guide systematic-debugging verification-before-completion requesting-code-review webapp-testing --project -y
```

更新 Impeccable：

```powershell
npx impeccable update --providers=opencode,codex --scope=project
```

查看项目级安装：

```powershell
npx skills list --json
```

更新后检查 `skills-lock.json`、Skill 许可证和安全扫描结果，再新开 OpenCode 窗口。

## 本次未安装

- **UI/UX Pro Max**：大型行业模板和风格检索库与现有设计系统重叠，并增加 Python/CLI 依赖。
- **Taste-Skill**：没有可验证的权威仓库和版本来源。
- **shadcn Skill**：项目未使用 shadcn，比赛阶段不引入新的组件体系。
- **额外 GSAP Skill**：HyperFrames 已包含确定性 GSAP 视频时间轴。
