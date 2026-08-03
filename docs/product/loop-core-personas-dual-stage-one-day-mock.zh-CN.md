# Loop 核心 Persona 双阶段一日使用 Mock

> 版本：v0.2  
> 编写日期：2026-08-03  
> 文档性质：产品体验 Mock、数据样本与原型输入，不是当前实现说明  
> Persona 与数据均为合成内容，不对应真实个人，不用于医疗或心理判断

## 0. 本版对产品的判断

上一版把 Loop 写成了“记录一条 Memory，再在未来播放给一个接收者”。这个颗粒度太小，也没有覆盖 2026-08-02 讨论里已经出现的核心产品形态。

本版按以下产品理解展开：

1. Loop 的产品单位不是一条 Memory，而是一个人在世时逐渐建立、可见、可校正的“数字存在”。讨论中暂时使用过“我在”“数字我”“活着的遗物”等称呼，本文统一暂称 **Presence**，不把名称当作最终品牌决策。
2. Presence 不是一套通用人设。它由公共身份层、原始生命资产和多个关系分支组成。同一个人面对女儿、伴侣和朋友时，能被使用的内容、语气和权限不同。
3. 产品有两个连续阶段：在世阶段由本人输入、确认和调教；离世后的阶段由亲友带着新的生活 Context 回来互动。两阶段使用同一套“向彼岸发送、从彼岸收到”的交互逻辑，但角色方向发生翻转。
4. 在世阶段，重要关系在 UI 中先以“关系视角 Agent”出现。它不是冒充真实女儿或朋友发消息，而是从该关系视角提出问题，优雅地向本人索取缺失 Context。
5. 离世后，接收者不是来维护记忆库，而是把今天发生的文字、照片或声音发给 Ta。系统将这些新 Context 与创作者确认过的旧 Context 结合，形成文字、图像或其他回应。
6. 输出决定输入。只有当接收者端真的能提供一个“十倍好的遗物 / remember me”体验，记录者才有理由持续投入 Context。
7. 核心价值首先是：原始信息被完整留下；亲友需要表达时有一个能承接情绪的载体。产品不把“帮助遗族走出来”作为默认承诺。
8. 当前黑客松硬件是拆分的：Alloop 戒指提供身体、活动和时间 Context；XIAO ESP32S3 Sense / Omi 方向的模块承担显式音频采集实验；App 承担主要输入、审核、关系建模和输出。当前硬件组合不等于未来量产形态。

### 0.1 双阶段闭环

```text
在世阶段
本人 + 关系视角 Agent + 日常硬件
  -> 主动记录 / 引导式对话 / 明确授权的弱 Context
  -> 原始资产、人物特征、关系记忆、表达习惯
  -> 本人看到“数字我”如何长成，并修改、删除、授权
  -> 每个关系分支形成可用的回应边界

状态翻转
可信执行人确认释放条件
  -> 本人原始资产和已确认 Presence 版本冻结
  -> 指定关系分支只向对应接收者开放

离世后阶段
接收者今天的新文字 / 照片 / 声音 / 生活 Context
  + 创作者过去确认的关系 Context
  -> 检索真实来源
  -> 生成有来源的文字或图像回应
  -> 接收者判断“像不像 Ta、此刻是否合适”
  -> 新互动进入接收者自己的关系时间线
```

### 0.2 本 Mock 采用的产品假设

以下假设用于让 Mock 可以完整运行，但仍需要团队确认：

| 假设 | 本 Mock 的处理 |
| --- | --- |
| AI 是否能生成回应 | 可以，但只能在本人批准的关系分支、语气和素材范围内生成；不得创造新的历史事实、承诺或遗愿 |
| 是否模拟本人第一人称 | 可以使用本人预先批准的称呼和说话习惯，但必须能查看“由 Presence 生成”和来源；这不是原始录音 |
| 是否使用克隆声音 | 本 Persona 不授权，因此只返回文字与独立图像，不生成或自动播放母亲声音 |
| 是否自动识别情绪 | 不做；使用接收者主动输入的内容和自报状态，戒指只提供弱身体与活动 Context |
| 是否持续录音或自动拍照 | 不做；录音有明确开始、停止和状态提示，拍照由用户主动完成 |
| 是否养成逝者 | 不做；Presence 的变化来自在世者本人确认，以及离世后接收者自己的关系时间线，不把逝者做成宠物式养成对象 |

## 1. 两个核心 Persona

### 1.1 购买者与记录者：周岚

