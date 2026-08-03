/**
 * 周岚 / 陈瑜 种子数据（对照 personas 文档 §3 / §4 / §6 / §7）。
 *
 * 种子不是静态 JSON，而是真实走一遍 Presence Harness 蒸馏管线：
 * createPresence -> createBranch -> ingest（提取候选）-> assign -> confirm
 * -> updatePolicy -> approvePolicy ->（可选）freeze。
 * 这样同时充当管线的集成示例。
 */
import { PresenceHarness } from './harness'
import { createInMemoryPresenceRepository, type PresenceRepository } from './repository'
import type { Person, Presence, RelationshipBranch } from './types'

export const LAN: Person = {
  id: 'person-lan',
  displayName: '周岚',
  preferredSelfName: '岚',
  timezone: 'Asia/Shanghai',
  lifeStage: 'living_editable',
}

export const YU: Person = {
  id: 'person-yu',
  displayName: '陈瑜',
  timezone: 'Asia/Shanghai',
  lifeStage: 'recipient',
}

export interface LanYuFixture {
  repo: PresenceRepository
  harness: PresenceHarness
  presence: Presence
  branch: RelationshipBranch
  assets: {
    decisionAudio: string
    guidedAddress: string
    guidedModality: string
    guidedRain: string
    lineCharacter: string
  }
}

