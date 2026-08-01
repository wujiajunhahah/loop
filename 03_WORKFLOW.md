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
    tasks/
    claims/
    reports/
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