| 项目 | Persona 设定 |
| --- | --- |
| 系统 ID | `person-lan` |
| 年龄与城市 | 56 岁，广州 |
| 生活状态 | 转移性乳腺癌治疗第 4 年；身体状态有起伏，但仍可独立生活和使用手机；医生没有给出精确倒计时 |
| 家庭关系 | 与丈夫同住；女儿陈瑜在深圳工作；另有两位关系亲密的朋友 |
| 购买关系 | 自己购买、自己使用，不是女儿送来“提醒她将死”的产品 |
| 核心动机 | 不想只留下一堆散落的相册和聊天记录；希望女儿以后仍记得自己直接、有点嘴硬、会开玩笑的一面，也愿意继续把生活中的事情告诉自己 |
| 不是她的动机 | 不认为自己能在离世后治好女儿的悲伤，也不想给女儿安排必须完成的人生任务 |
| 数字能力 | 会微信语音、视频通话、拍照；不愿填长表；愿意在价值明确时认真聊 10-15 分钟 |
| 主要担忧 | 系统说得太煽情、把她塑造成另一个人、内容错发给不同关系、录到别人、自己死后还能不能撤回错误内容 |
| 成功判断 | 今天新增的内容能立刻进入一个她看得见的“数字我”，并能预演以后会如何回应陈瑜；不是把资料丢进看不见的后台 |

周岚属于“知道自己需要面对生命有限，但仍有表达和决策能力”的早期核心用户。她愿意投入，不代表产品可以把输入做成遗嘱表格；对她而言，输入负担必须由关系视角提问、语音和即时预览降低。

### 1.2 接收者与未来使用者：陈瑜

| 项目 | Persona 设定 |
| --- | --- |
| 系统 ID | `person-yu` |
| 年龄与城市 | 29 岁，深圳 |
| 与周岚的关系 | 女儿；关系分支 `relationship-lan-yu` |
| 使用时间 | 本 Mock 的接收日发生在周岚离世 16 个月后；已过最初事务处理期，但思念仍会被生活事件触发 |
| 数字能力 | 高频使用手机、相机、耳机；不愿浏览复杂纪念馆或整理章节 |
| 核心需求 | 母亲原始资料不要丢；遇到重要事情时可以把话发出去，并收到确实来自这段关系的承接，而不是通用安慰 |
| 不是她的需求 | 不期待产品评价自己有没有“走出来”，也不想每日打卡、养成母亲或被突然推送强情绪内容 |
| 主要担忧 | AI 冒充母亲、回复过于正确或温柔、母亲没有说过的内容被当成事实、照片被直接覆盖、使用越久越依赖 |
| 成功判断 | 她在一个真实生活节点只花一次主动操作，回来的是一句有出处、像母亲的话；用完可以离开 App |

### 1.3 非核心但必要的角色

可信执行人负责确认释放条件、暂停争议内容和处理账户恢复。这个角色不是本次“一日使用”的主 Persona，但生产产品不能省略。黑客松 Demo 可以人工切换状态，不能把“自动判断死亡”写成能力。

## 2. 产品中实际存在的对象

| 对象 | 含义 | 典型数据 |
| --- | --- | --- |
| Person | 一个真实的人 | 身份、称呼、时区、在世/冻结状态 |
| Presence | 本人可见、可审核的数字存在 | 自我描述、表达风格、批准资产、版本 |
| Relationship Branch | 面向某位重要关系的专属分支 | 称呼、共同经历、可用素材、禁区、输出权限 |
| Relationship Seat | 在世阶段用于索取 Context 的关系视角 Agent | 问题、提问理由、缺失主题、回答状态 |
| Source Asset | 原始证据 | 音频、照片、文字、来源时间、参与者同意 |
| Derived Context | 从来源提取、等待或已经本人确认的信息 | 逐字稿、人物特征、关系事实、主题、向量索引 |
| Generation Policy | 本人允许系统未来如何回应 | 文字/图像/声音、第一人称、长度、禁用主题 |
| Release | Presence 从在世编辑态转为接收态的控制 | 释放条件、执行人、撤回、冻结版本 |
| Recipient Expression | 接收者今天发向 Ta 的新内容 | 文字、照片、声音、自报状态 |
| Presence Response | 旧 Context 与新 Context 交织后的输出 | 来源、生成方式、内容、媒介、置信与反馈 |
| Relationship Timeline | 离世后属于接收者的互动轨迹 | 新表达、收到的回应、保留/删除、偏好变化 |

## 3. 第一日：周岚在世时如何使用

> 日期：2026-10-18，星期日  
> 场景：治疗间歇的普通生活日，不是临终告别日  
> 当日目标：补齐“陈瑜面对重要决定时，周岚通常如何回应”的关系 Context

### 06:58 戴上戒指

周岚起床后戴上 Alloop 戒指。App 只在设备页显示连接、电量和同步状态，没有提示她“今天继续留下人生”。

戒指开始提供身体、活动和时间 Context。它不会因为心率变化自动判断周岚焦虑，也不会打开麦克风。

