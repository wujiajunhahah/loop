# Loop 多窗口协同工作流（V2）

## 当前分工

### Codex 桌面版

负责：

- 总览；
- 状态维护；
- 产品与架构审查；
- 任务拆解；
- 冲突检测；
- 集成判断；
- Demo readiness。

默认不负责大规模业务实现。

### OpenCode

负责：

- 领取任务；
- 实现；
- 测试；
- 提交；
- 写 Session Report；
- 提出 Decision Request。

### 临时总览替代窗口

当 Codex 桌面版总览窗口暂时不可用时，由当前明确指定的 OpenCode 窗口
临时承担总览职责，直到用户明确取消或 Codex 总览窗口恢复。

临时职责包括：

- 读取并维护项目状态、任务队列、决策和风险；
- 审查任务边界、依赖、冲突和集成条件；
- 判断是否可以开始下一项任务，或是否需要 Decision Request；
- 汇总测试、构建、人工 smoke 和现场演示证据；
- 把所有结论写回 `.loop/` 文档，不以本窗口对话记录作为唯一依据。

临时总览窗口仍必须遵守“一次一个任务、明确所有权、不得覆盖其他窗口修改”
的协作规则。它可以做协调和审查，但不应因为临时替代总览而扩大业务实现范围。

---

## 项目结构

```text
Loop/
  00_PROJECT_CONTEXT.md
  01_PROMPT_CODEX_DESKTOP.md
  02_PROMPT_OPENCODE.md
  03_WORKFLOW.md
  04_SOFTWARE_UPDATE_2026-08-01.md
  .loop/
    STATUS.md
    DECISIONS.md
    RISKS.md
    INTEGRATION_QUEUE.md
    CONVENTIONS.md
    checklists/
    autonomous/
    tasks/
    claims/
    reports/
  .agents/skills/
  .opencode/agents/
  .opencode/commands/
  docs/
  videos/
```

---

## 推荐第一批任务

### TASK-001 Domain Model V2

- 定义 subject / buyer / recorder / recipient；
- 定义 relationship；
- 定义 ContextItem；
- 定义 OriginalAsset 与 DerivedContent；
- 定义策略和来源字段。

### TASK-002 Guided Capture

- 关系选择；
- 关系化问题；
- 文本和音频输入；
- AI 标签建议；
- 人工审核。

### TASK-003 Context Editor

- 查看原文；
- 修改对象；
- 修改权重；
- 设置 AI 权限；
- 删除错误推断。

### TASK-004 Agent Runtime

- recipient-scoped retrieval；
- source_replay；
- source_composition；
- 有权限的 persona_inference；
- 输出 provenance。

### TASK-005 Recipient Experience

- 用户主动进入；
- 呈现原始 / AI 内容；
- AI 标记；
- 接受 / 跳过 / 收藏；
- 不主动打扰。

### TASK-006 Postcard Artifact

- 将一次互动生成明信片；
- 绑定来源；
- 可收藏；
- 可回应；
- 可作为 Demo 视觉结果。

### TASK-007 Hardware Simulator

- mark；
- touch；
- open；
- confirm；
- dismiss；
- 与 App 事件连接。

### TASK-008 Demo Integration

- 固定母女案例；
- 下雨天 Context；
- 原始语音；
- 有边界 AI 串联；
- 生成远行明信片；
- API fallback；
- 演示脚本。

---

## 并行原则

> 一个窗口，一个任务，一个分支，一份报告。

最大的风险不是开发速度不够，而是：

- 多窗口修改同一文件；
- 接口不一致；
- 旧产品假设没有清理；
- 所有人都开发 Agent，却没人做完整 Demo；
- 生成内容无法追溯；
- 硬件拖住软件。

任何任务都应优先服务端到端演示。

## 质量门禁

每个任务除自身验收标准外，都必须执行
`.loop/checklists/quality-redlines.md`。该清单借鉴 AutoDev 的质量红线、
对抗式审查和文档漂移检查，但按 Loop 的 OpenCode 协作方式落地。

最小自动验证入口为：

```text
npm run verify
git diff --check
```

`verify` 只负责测试、类型检查和生产构建；任务报告仍必须记录人工 smoke
路径、失败恢复路径，以及未验证的浏览器、媒体、网络或硬件行为。

有界自动产品/UI 迭代使用 `.loop/autonomous/README.md` 和
`/iterate-product <TASK-ID>`。它一次只能执行一个已经审核的任务，最多两次
实现尝试；worker 不得自行更新 canonical status、决策、风险和集成队列，也不得
自动领取下一任务。

现场提交前必须阅读 `docs/DEMO_RUNBOOK.md`、`docs/PRIVACY_SECURITY.md` 和
`docs/ASSET_RIGHTS.md`。它们分别负责操作恢复、敏感数据边界和公开素材权利，不能
用产品 README 的功能介绍替代。

提交前应独立审查以下四类问题：

- 契约：实现是否满足任务 acceptance criteria；
- 边界：是否出现无来源生成、跨关系读取、随机推送或硬件强依赖；
- 降级：是否把 mock、placeholder 或 offline fallback 误写成生产能力；
- 漂移：README、STATUS、DECISIONS、RISKS、claims 和 reports 是否与实际
  验证结果一致。

项目级代码质量使用 Superpowers 精简工程包：异常先走
`systematic-debugging`，完成声明前走 `verification-before-completion`，重大功能或
跨模块改动在集成前走 `requesting-code-review`。这些 Skill 不替代 `.loop` 的
task、claim、allowed files、报告或协调者决策。
