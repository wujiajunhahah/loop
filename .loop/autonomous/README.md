# Loop Bounded Product Iteration

本目录定义黑客松期间的有界产品自迭代流程。它允许 OpenCode 在负责人暂时离开时完成一个已经审核的产品/UI 任务，但不允许无限循环、自动扩展产品范围或把执行报告写成项目事实。

## 核心规则

> 一次运行，一个任务，最多两次实现尝试，验证后停止。

- 只能执行 `.loop/tasks/` 中已经存在且写明 allowed files、acceptance criteria 和 smoke path 的任务。
- 每次运行必须创建 `.loop/claims/<task-id>--<session-id>.md`。
- 修改范围只能来自任务 allowed files。
- 默认上限：45 分钟、2 次实现尝试、15 个 source files、0 个依赖变更。
- 不自动选择第二个任务，不自动 merge 或 push。
- `STATUS.md`、`DECISIONS.md`、`RISKS.md` 和 `INTEGRATION_QUEUE.md` 由协调者维护，worker 只读。
- 报告描述证据，不代表任务已被产品协调者接受。

## 阶段

### 0. Preflight

依次读取：

1. `00_PROJECT_CONTEXT.md`
2. `04_SOFTWARE_UPDATE_2026-08-01.md`
3. `.loop/STATUS.md`
4. `.loop/DECISIONS.md`
5. `.loop/RISKS.md`
6. `.loop/INTEGRATION_QUEUE.md`
7. `.loop/checklists/quality-redlines.md`
8. 指定 task、相关 claim 和 report
9. `docs/AI_SKILLS.md`

检查 Git 状态、当前 branch/commit、任务是否被领取、目标文件是否存在并属于 allowed files。共享工作区存在不相关修改时，只允许 audit-only task；实现任务必须使用干净的专用 branch/worktree。

### 1. Claim

Session ID：

```text
opencode-<YYYYMMDD-HHmmss>-<task-name>
```

Claim 记录 task、session、开始时间、base commit、worktree、文件范围、风险、预算和状态。

### 2. Observe

复现一个明确问题或验证一个 UI 假设。UI 任务按顺序使用：

1. `$oil-frontend` 确认真实任务、状态和代码归属。
2. `$oiloil-ui-ux-guide review` 产出 P0/P1/P2。
3. `$hallmark audit` 检查 AI 味，只读。
4. `$impeccable critique/audit` 提供确定性质量证据。
5. `$webapp-testing` 在真实浏览器中复现主要路径和视口结果。

不得把多个审计器的全部意见合并成一次大改。只选择任务范围内最高优先级、可复现的一组问题。

### 3. Implement

- 遇到 bug、测试失败或异常行为时，先使用 `$systematic-debugging` 建立稳定复现、根因和单一假设；没有根因证据前不改代码。
- 使用 `$oil-frontend` 作为工程主 Skill，视觉实现遵循 `$frontend-design`。
- 复用现有 React、TypeScript 和 CSS 模式。
- 补充聚焦测试。
- 不新增 route、依赖、持久化、传感器、生产认证、无边界 AI 或硬件要求。
- 不修改 allowed files 之外的文件。

### 4. Verify

使用 `$verification-before-completion`，为每一项完成声明选择并运行能直接证明它的最新命令。

必须运行：

```powershell
npm run verify
git diff --check
```

UI smoke 至少包含桌面、窄屏、主要成功路径和相关失败/退出/恢复路径。涉及路由时检查刷新与 deep link；涉及控制时检查 focus 和 reduced motion。

### 5. Skeptical Review

按 task acceptance criteria、quality redlines 和相关风险独立审查。结果只能是：

- `ready-for-owner-review`
- `needs-one-bounded-repair`
- `blocked`

只有第二种可以进行一次修复。修复后重新验证并停止。

重大功能、复杂 bugfix 或跨模块改动还必须使用 `$requesting-code-review`，给 reviewer 精确的 requirements、BASE_SHA 和 HEAD_SHA。Critical 和 Important finding 未处理前不能报告 ready。

### 6. Report and Stop

写入 `.loop/reports/<task-id>-<session-id>.md`，包含目标、修改文件、行为、验证命令、测试数量、smoke、限制、scope confirmation 和 integration recommendation。更新自己的 claim 为 completed 或 blocked。

不要自动领取下一任务。

## 硬停止条件

遇到以下任一条件立即停止并写 blocked report：

- 任务不存在、未审核、缺少 allowed files 或 acceptance criteria。
- 已有活动 claim，或目标文件存在并行所有权。
- 需要修改共享 contract、domain model、router、package 或 integration boundary。
- 需要第二个任务才能完成。
- 需要不可用的凭证、设备、生产服务或媒体。
- 测试只能通过削弱来源、关系隔离、AI 标记、`pull_only` 或 fallback。
- 一次聚焦修复后相同失败仍存在。
- diff 超过预算或出现范围外文件变化。
- 发现跨 recipient 数据暴露或无法判断数据来源。

## 使用

在新 OpenCode 窗口中运行：

```text
/iterate-product TASK-021
```

也可以直接调用 agent：

```text
@bounded-ui-worker 执行 TASK-021
```

没有任务编号时必须停止，不能自行创造宽泛的“优化整个 UI”任务。