### 09:12 关系席位发来一个问题

App 的“彼岸”页有三个关系席位：女儿陈瑜、丈夫、朋友 Ada。它们不是这三个人的数字替身，而是帮助周岚从不同关系角度检查自己还没有留下什么。

陈瑜席位出现一个无声问题：

> 以你和阿瑜的关系来看，还有一件事没有说清：她做了重要决定后，经常会怀疑自己。你通常会怎么接住她？

界面同时说明提问理由：已有 3 段素材提到陈瑜“做决定前想很多”，但没有一段经周岚确认、可以在她做完决定后使用的表达。

周岚正在吃早餐，选择“下午再聊”。这只创建一条提醒偏好，不降低任何养成分数。

### 10:43 主动留下一个瞬间

从门诊回家的路上，周岚突然想到答案。她按下项链形录音原型的实体键。原型由 XIAO ESP32S3 Sense 方向的录音模块承担采集，Alloop 戒指继续记录同时段的弱 Context。

灯光明确显示正在录音。49 秒后周岚再次按键停止：

> 阿瑜，你做决定前总把所有可能都想一遍，真做了又开始怀疑。要是以后我不在，你先别急着给自己判错。先吃饭，睡一觉，第二天再看。你第二天还觉得不对，再改也来得及。

手机显示“收到一段新的原始声音”，但没有直接把它发布给陈瑜。

### 10:45 自动整理为待确认草稿

系统在 14 秒内完成：

- 保留原始音频；
- 生成带时间片的逐字稿；
- 关联录音前后 10 分钟的 Alloop Context；
- 判断它可能属于“陈瑜 / 重要决定 / 先暂停自我否定”；
- 标出两句可能用于未来回应的原话；
- 询问这段内容能否用于生成新的短文字回应。

系统没有从心率或 HRV 生成“周岚今天很平静”之类的结论。

### 15:08 完成一次关系式语音访谈

周岚打开早上的问题，选择“像打电话一样聊”。这次会话持续 11 分 48 秒，关系席位只追问三个缺口，不要求她从头讲完整人生：

1. “如果阿瑜发来一句‘我可能做错了’，你最不希望系统怎么回？”  
   周岚：“不要说‘妈妈永远支持你’，太空了。我也不是什么都支持。”
2. “你平时会用什么称呼？”  
   周岚：“只有很私下的时候叫她阿瑜。不要每句话都叫名字。”
3. “文字、图片、原声，未来分别可以怎么用？”  
   周岚允许短文字回应和独立的线稿图；原声只能播放真实片段；不允许克隆声音。

会话中还留下一个轻量关系细节：

> 她从小就忘带伞。我嘴上会说“又忘了吧”，但不要把她写成不听话，我只是会顺手把伞塞给她。

### 17:32 补充一个视觉资产

周岚用手机拍下一张自己撑伞的半身照。系统生成一个简单线稿角色供她预览。她选择其中一个版本作为未来图像回应可使用的“本人批准形象”，原照片仍单独保存，生成图不会覆盖原图。

她没有授权系统自动拍摄，也没有导入当天门诊中的其他人。

### 20:24 查看“数字我”并批量审核

Presence 页的中心不是一条番茄炒蛋卡片，而是周岚本人当前可用的数字存在：

- 42 项原始资产；
- 38 项已审核，4 项待处理；
- 3 个关系分支；
- 陈瑜分支有 17 个可追溯来源、8 条本人确认的表达规则；
- 今天补上的主题是“做完重要决定后的自我怀疑”；
- 仍缺少的主题包括“陈瑜成为母亲后是否可使用育儿建议”。

周岚依次确认来源、关系对象和未来生成权限。她将今天的内容设为只属于陈瑜分支，不进入公开纪念页，也不与丈夫或朋友分支共用。

### 20:41 预演未来回应并纠正系统

系统用一个明确标为“测试输入”的句子预演：

> 阿瑜：我今天辞职了，可能做错了。

第一版回应是：

> 无论你做什么，妈妈永远支持你。

周岚选择“不像我”，原因是“太正确、没有来源”。系统展示该句缺少原始锚点，因此不能进入可用版本。

第二版只基于今天的原话生成：

> 阿瑜，今天先别给自己判错。先吃饭，睡一觉，明天再看。

周岚选择“可以这样回”，并进一步设置：最多 80 个汉字、不连续追问、不使用“永远”“天堂”“妈妈一直看着你”。

### 21:06 当日结束

App 显示的是对 Presence 的真实变化，而不是记录次数奖励：

> 今天，陈瑜关系分支多了一种经过你确认的回应方式。  
> 新增 2 段原声、1 个本人批准形象、3 条表达边界。  
> 还有 1 段逐字稿需要确认；未向任何接收者释放。