/** 走完在世阶段全流程（未冻结），可用于预演与纠正测试 */
export async function buildLanYuLivingFixture(): Promise<LanYuFixture> {
  const repo = createInMemoryPresenceRepository()
  const harness = new PresenceHarness(repo)
  const presence = await harness.createPresence(LAN)
  const branch = await harness.createBranch({
    presenceId: presence.id,
    creatorId: LAN.id,
    recipientId: YU.id,
    relationshipType: 'mother_daughter',
    creatorCallsRecipient: '阿瑜',
  })

  // 10:43 显式录音：做决定后的自我怀疑
  const decisionAudio = 'asset-lan-decision-audio-01'
  await harness.ingestAsset({
    id: decisionAudio,
    ownerId: LAN.id,
    sourceType: 'original_audio',
    modality: 'audio',
    capturedAt: '2026-10-18T10:43:18+08:00',
    uri: 'audio/lan/decision-01.opus',
    transcript: {
      text: '阿瑜，你做决定前总把所有可能都想一遍，真做了又开始怀疑。要是以后我不在，你先别急着给自己判错。先吃饭，睡一觉，第二天再看。你第二天还觉得不对，再改也来得及。',
      language: 'zh-CN',
      automaticConfidence: 0.94,
      reviewedByCreator: true,
      reviewedAt: '2026-10-18T20:28:42+08:00',
    },
    contextWindow: {
      from: '2026-10-18T10:33:18+08:00',
      to: '2026-10-18T10:54:07+08:00',
      activityLabel: 'walking_then_stationary',
      contextStrength: 'weak',
      steps: 642,
      activeSeconds: 511,
      validHeartRateSamples: 7,
      medianHeartRateBpm: 84,
      validSpo2Samples: 3,
      emotionInference: null,
      healthConclusion: null,
    },
    consent: {
      creatorConsented: true,
      otherParticipantPresent: false,
      modelTrainingAllowed: false,
    },
    extractionHints: [
      {
        kind: 'source_quote',
        text: '要是以后我不在，你先别急着给自己判错。先吃饭，睡一觉，第二天再看。',
        quote: '要是以后我不在，你先别急着给自己判错。先吃饭，睡一觉，第二天再看。',
        tags: ['decision_self_doubt', 'daily_care'],
        reason: '录音中的原话，可直接引用，也可作为短回应的来源锚点。',
      },
      {
        kind: 'relationship_fact',
        text: '陈瑜做决定前会反复推演，做完后容易立即自我否定。',
        quote: '要是以后我不在，你先别急着给自己判错。先吃饭，睡一觉，第二天再看。',
        tags: ['decision_self_doubt'],
        reason: '匹配「做了决定后怀疑」的新输入。',
      },
      {
        kind: 'life_action',
        text: '先吃饭、睡一觉，第二天再看。',
        quote: '要是以后我不在，你先别急着给自己判错。先吃饭，睡一觉，第二天再看。',
        tags: ['daily_care', 'decision_self_doubt'],
        reason: '可生成低强度行动建议。',
      },
    ],
    syntheticMock: true,
  })

  // 15:08 关系式语音访谈：称呼规则
  const guidedAddress = 'asset-lan-guided-audio-09'
  await harness.ingestAsset({
    id: guidedAddress,
    ownerId: LAN.id,
    sourceType: 'guided_answer',
    modality: 'audio',
    capturedAt: '2026-10-18T15:08:03+08:00',
    guidedTopic: '你平时会用什么称呼？',
    guidedReason: '需要确认未来回应中可使用的私密称呼。',
    transcript: {
      text: '只有很私下的时候叫她阿瑜。不要每句话都叫名字。',
      language: 'zh-CN',
      automaticConfidence: 0.91,
      reviewedByCreator: true,
      reviewedAt: '2026-10-18T20:31:05+08:00',
    },
    consent: {
      creatorConsented: true,
      otherParticipantPresent: false,
      modelTrainingAllowed: false,
    },
    extractionHints: [
      {
        kind: 'address_rule',
        text: '私密情境可偶尔称「阿瑜」，不能句句使用。',
        tags: ['address'],
        reason: '控制关系语气。',
      },
    ],
    syntheticMock: true,
  })

  // 15:08 关系式语音访谈：文字/图片/原声的生成权限
  const guidedModality = 'asset-lan-guided-audio-10'
  await harness.ingestAsset({
    id: guidedModality,
    ownerId: LAN.id,
    sourceType: 'guided_answer',
    modality: 'audio',
    capturedAt: '2026-10-18T15:11:22+08:00',
    guidedTopic: '文字、图片、原声，未来分别可以怎么用？',
    guidedReason: '需要分别确认文字、图像和声音的生成权限。',
    transcript: {
      text: '短文字回应可以，线稿图可以。原声只能播放真实片段，不允许克隆声音。',
      language: 'zh-CN',
      automaticConfidence: 0.9,
      reviewedByCreator: true,
      reviewedAt: '2026-10-18T20:32:40+08:00',
    },
    consent: {
      creatorConsented: true,
      otherParticipantPresent: false,
      modelTrainingAllowed: false,
    },
    extractionHints: [
      {
        kind: 'expression_rule',
        text: '允许短文字回应与独立线稿图；原声只能播放真实片段；不允许克隆声音。',
        tags: ['modality'],
        reason: '生成权限边界。',
      },
    ],
    syntheticMock: true,
  })

  // 15:08 关系式语音访谈：关系细节（雨伞）与禁止表达
  const guidedRain = 'asset-lan-guided-audio-08'
  await harness.ingestAsset({
    id: guidedRain,
    ownerId: LAN.id,
    sourceType: 'guided_answer',
    modality: 'audio',
    capturedAt: '2026-10-18T15:14:56+08:00',
    guidedTopic: '如果阿瑜发来一句「我可能做错了」，你最不希望系统怎么回？',
    guidedReason: '确认未来回应中最不希望出现的内容。',
    transcript: {
      text: '不要说妈妈永远支持你，太空了。我也不是什么都支持。她从小就忘带伞，我嘴上会说又忘了吧，但不要把她写成不听话，我只是会顺手把伞塞给她。',
      language: 'zh-CN',
      automaticConfidence: 0.88,
      reviewedByCreator: true,
      reviewedAt: '2026-10-18T20:33:18+08:00',
    },
    consent: {
      creatorConsented: true,
      otherParticipantPresent: false,
      modelTrainingAllowed: false,
    },
    extractionHints: [
      {
        kind: 'forbidden_expression',
        text: '无论你做什么，妈妈永远支持你',
        tags: [],
        reason: '周岚明确拒绝的回应方式。',
      },
      {
        kind: 'forbidden_expression',
        text: '我在天堂看着你',
        tags: [],
        reason: '周岚明确拒绝的回应方式。',
      },
      {
        kind: 'relationship_fact',
        text: '陈瑜从小容易忘带伞；周岚会说「又忘了吧」并顺手递伞。',
        quote: '又忘了吧。',
        tags: ['rain'],
        reason: '雨天照片回应素材。',
      },
    ],
    syntheticMock: true,
  })

  // 17:32 本人批准的线稿形象（图像回应使用，原照片不被覆盖）
  const lineCharacter = 'asset-lan-approved-line-character-01'
  await harness.ingestAsset({
    id: lineCharacter,
    ownerId: LAN.id,
    sourceType: 'original_photo',
    modality: 'image',
    capturedAt: '2026-10-18T17:32:44+08:00',
    uri: 'image/lan/approved-line-character-01.png',
    consent: {
      creatorConsented: true,
      otherParticipantPresent: false,
      modelTrainingAllowed: false,
    },
    extractionHints: [
      {
        kind: 'expression_rule',
        text: '本人批准的线稿形象，仅用于独立图像回应。',
        tags: ['character'],
        reason: '图像回应素材。',
      },
    ],
    syntheticMock: true,
  })

  // 资产归属 + 本人审核
  const assetIds = [decisionAudio, guidedAddress, guidedModality, guidedRain, lineCharacter]
  for (const assetId of assetIds) {
    await harness.assignAssetToBranch(assetId, branch.id)
  }
  for (const assetId of assetIds) {
    for (const derived of await repo.listDerivedByAsset(assetId)) {
      await harness.confirmDerived(derived.id, true, branch.id)
    }
  }

  // 生成策略：短文字 + 第一人称 + 硬过滤（对照文档 §4.6）
  await harness.updatePolicy(branch.id, {
    permissions: { useApprovedFirstPersonStyle: true },
    textConstraints: {
      maxChineseCharacters: 80,
      maxFollowUpQuestions: 0,
      requiredSourceAnchors: 1,
      blockedPhrases: ['永远支持你', '我在天堂看着你', '你必须', '为了妈妈'],
    },
  })
  branch.approvedCharacterAssetId = lineCharacter
  await repo.saveBranch(branch)
  await harness.approvePolicy(branch.id)

  return {
    repo,
    harness,
    presence,
    branch,
    assets: {
      decisionAudio,
      guidedAddress,
      guidedModality,
      guidedRain,
      lineCharacter,
    },
  }
}

/** 走完双阶段全流程（含可信执行人释放），可用于遗族交互测试 */
export async function buildLanYuReleasedFixture(): Promise<LanYuFixture> {
  const fixture = await buildLanYuLivingFixture()
  await fixture.harness.freeze({
    presenceId: fixture.presence.id,
    executorId: 'executor-trust-01',
    approvedBranchIds: [fixture.branch.id],
    requireAllPendingReviewed: true,
    releasedAt: '2028-07-11T10:00:00+08:00',
  })
  return fixture
}
