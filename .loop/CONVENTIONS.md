# Loop Coordination Conventions

本文件统一 task、claim、report 和 autonomous sidecar 的命名，解决历史文件格式混用问题。历史文件不批量重命名；新任务从本约定开始。

## Canonical Files

- Task: `.loop/tasks/TASK-###-short-slug.md`
- Claim: `.loop/claims/<task-id>--<session-id>.md`
- Task report: `.loop/reports/<task-id>-short-slug.md`，一个 task 只有一个 canonical report
- Autonomous run: `.loop/autonomous/runs/<run-id>.md`
- Autonomous observation: `.loop/autonomous/observations/<run-id>.md`
- Decision request: `.loop/autonomous/decisions/<run-id>.md`，由协调者决定是否提升到 `DECISIONS.md`

## Status Values

- `active`: claim 已创建且 worker 正在执行。
- `completed`: worker 已完成验证并写 report，但仍等待 owner/coordinator acceptance。
- `blocked`: 触发停止条件，不能继续实现。
- `superseded`: 任务被明确的新任务替代，必须指向替代 task。

`completed` 不等于 integrated，`ready-for-owner-review` 不等于 accepted。只有协调者更新 queue/status 后才建立项目事实。

## Ownership

- 一个 task 同时只能有一个 active claim。
- worker 只写自己的 claim、report 和 autonomous sidecar。
- `STATUS.md`、`DECISIONS.md`、`RISKS.md`、`INTEGRATION_QUEUE.md` 是协调者拥有的 canonical 文件。
- 共享工作区 dirty 时，audit-only 可以继续；source implementation 必须使用干净专用 worktree。
- 任何范围外文件变化都使本轮 blocked，不能用“顺手修复”解释。

## Evidence

- Report 必须记录命令、退出结果、测试数量、浏览器视口、smoke 路径和未验证项。
- 运行记录是不可变证据，不覆盖旧 run 来隐藏失败。
- 发现 README 或 STATUS 漂移时，先记录证据，再由协调者统一修正。

## Task Minimum

每个新 task 至少包含：Objective、Allowed Files、Requirements、Acceptance Criteria、Smoke Path、Budget、Forbidden Scope 和 Verification。

模板见 `.loop/tasks/TASK_TEMPLATE.md`。