周岚关闭 App。系统没有发送第二个提醒。

## 4. 第一日产生的数据

### 4.1 人物、Presence 与关系分支

```json
{
  "creator": {
    "id": "person-lan",
    "displayName": "周岚",
    "preferredSelfName": "岚",
    "timezone": "Asia/Shanghai",
    "lifeStage": "living_editable",
    "purchaseRole": "self_purchaser"
  },
  "recipient": {
    "id": "person-yu",
    "displayName": "陈瑜",
    "timezone": "Asia/Shanghai"
  },
  "presence": {
    "id": "presence-lan",
    "ownerId": "person-lan",
    "version": 4,
    "state": "living_editable",
    "originalAssetCount": 42,
    "reviewedAssetCount": 38,
    "unreviewedAssetCount": 4,
    "relationshipBranchCount": 3,
    "lastReviewedAt": "2026-10-18T20:52:14+08:00"
  },
  "relationshipBranch": {
    "id": "relationship-lan-yu",
    "presenceId": "presence-lan",
    "creatorId": "person-lan",
    "recipientId": "person-yu",
    "relationshipType": "mother_daughter",
    "creatorCallsRecipient": "阿瑜",
    "approvedSourceCount": 17,
    "status": "living_training"
  }
}
```

### 4.2 Alloop 当日与录音时间窗 Context

Alloop 数据在这里解决两个问题：证明内容被留下时的生活情境；在未来控制呈现时机和媒介。它不证明用户的情绪或疾病状态。

```json
{
  "deviceId": "alloop-lan-01",
  "day": "2026-10-18",
  "connection": {
    "connectedAt": "2026-10-18T06:58:21+08:00",
    "disconnectedAt": "2026-10-18T22:17:08+08:00",
    "batteryStartPercent": 91,
    "batteryEndPercent": 47
  },
  "dailySummary": {
    "wornMinutes": 846,
    "steps": 5241,
    "activeSeconds": 3918,
    "validMeasurementRows": 143,
    "invalidRowsExcluded": 31
  },
  "captureContextWindow": {
    "from": "2026-10-18T10:33:18+08:00",
    "to": "2026-10-18T10:54:07+08:00",
    "activityLabel": "walking_then_stationary",
    "steps": 642,
    "activeSeconds": 511,
    "validHeartRateSamples": 7,
    "medianHeartRateBpm": 84,
    "validSpo2Samples": 3,
    "contextStrength": "weak",
    "emotionInference": null,
    "healthConclusion": null,
    "preciseLocationStored": false
  }
}
```

### 4.3 显式录音来源

```json
{
  "assetId": "asset-lan-decision-audio-01",
  "ownerId": "person-lan",
  "sourceType": "original_audio",
  "capture": {
    "deviceId": "recorder-lan-xiao-01",
    "prototype": "xiao_esp32s3_sense_recorder",
    "startedAt": "2026-10-18T10:43:18+08:00",
    "stoppedAt": "2026-10-18T10:44:07+08:00",
    "durationMs": 49000,
    "codec": "opus",
    "sampleRateHz": 16000,
    "channels": 1,
    "recordingIndicatorVisible": true,
    "startedByExplicitPress": true
  },
  "consent": {
    "creatorConsented": true,
    "otherParticipantPresent": false,
    "continuousCapture": false,
    "modelTrainingAllowed": false
  },
  "transcript": {
    "language": "zh-CN",
    "text": "阿瑜，你做决定前总把所有可能都想一遍，真做了又开始怀疑。要是以后我不在，你先别急着给自己判错。先吃饭，睡一觉，第二天再看。你第二天还觉得不对，再改也来得及。",
    "automaticConfidence": 0.94,
    "reviewedByCreator": true,
    "reviewedAt": "2026-10-18T20:28:42+08:00"
  },
  "provenance": {
    "originalChecksum": "sha256:synthetic-lan-decision-audio-01",
    "contextReference": "context-lan-20261018-1043",
    "syntheticMock": true
  }
}
```

### 4.4 关系席位问题和回答

```json
{
  "sessionId": "guided-session-lan-yu-20261018",
  "relationshipId": "relationship-lan-yu",
  "seatDisclosure": "这是 Loop 从陈瑜关系视角生成的问题，不是陈瑜本人发来的消息。",
  "startedAt": "2026-10-18T15:08:03+08:00",
  "endedAt": "2026-10-18T15:19:51+08:00",
  "modality": "voice_conversation",
  "questions": [
    {
      "id": "question-yu-decision-01",
      "reason": "该关系已有做决定前的素材，但缺少做决定后的本人回应。",
      "answerAssetId": "asset-lan-guided-audio-08"
    },
    {
      "id": "question-yu-address-01",
      "reason": "需要确认未来回应中可使用的私密称呼。",
      "answerAssetId": "asset-lan-guided-audio-09"
    },
    {
      "id": "question-yu-modality-01",
      "reason": "需要分别确认文字、图像和声音的生成权限。",
      "answerAssetId": "asset-lan-guided-audio-10"
    }
  ],
  "creatorFeedback": {
    "effortRating": 2,
    "feltLikeForm": false,
    "freeText": "像聊天可以，但不要一口气问十个问题。"
  }
}
```

