# 2026-08-01 会议更新：软件端变更清单

## 结论

这次会议没有推翻原方案，但把产品从“戒指驱动的完整系统”进一步收敛为：

> **软件优先的生命 Context 编辑与关系 Agent，硬件作为后续的纪念和触发载体。**

软件端需要更新的重点共有 8 项。

## 1. 把主场景改成“本人记录并编排”

之前容易把购买者、记录者和接收者混在一起。

软件需要明确：

- subject：被记录的人；
- recorder/editor：输入和编辑的人；
- recipient：未来使用的人；
- buyer：购买的人。

MVP 默认：

```text
buyer = subject = recorder/editor
recipient = 一个具体的重要对象
```

## 2. Context 不再只是素材库，要增加“关系编辑”

每条内容必须回答：

- 谁留下的；
- 谁录入和编辑的；
- 留给谁；
- 属于什么关系；
- 为什么重要；
- 在什么情况下出现；
- AI 可以怎么用；
- 是否敏感。

需要从“上传文件”升级到“有关系语义的内容单元”。

## 3. 主动录入优先，无感录入降级

MVP 先做：

- 关系化提问；
- 文本 / 语音 / 图片输入；
- AI 标签建议；
- 用户审核。

暂不依赖：

- HRV；
- 长期被动采集；
- 自动判断具体情绪。

## 4. 原始内容与 AI 内容必须分层

数据库和 UI 都要能区分：

- 原始素材；
- 转录；
- 摘要；
- AI 编排；
- AI 生成人设回应。

每次输出都要返回来源 Context ID，并标注是否由 AI 生成。

## 5. Agent 允许有限生成，但要加权限模型

旧方案偏向完全不生成。

新方案允许：

- 基于原文的摘要；
- 基于多条真实内容的串联；
- 在本人明确授权时生成符合表达风格的回应。

必须增加：

```text
generation_mode
allowed_topics
forbidden_topics
source_required
ai_label_required
high_risk_blocked
```

不要做无来源的自由人格聊天。

## 6. Trigger Engine 要改成可解释和可授权

不要做“随机出现”。

至少支持：

- user_opened；
- scheduled_date；
- milestone；
- weather_context；
- location_context；
- plan_progress。

默认 `pull_only`。天气、状态等只能在用户开启后用于推荐，不直接强推。

## 7. 增加“远行明信片”式输出

会议中的游戏化方向不是做完整游戏，而是让每次互动产生一个可收藏结果。

建议新增：

```text
InteractionArtifact
- type: postcard / letter / memory_card
- source_context_ids
- generated_summary
- original_quote_ref
- created_at
- recipient_response
```

这是软件 Demo 最容易体现设计感的部分。

## 8. 增加“用户成长”，不要做“养成逝者”

需要保存接收者偏好：

- 喜欢文字、声音还是图片；
- 互动长短；
- 主动提示程度；
- 哪类内容希望少出现；
- 是否愿意继续共同计划。

这些反馈只调整体验，不修改记录主体的核心人格。

---

## MVP 代码优先级

### 第一批并行任务

1. `domain-model`  
   用户角色、关系、ContextItem、原始 / 派生内容和策略模型。

2. `guided-capture`  
   关系化问题、文本 / 音频上传、标签建议和人工审核。

3. `agent-runtime`  
   recipient-scoped 检索、来源追踪、有限生成和安全边界。

4. `recipient-experience`  
   主动进入、回忆呈现、AI 标签、接受 / 跳过 / 收藏。

5. `postcard-artifact`  
   每次互动生成一张远行明信片。

6. `hardware-simulator`  
   模拟戒指 touch / open 事件，不阻塞软件。

7. `demo-integration`  
   固定母女案例、端到端脚本、API fallback。

---

## 当前不建议软件端投入的内容

- HRV 情绪分类；
- 自动发现用户是否悲伤；
- 强制主动提醒；
- 完整家族互助 Loop；
- 高自由度逝者聊天；
- 大型任务 / 游戏系统；
- 真实戒指固件主导的交互；
- 一次解决一对多全部权限问题。

---

## 软件端新的验收标准

完成的 MVP 应当证明：

1. 记录主体能够为一个指定对象输入并整理真实内容；
2. 原始内容不会被 AI 覆盖；
3. 用户能够审核 AI 标签和演绎权限；
4. Agent 不会读取其他关系的内容；
5. Agent 的输出可以追溯到来源；
6. AI 生成内容有明确标记；
7. 接收者主动进入，而不是被强行打扰；
8. 一次互动会形成可收藏的明信片或纪念节点；
9. 硬件缺席时，整个软件闭环仍能演示。
