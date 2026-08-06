# Loop 多窗口协同工作流

## 角色分工

### Codex 桌面版

- 总览项目；
- 维护状态；
- 拆分任务；
- 审查架构；
- 判断合并；
- 发现重复劳动；
- 默认不承担主要编码。

### OpenCode

- 领取具体任务；
- 实现、测试、提交；
- 写 session report；
- 不擅自改变全局架构；
- 多窗口并行但避免编辑同一文件。

---

## 推荐初始化结构

```text
Loop/
  docs/
    project/
      project-context.md
      codex-desktop-prompt.md
      opencode-prompt.md
      collaboration-workflow.md
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

### TASK-001 Repository Bootstrap

- 初始化项目结构；
- 初始化 Git；
- 配置 `.gitignore`；
- 建立 `.env.example`；
- 建立基础运行脚本。

### TASK-002 Context Schema

- 定义 Context 数据结构；
- 区分公共、关系专属、私密内容；
- 定义 AI 使用策略；
- 提供示例数据。

### TASK-003 Capture Flow Prototype

- 实现记录者端最小录入流程；
- 支持文本和语音文件；
- 选择 recipient；
- 补充 meaning 和 trigger policy。

### TASK-004 Relationship Agent Prototype

- 按 recipient 检索 Context；
- 返回真实内容来源；
- 生成轻量编排；
- 禁止跨对象内容。

### TASK-005 Hardware Simulator

- 模拟戒指 touch / mark / confirm / dismiss；
- 通过事件触发 App；
- 提供真实硬件未来接入接口。

### TASK-006 Recipient Experience

- 接收者主动进入；
- 展示一段真实记忆；
- 显示来源与 AI 标记；
- 接受、跳过或继续共同计划。

### TASK-007 Demo Integration

- 打通端到端；
- 准备固定 Demo 数据；
- 加入离线 fallback；
- 输出运行说明和答辩脚本。

---

## 重要提醒

多个 OpenCode 窗口同时使用同一目录时，最大的风险不是代码能力，而是：

- 重复实现；
- 文件覆盖；
- 接口漂移；
- 无法判断谁的版本是最新；
- 所有人都在做“全局优化”，却没人完成 Demo。

因此：

> 一个窗口，一个任务，一个分支，一份报告。