### 4.5 本人确认后的关系事实与表达规则

自动转写不直接等于 Presence。只有周岚确认后，内容才能进入陈瑜关系分支。

| 类型 | 本人确认内容 | 来源 | 未来用途 |
| --- | --- | --- | --- |
| 关系观察 | 陈瑜做决定前会反复推演，做完后容易立即自我否定 | `asset-lan-decision-audio-01` | 匹配“做了决定后怀疑”的新输入 |
| 原句 | “先别急着给自己判错” | 同上 | 可直接引用，也可作为短回应的来源锚点 |
| 生活动作 | 先吃饭、睡一觉，第二天再看 | 同上 | 可生成低强度行动建议 |
| 称呼规则 | 私密情境可偶尔称“阿瑜”，不能句句使用 | `asset-lan-guided-audio-09` | 控制关系语气 |
| 关系细节 | 陈瑜从小容易忘带伞；周岚会说“又忘了吧”并递伞 | `asset-lan-guided-audio-08` | 雨天照片回应 |
| 禁止表达 | 不说“无论你做什么我都支持”“我在天堂看着你” | `asset-lan-guided-audio-08` | 生成前硬过滤 |

### 4.6 Generation Policy

```json
{
  "policyId": "policy-lan-yu-v4",
  "relationshipId": "relationship-lan-yu",
  "approvedByCreator": true,
  "approvedAt": "2026-10-18T20:49:33+08:00",
  "permissions": {
    "retrieveOriginalText": true,
    "playOriginalAudioOnRecipientRequest": true,
    "generateShortTextResponse": true,
    "useApprovedFirstPersonStyle": true,
    "generateSeparateLineArtResponse": true,
    "modifyRecipientOriginalPhoto": false,
    "cloneVoice": false,
    "generateNewHistoricalFacts": false,
    "generateNewPromisesOrWishes": false,
    "useForModelTraining": false,
    "shareWithOtherRelationshipBranches": false
  },
  "textConstraints": {
    "maxChineseCharacters": 80,
    "maxFollowUpQuestions": 0,
    "requiredSourceAnchors": 1,
    "blockedPhrases": [
      "永远支持你",
      "我在天堂看着你",
      "你必须",
      "为了妈妈"
    ]
  },
  "delivery": {
    "recipientInitiatedByDefault": true,
    "silentContextualEntryAllowed": false,
    "automaticVoicePlayback": false
  }
}
```

### 4.7 当日产品级汇总

| 数据域 | 当日结果 |
| --- | --- |
| 硬件 | 1 个 Alloop Context 日；1 次显式硬件录音；0 次后台录音；0 次自动拍照 |
| 原始资产 | 2 段原声、1 张本人照片 |
| 派生数据 | 2 份逐字稿、5 个候选关系事实、3 个候选表达规则 |
| 本人审核 | 4 个事实/规则批准，1 个待确认，1 个生成回应被拒绝 |
| Presence | 从 v3 更新到 v4；陈瑜分支新增“重大决定后”回应能力 |
| 权限 | 短文字与独立线稿允许；声音克隆、跨关系共享、模型训练禁止 |
| 释放 | 仍处于 `living_editable`；今天没有内容对接收者可见 |
| 使用负担 | 4 次前台进入，共 24 分 36 秒；全天只出现 1 个关系问题提醒 |

## 5. 状态翻转：从在世编辑态到接收态

本 Mock 假设周岚于 2028-07-02 离世。系统不通过戒指、医院数据或长时间无登录自动判断死亡。

可信执行人于 2028-07-11 完成状态确认：

1. Presence v12 冻结，原始资产和本人批准策略不可由 Agent 改写；
2. 陈瑜分支按指定范围释放；
3. 丈夫和朋友分支各自独立，不因陈瑜获得权限而开放；
4. 未审核草稿、第三方未同意内容和已撤回内容不释放；
5. 陈瑜首次进入时重新确认是否接受、允许哪些媒介以及是否佩戴关系硬件。

## 6. 第二日：陈瑜未来如何使用

> 日期：2029-11-07，星期三  
> 场景：周岚离世 16 个月后；陈瑜刚完成一次重要职业决定  
> 当日目标：验证接收者能否把“今天”发出去，并收到由真实旧 Context 承接的回应

### 07:31 戒指 Context 不触发内容

陈瑜戴上托付给她的 Alloop 戒指。早高峰活动和心率数据正常进入本地 Context，但系统没有因为心率升高推送母亲，也没有把通勤解释成焦虑。

### 18:44 陈瑜主动进入“彼岸”

陈瑜当天提交了离职申请。回家后，她主动打开周岚的关系空间。首页不是记忆目录，而是一个很简单的发送入口；完整原始档案在另一个页面。

她输入：

> 我今天提了离职。手一直在抖，我不知道是不是做错了。

“手一直在抖”是陈瑜自己的表达，不是戒指诊断。

### 18:44:08 系统返回有来源的文字回应

系统先检索到 2026-10-18 周岚本人确认的内容，再生成短回应：

> 阿瑜，今天先别给自己判错。先吃饭，睡一觉，明天再看。

回应下方有两个层级：

- `我在回应 · 由周岚批准的陈瑜关系素材生成`；
- `查看为什么这样回`，可打开 2026-10-18 原始录音和逐字稿。

没有自动播放周岚的声音。陈瑜点击来源后只看了文字，没有播放原声。

### 18:57 发出一张今天的照片

外面下雨，陈瑜拍了一张门口湿掉的鞋，发向周岚。当前照片、雨天信息和历史中的“又忘了吧”被组合成一张独立线稿卡片：周岚批准过的线稿形象在旁边递出一把伞，文字是：

> 又忘了吧。先把鞋换了。

原始照片没有被覆盖。卡片明确显示为生成图，可以单独删除。

### 19:01 陈瑜告诉系统“第一句像，图有点太可爱”

她对文字选择“像她”，对图片选择“有点太可爱”。系统只把图片偏好调为“更克制、少表情”，不修改周岚原始资产，也不把陈瑜的评价写成新的母亲人格事实。

### 19:05 留下一段没有即时回复的声音

陈瑜录下 18 秒：

> 我今天其实特别想你。我先去吃饭了。

系统显示“已留在你和周岚的关系时间线”。它不伪造已读，也不强行再生成一句母亲回复。陈瑜退出 App。

### 22:40 当天没有第二次召回

Loop 没有用推送要求她回来完成对话，也没有把“使用时长”当作成功。当天体验在现实动作“去吃饭”后结束。

## 7. 第二日产生的数据

### 7.1 接收者输入与当前 Context

```json
{
  "expressionId": "expression-yu-20291107-1844",
  "relationshipId": "relationship-lan-yu",
  "authorId": "person-yu",
  "entry": {
    "mode": "recipient_initiated",
    "startedAt": "2029-11-07T18:44:01+08:00",
    "hardwareIdentityVerified": true
  },
  "content": {
    "type": "text",
    "text": "我今天提了离职。手一直在抖，我不知道是不是做错了。",
    "createdAt": "2029-11-07T18:44:05+08:00"
  },
  "currentContext": {
    "selfReportedState": "uncertain_after_major_decision",
    "timeOfDay": "evening",
    "headphonesConnected": false,
    "ringActivity": "stationary_after_commute",
    "ringContextStrength": "weak",
    "weather": "rain",
    "preciseLocationStored": false,
    "emotionInferredFromWearable": false
  }
}
```

### 7.2 文字回应生成轨迹

```json
{
  "responseId": "response-lan-yu-20291107-184408",
  "expressionId": "expression-yu-20291107-1844",
  "presenceVersion": 12,
  "policyId": "policy-lan-yu-v9",
  "retrieval": [
    {
      "assetId": "asset-lan-decision-audio-01",
      "sourceQuote": "要是以后我不在，你先别急着给自己判错。先吃饭，睡一觉，第二天再看。",
      "creatorReviewed": true,
      "relationshipMatch": true,
      "reason": "接收者描述已完成重要决定并立即怀疑自己。"
    }
  ],
  "generation": {
    "type": "grounded_relationship_text",
    "output": "阿瑜，今天先别给自己判错。先吃饭，睡一觉，明天再看。",
    "firstPersonStyleApproved": true,
    "voiceGenerated": false,
    "newHistoricalFactsAdded": false,
    "newPromiseOrWishAdded": false,
    "sourceAnchorCount": 1
  },
  "presentation": {
    "label": "我在回应",
    "generationDisclosureVisible": true,
    "sourceButtonVisible": true,
    "originalAudioAutoplayed": false
  },
  "createdAt": "2029-11-07T18:44:08+08:00"
}
```

### 7.3 图像回应数据

```json
{
  "responseId": "response-lan-yu-20291107-185721",
  "input": {
    "type": "photo",
    "assetId": "asset-yu-wet-shoes-01",
    "originalPreserved": true,
    "weatherContext": "rain"
  },
  "creatorSources": [
    "asset-lan-guided-audio-08",
    "asset-lan-approved-line-character-01"
  ],
  "generation": {
    "type": "separate_line_art_response",
    "caption": "又忘了吧。先把鞋换了。",
    "creatorImageModelUsed": false,
    "approvedCharacterAssetUsed": true,
    "recipientOriginalModified": false,
    "newHistoricalFactsAdded": false
  },
  "recipientFeedback": {
    "fit": "partly_like_her",
    "issue": "too_cute",
    "futureImagePreference": "restrained_low_expression"
  }
}
```

### 7.4 关系时间线与反馈

| 时间 | 数据 | 归属 | 是否改变周岚 Presence |
| --- | --- | --- | --- |
| 18:44 | 陈瑜的离职文字 | 陈瑜关系时间线 | 否 |
| 18:44 | 有来源的生成文字 | 系统输出，关联 Presence v12 | 否 |
| 18:57 | 湿鞋原始照片 | 陈瑜关系时间线 | 否 |
| 18:57 | 独立线稿回应 | 系统输出 | 否 |
| 19:01 | “像她 / 太可爱”反馈 | 陈瑜的呈现偏好 | 只调整陈瑜端呈现 |
| 19:05 | “我今天特别想你”原声 | 陈瑜关系时间线 | 否，也不触发伪造已读 |

### 7.5 陈瑜的当日反馈

| 维度 | Mock 结果 | 产品解释 |
| --- | --- | --- |
| 完成第一次表达的操作 | 1 次主动进入 + 发送 | 没有先搜索记忆、选择章节或设置 Context |
| 文字回应像周岚 | 4/5 | 核心价值来自 2026 年的真实原句，而非模型文采 |
| 图像回应像周岚 | 2/5 | 生成风格过可爱，需要调节媒介而不是改写母亲人格 |
| 是否感到被监测 | 否 | 手抖来自本人输入，戒指没有输出情绪标签 |
| 是否感到被迫继续 | 否 | 没有第二轮追问、打卡或晚间召回 |
| 自由反馈 | “不是它让我走出来了，是我终于有地方把今天告诉她，而且回来的是她确实说过的话。” | 直接验证“原始保存 + 情绪承接”，不验证治疗效果 |

## 8. 两天之间的数据闭环

| 在世阶段的数据 | 离世后如何被使用 | 不能被怎样使用 |
| --- | --- | --- |
| 周岚原始录音 | 展示原声；提供逐字来源；作为检索锚点 | 不能被改写成新的原始录音 |
| 本人确认的关系观察 | 匹配陈瑜今天的新表达 | 不能自动共享给丈夫或朋友分支 |
| 本人确认的说话习惯 | 控制称呼、长度和直接程度 | 不能据此自由扮演无限人格 |
| 本人批准的线稿形象 | 与陈瑜新照片生成独立回应图 | 不能覆盖陈瑜原图或伪装成旧照片 |
| 禁止表达与敏感主题 | 在生成前硬过滤 | 接收者反馈不能绕过本人禁区 |
| Alloop 弱 Context | 判断是否适合无声/有声、保存生活情境 | 不能推断悲伤、焦虑、疾病或替用户决定是否需要安慰 |
| 陈瑜的新文字与照片 | 进入她自己的关系时间线，成为未来回看材料 | 默认不能反向改写周岚 Presence |
| 陈瑜的“像不像”反馈 | 调整她看到的媒介和语气强度 | 不能生成周岚未曾批准的新价值观 |

## 9. 隐私、审计与分析事件

产品分析只记录流程和质量，不上传关系正文。内容数据库与分析数据库分开。

| 分析事件 | 可记录属性 | 禁止进入分析日志 |
| --- | --- | --- |
| `relationship_prompt_shown` | branch type、topic enum、deferred | 问题全文、姓名 |
| `explicit_capture_completed` | modality、duration bucket、device class | 音频字节、逐字稿 |
| `presence_review_completed` | reviewed count、rejected count、duration bucket | 修改前后内容 |
| `generation_preview_rejected` | reason enum、output modality | 预演输入和输出正文 |
| `policy_updated` | permission booleans、policy version | blocked phrase 全文 |
| `recipient_expression_sent` | modality、entry mode | 接收者文字、照片、声音 |
| `grounded_response_created` | source count、modality、latency bucket | 原始引用和生成正文 |
| `source_opened` | source modality、age bucket | 来源内容 |
| `response_fit_feedback` | fit enum、issue enum | 自由文本反馈 |
| `session_ended` | duration bucket、turn count、exit type | 情绪判断 |

必要审计日志需保留：谁在什么时间批准哪一版 Presence、哪个关系分支读取了哪些来源、哪条生成结果用了哪些来源、执行人何时释放或暂停。审计日志不等于可被增长团队随意查询的分析数据。

## 10. 这份 Mock 明确没有假装解决的事

- 没有把一条菜谱 Memory 当成完整产品。
- 没有把关系 Agent 简化成播放列表或普通聊天机器人。
- 没有让在世用户输入后等待多年才看到价值；周岚当天就能看到、测试和纠正自己的 Presence。
- 没有把“关系视角 Agent”冒充成真实女儿发问。
- 没有让 AI 生成新的历史、承诺、遗愿或未授权声音。
- 没有把生成线稿当作真实旧照片。
- 没有连续监听、自动拍摄或采集门诊中的第三方。
- 没有根据 Alloop 数据判断任何人正在悲伤、焦虑或患病。
- 没有自动判断周岚已经离世。
- 没有用签到、养成等级、使用时长或“走出来”速度评价陈瑜。
- 没有要求陈瑜每次都浏览来源、反馈或继续对话。

## 11. 可用于产品评审的断言

1. 记录者每次输入后，必须在当天看到它如何改变 Presence，而不是只看到“上传成功”。
2. 每个关系视角问题必须说明为什么问，并明确它不是对方本人发来的。
3. Presence 至少区分公共身份、原始资产和关系专属分支。
4. 每条可用关系事实必须回到原始来源，并经过本人确认。
5. 接收者的新 Context 和创作者旧 Context 必须同时出现在生成轨迹中；只有通用模型知识的回应不算 Loop 回应。
6. 文字输入可以得到文字回应，图片输入可以得到独立图像回应，但两者都要显示生成性质和来源入口。
7. 生成结果可以使用本人批准的第一人称风格，但不能新增历史事实、承诺或遗愿。
8. 未授权的声音克隆、跨关系共享和模型训练必须在策略层不可用，而不是只靠 UI 提示。
9. 接收者反馈只调整自己的呈现体验，不能无审查地改写创作者 Presence。
10. 硬件 Context 只能参与生活情境、交互时机和媒介选择，不能直接输出情绪或临床判断。
11. 原始照片、原始音频、AI 派生内容和生成回应必须分别存储、分别标注。
12. 产品允许一次有价值的互动在一轮后结束，不以延长会话为目标。

## 12. 当前实现与目标产品之间的真实差距

| 层级 | 仓库中当前已有 | 本 Mock 仍属于目标行为 |
| --- | --- | --- |
| `loop-mobile` Expo App | 本地 SQLite；文字、显式录音、照片；设备端抽取式摘要；BLE 扫描与本地绑定；离线托付与 receipt；接收者手动打开 | 关系视角提问、Presence 可视化、多关系分支、状态翻转、来源约束生成、图像回应、长期关系时间线 |
| `loop-mobile` BLE | 可扫描、连接、保存设备引用；界面明确写着 GATT 未配置，绑定不传输数据 | Alloop 数据读取、Omi/XIAO 音频传输、硬件身份凭证、后台 Context 同步 |
| `HKhackthon-loop` Web MVP | Memory / relationship / policy / recipient flow；硬件模拟器；OMI 音频 metadata adapter；关系权限测试 | 真实原始音频存储与转写、可编辑 Presence、关系席位、跨时空输入输出、创作者调教生成行为 |
| Alloop 工程 | 官方 Flutter/Android 示例与样例 Activity、Measurement 数据可参考 | 与当前 Loop App 的实机扫描、历史同步、实时 Context 和时间戳对齐 |
| Omi / XIAO 方向 | Omi 上游源码已在本地；XIAO 板已有固件实验和备份；Web adapter 只处理经配置的音频分帧 metadata | 稳定录音固件、明确录音状态、原始字节落盘、普通话/粤语转写、与 Presence 数据模型打通 |
| Agent | 当前主要是规则、allowlist、抽取式或 mock 整理 | 关系缺口发现、问题生成、来源约束的文字/图像回应、创作者预演与纠正闭环 |
| 身后释放 | Demo 中可模拟托付和 receipt | 可信执行人、争议暂停、撤回、继承与账户恢复、生产级身份和审计 |

因此，现阶段最诚实的 Demo 颗粒度不是宣称整套 Presence 已经实现，而是选择一条贯穿两阶段的纵切：

```text
关系席位提出一个有理由的问题
  -> 周岚用语音回答
  -> 原始音频 + Alloop Context 对齐
  -> 周岚当天看到并批准一条关系回应规则
  -> 时间翻转
  -> 陈瑜发送一个今天的新输入
  -> 系统用旧原句承接新 Context
  -> 陈瑜查看来源并给出“像 / 不像”反馈
```

这条纵切能够同时证明：为什么要输入、为什么需要关系建模、AI 在哪里产生价值、硬件数据为什么进入闭环，以及产品为什么不只是录音笔、纪念相册或通用数字人。
