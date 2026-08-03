// @vitest-environment node
/**
 * Presence Harness 测试：覆盖交互设计文档 §11 的 12 条产品断言，
 * 以及蒸馏管线 / 释放门禁 / 遗族交互的边界行为。
 */
import { describe, expect, it } from 'vitest'
import { PresenceHarness } from './harness'
import { PresenceError } from './errors'
import { createInMemoryPresenceRepository, type PresenceRepository } from './repository'
import {
  buildLanYuLivingFixture,
  buildLanYuReleasedFixture,
  LAN,
  YU,
} from './seed'
import type {
  Person,
  Presence,
  RelationshipBranch,
  SourceAsset,
} from './types'

const DECISION_QUOTE =
  '要是以后我不在，你先别急着给自己判错。先吃饭，睡一觉，第二天再看。'

// ---------------------------------------------------------------- 工具

async function buildMinimalFixture(opts?: {
  approvePolicy?: boolean
  confirmAll?: boolean
  release?: boolean
  reviewedTranscript?: boolean
}): Promise<{
  repo: PresenceRepository
  harness: PresenceHarness
  presence: Presence
  branch: RelationshipBranch
  derivedIds: string[]
}> {
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
  const asset: SourceAsset = {
    id: 'asset-mini-01',
    ownerId: LAN.id,
    sourceType: 'original_audio',
    modality: 'audio',
    capturedAt: '2026-10-18T10:43:18+08:00',
    transcript: {
      text: DECISION_QUOTE,
      language: 'zh-CN',
      reviewedByCreator: opts?.reviewedTranscript ?? true,
    },
    consent: { creatorConsented: true, otherParticipantPresent: false, modelTrainingAllowed: false },
    extractionHints: [
      {
        kind: 'source_quote',
        text: DECISION_QUOTE,
        quote: DECISION_QUOTE,
        tags: ['decision_self_doubt'],
        reason: '原话来源锚点。',
      },
    ],
    syntheticMock: true,
  }
  const [derived] = await harness.ingestAsset(asset)
  await harness.assignAssetToBranch(asset.id, branch.id)
  if (opts?.confirmAll ?? true) {
    await harness.confirmDerived(derived.id, true, branch.id)
  }
  if (opts?.approvePolicy ?? true) {
    await harness.updatePolicy(branch.id, {
      permissions: { useApprovedFirstPersonStyle: true },
    })
    await harness.approvePolicy(branch.id)
  }
  if (opts?.release) {
    await harness.freeze({
      presenceId: presence.id,
      executorId: 'executor-trust-01',
      approvedBranchIds: [branch.id],
      requireAllPendingReviewed: true,
      releasedAt: '2028-07-11T10:00:00+08:00',
    })
  }
  return { repo, harness, presence, branch, derivedIds: [derived.id] }
}

function expressionOf(branch: RelationshipBranch, overrides: Record<string, unknown> = {}) {
  return {
    id: 'expression-test-01',
    branchId: branch.id,
    authorId: YU.id,
    mode: 'recipient_initiated' as const,
    content: { type: 'text' as const, text: '我今天提了离职。手一直在抖，我不知道是不是做错了。' },
    createdAt: '2029-11-07T18:44:01+08:00',
    ...overrides,
  }
}

// ------------------------------------------------ 断言 1/2/3：输入可见、理由透明、三层分离

describe('蒸馏管线：输入立即可见、理由透明、三层分离', () => {
  it('断言1：每次输入都立即改变 Presence，而不是只显示上传成功', async () => {
    const repo = createInMemoryPresenceRepository()
    const harness = new PresenceHarness(repo)
    const presence = await harness.createPresence(LAN)
    expect(presence.version).toBe(1)
    expect(presence.originalAssetCount).toBe(0)

    await harness.ingestAsset({
      id: 'asset-count-01',
      ownerId: LAN.id,
      sourceType: 'original_text',
      modality: 'text',
      capturedAt: '2026-10-18T10:00:00+08:00',
      text: '阿瑜，记得吃早饭。',
      consent: { creatorConsented: true, otherParticipantPresent: false, modelTrainingAllowed: false },
      extractionHints: [
        {
          kind: 'source_quote',
          text: '阿瑜，记得吃早饭。',
          quote: '阿瑜，记得吃早饭。',
          tags: ['daily_care'],
          reason: '日常关怀原话。',
        },
      ],
    })
    let updated = await repo.getPresence(presence.id)
    expect(updated?.originalAssetCount).toBe(1)
    expect(updated?.unreviewedAssetCount).toBe(1)
    expect(updated?.version).toBe(2)

    const [candidate] = await repo.listDerivedByAsset('asset-count-01')
    await harness.confirmDerived(candidate.id, true)
    updated = await repo.getPresence(presence.id)
    expect(updated?.reviewedAssetCount).toBe(1)
    expect(updated?.unreviewedAssetCount).toBe(0)
  })

  it('断言2：每个候选都携带「为什么」；关系席位问题不是对方本人发来的', async () => {
    const { repo } = await buildLanYuLivingFixture()
    const guided = await repo.getAsset('asset-lan-guided-audio-09')
    expect(guided?.guidedReason).toBe('需要确认未来回应中可使用的私密称呼。')
    const [candidate] = await repo.listDerivedByAsset('asset-lan-guided-audio-09')
    expect(candidate.reason).toBe('控制关系语气。')
    expect(candidate.status).toBe('confirmed')
  })

  it('断言3：Presence 至少区分公共身份、原始资产和关系专属分支', async () => {
    const { repo, presence, branch } = await buildLanYuLivingFixture()
    expect(presence.branchIds).toContain(branch.id)
    expect(branch.approvedSourceIds.length).toBe(5)
    expect(branch.policy.branchId).toBe(branch.policy.branchId)
    const assets = await repo.listAssets(LAN.id)
    expect(assets.length).toBe(5)
    // 公共身份层：ownerId 与 displayName 与分支内容分离
    expect(presence.ownerId).toBe(LAN.id)
    expect(branch.recipientId).toBe(YU.id)
  })
})

// ------------------------------------------------ 断言 4/5/7/8：来源、审核、策略硬约束

describe('蒸馏管线：来源可追溯、未确认不可用、策略硬约束', () => {
  it('断言4：未经本人确认的候选永远不可用', async () => {
    const { harness, branch } = await buildMinimalFixture({ confirmAll: false })
    const rehearsal = await harness.rehearse(branch.id, '我今天辞职了，可能做错了。')
    expect(rehearsal.response.kind).toBe('no_source_found')
  })

  it('预演纠正闭环：本人拒绝候选后，系统不再使用它', async () => {
    const repo = createInMemoryPresenceRepository()
    const harness = new PresenceHarness(repo)
    const presence = await harness.createPresence(LAN)
    const branch = await harness.createBranch({
      presenceId: presence.id,
      creatorId: LAN.id,
      recipientId: YU.id,
      relationshipType: 'mother_daughter',
    })
    const [derivedA, derivedB] = await harness.ingestAsset({
      id: 'asset-correction-01',
      ownerId: LAN.id,
      sourceType: 'original_text',
      modality: 'text',
      capturedAt: '2026-10-18T10:00:00+08:00',
      text: '测试素材',
      consent: { creatorConsented: true, otherParticipantPresent: false, modelTrainingAllowed: false },
      extractionHints: [
        {
          kind: 'source_quote',
          text: '无论你做什么，妈妈永远支持你。',
          quote: '无论你做什么，妈妈永远支持你。',
          tags: ['decision_self_doubt'],
          reason: '候选一：太正确、没有来源。',
        },
        {
          kind: 'source_quote',
          text: DECISION_QUOTE,
          quote: DECISION_QUOTE,
          tags: ['decision_self_doubt'],
          reason: '候选二：有原话锚点。',
        },
      ],
    })
    await harness.assignAssetToBranch('asset-correction-01', branch.id)
    await harness.confirmDerived(derivedA.id, true, branch.id)
    await harness.confirmDerived(derivedB.id, true, branch.id)

    // 第一次预演：排序靠前的候选一命中
    const first = await harness.rehearse(branch.id, '我可能做错了。')
    expect(first.response.output).toContain('妈妈永远支持你')

    // 本人纠正：拒绝候选一
    await harness.applyCorrection(branch.id, { rejectDerivedIds: [derivedA.id] })
    const second = await harness.rehearse(branch.id, '我可能做错了。')
    expect(second.response.output).toContain('判错')
    expect(second.response.output).not.toContain('妈妈永远支持你')
  })

  it('本人确认的禁区表达成为策略硬过滤，命中禁区的来源宁可沉默', async () => {
    const { harness, branch } = await buildMinimalFixture()
    // 把原话本身加入禁区：虽然它是真实原话，本人仍有权禁止它在未来被引用
    await harness.applyCorrection(branch.id, {
      addBlockedPhrases: ['判错'],
    })
    const rehearsal = await harness.rehearse(branch.id, '我今天辞职了，可能做错了。')
    expect(rehearsal.response.kind).toBe('no_source_found')
    expect(rehearsal.response.output).toBe('没有找到 Ta 留下过的相关内容。')
  })

  it('断言8：声音克隆/跨关系共享/训练等权限在策略层不可打开', async () => {
    const { harness, branch } = await buildMinimalFixture()
    for (const permission of [
      'cloneVoice',
      'generateNewHistoricalFacts',
      'generateNewPromisesOrWishes',
      'useForModelTraining',
      'shareWithOtherRelationshipBranches',
      'modifyRecipientOriginalPhoto',
    ] as const) {
      await expect(
        harness.updatePolicy(branch.id, { permissions: { [permission]: true } }),
      ).rejects.toThrow(PresenceError)
      await expect(
        harness.updatePolicy(branch.id, { permissions: { [permission]: true } }),
      ).rejects.toMatchObject({ code: 'POLICY_UNSAFE' })
    }
    // requiredSourceAnchors 必须 >= 1
    await expect(
      harness.updatePolicy(branch.id, { textConstraints: { requiredSourceAnchors: 0 } }),
    ).rejects.toMatchObject({ code: 'POLICY_UNSAFE' })
  })

  it('摄入门禁：无本人同意 / 允许模型训练的内容不能被摄入', async () => {
    const { harness } = await buildLanYuLivingFixture()
    await expect(
      harness.ingestAsset({
        id: 'asset-noconsent-01',
        ownerId: LAN.id,
        sourceType: 'original_text',
        modality: 'text',
        capturedAt: '2026-10-18T12:00:00+08:00',
        text: 'x',
        consent: { creatorConsented: false, otherParticipantPresent: false, modelTrainingAllowed: false },
      }),
    ).rejects.toMatchObject({ code: 'CONSENT_MISSING' })
    await expect(
      harness.ingestAsset({
        id: 'asset-training-01',
        ownerId: LAN.id,
        sourceType: 'original_text',
        modality: 'text',
        capturedAt: '2026-10-18T12:00:00+08:00',
        text: 'x',
        consent: { creatorConsented: true, otherParticipantPresent: false, modelTrainingAllowed: true },
      }),
    ).rejects.toMatchObject({ code: 'POLICY_UNSAFE' })
  })
})

// ------------------------------------------------ 释放门禁

describe('状态翻转：freeze 门禁与冻结后锁定', () => {
  it('策略未批准不能释放', async () => {
    const { harness, presence, branch } = await buildMinimalFixture({ approvePolicy: false })
    await expect(
      harness.freeze({
        presenceId: presence.id,
        executorId: 'executor-trust-01',
        approvedBranchIds: [branch.id],
        requireAllPendingReviewed: true,
        releasedAt: '2028-07-11T10:00:00+08:00',
      }),
    ).rejects.toMatchObject({ code: 'POLICY_NOT_APPROVED' })
  })

  it('存在未审核候选不能释放（未审核草稿不释放）', async () => {
    const { harness, presence, branch } = await buildMinimalFixture({ confirmAll: false })
    await expect(
      harness.freeze({
        presenceId: presence.id,
        executorId: 'executor-trust-01',
        approvedBranchIds: [branch.id],
        requireAllPendingReviewed: true,
        releasedAt: '2028-07-11T10:00:00+08:00',
      }),
    ).rejects.toMatchObject({ code: 'PENDING_REVIEW_AT_RELEASE' })
  })

  it('逐字稿未经本人审核的资产不能随分支释放', async () => {
    const { harness, presence, branch } = await buildMinimalFixture({ reviewedTranscript: false })
    await expect(
      harness.freeze({
        presenceId: presence.id,
        executorId: 'executor-trust-01',
        approvedBranchIds: [branch.id],
        requireAllPendingReviewed: true,
        releasedAt: '2028-07-11T10:00:00+08:00',
      }),
    ).rejects.toMatchObject({ code: 'UNREVIEWED_ASSET' })
  })

  it('冻结后创作者侧编辑关闭；未列入释放的分支保持关闭', async () => {
    const repo = createInMemoryPresenceRepository()
    const harness = new PresenceHarness(repo)
    const presence = await harness.createPresence(LAN)
    const branchA = await harness.createBranch({
      presenceId: presence.id,
      creatorId: LAN.id,
      recipientId: YU.id,
      relationshipType: 'mother_daughter',
    })
    const branchB = await harness.createBranch({
      presenceId: presence.id,
      creatorId: LAN.id,
      recipientId: 'person-other',
      relationshipType: 'friend',
    })
    for (const branch of [branchA, branchB]) {
      await harness.approvePolicy(branch.id)
    }
    await harness.freeze({
      presenceId: presence.id,
      executorId: 'executor-trust-01',
      approvedBranchIds: [branchA.id],
      requireAllPendingReviewed: false,
      releasedAt: '2028-07-11T10:00:00+08:00',
    })
    await expect(
      harness.applyCorrection(branchA.id, { addBlockedPhrases: ['x'] }),
    ).rejects.toMatchObject({ code: 'NOT_EDITABLE' })

    const frozenB = await repo.getBranch(branchB.id)
    expect(frozenB?.status).toBe('suspended')
    await expect(
      harness.respond(expressionOf(branchB)),
    ).rejects.toMatchObject({ code: 'BRANCH_NOT_RELEASED' })
  })
})

// ------------------------------------------------ 遗族交互（离世后阶段）

describe('遗族交互：有源回应、关系隔离、诚实沉默', () => {
  it('未释放前 respond 被拒绝', async () => {
    const { harness, branch } = await buildLanYuLivingFixture()
    await expect(harness.respond(expressionOf(branch))).rejects.toMatchObject({
      code: 'NOT_RELEASED',
    })
  })

  it('断言5/6：新输入 + 旧 Context 同时出现在生成轨迹；文字回应有来源披露', async () => {
    const { harness, branch } = await buildLanYuReleasedFixture()
    const response = await harness.respond(
      expressionOf(branch, {
        currentContext: {
          timeOfDay: 'evening',
          selfReportedState: 'uncertain_after_major_decision',
        },
      }),
    )
    expect(response.kind).toBe('grounded_quote')
    expect(response.sources.length).toBeGreaterThanOrEqual(1)
    const source = response.sources[0]
    expect(source.assetId).toBe('asset-lan-decision-audio-01')
    expect(source.quote).toBe(DECISION_QUOTE)
    expect(source.creatorReviewed).toBe(true)
    expect(source.relationshipMatch).toBe(true)
    expect(source.reason).toContain('输入文字命中主题')
    expect(response.presentation.label).toBe('我在回应')
    expect(response.presentation.generationDisclosureVisible).toBe(true)
    expect(response.presentation.sourceButtonVisible).toBe(true)
    expect(response.presentation.originalAudioAutoplayed).toBe(false)

    // 双方互动进入关系时间线
    const timeline = await harness.timeline(branch.id)
    expect(timeline.map((e) => e.kind)).toEqual([
      'recipient_expression',
      'presence_response',
    ])
  })

  it('断言7：回应只由已确认原话构成，不新增事实、承诺或追问', async () => {
    const { harness, branch } = await buildLanYuReleasedFixture()
    const response = await harness.respond(expressionOf(branch))
    // 输出 = 私密称呼 + 原话（未做任何改写）
    expect(response.output).toBe(`阿瑜，${DECISION_QUOTE}`)
    // 不新增任何超出原话与称呼的内容
    expect(response.output).not.toContain('永远')
    expect(response.output).not.toContain('天堂')
    expect(response.output).not.toContain('？')
  })

  it('断言6（图像）：照片输入 + 雨天情境 -> 独立线稿回应，原始照片不被覆盖', async () => {
    const { harness, branch } = await buildLanYuReleasedFixture()
    const response = await harness.respond(
      expressionOf(branch, {
        id: 'expression-photo-01',
        content: { type: 'photo', assetId: 'asset-yu-wet-shoes-01' },
        currentContext: { weather: 'rain' },
      }),
    )
    expect(response.kind).toBe('grounded_image')
    expect(response.image?.caption).toBe('又忘了吧。')
    expect(response.image?.approvedCharacterAssetId).toBe(
      'asset-lan-approved-line-character-01',
    )
    expect(response.image?.recipientOriginalModified).toBe(false)
    expect(response.image?.creatorImageModelUsed).toBe(false)
    expect(response.sources[0].reason).toContain('天气「rain」')
  })

  it('真实性优先：没有匹配素材时诚实说明，不编造更顺滑的答案', async () => {
    const { harness, branch } = await buildLanYuReleasedFixture()
    const response = await harness.respond(
      expressionOf(branch, {
        id: 'expression-none-01',
        content: { type: 'text', text: '今天楼下的桂花开了。' },
      }),
    )
    expect(response.kind).toBe('no_source_found')
    expect(response.output).toBe('没有找到 Ta 留下过的相关内容。')
    expect(response.sources).toEqual([])
  })

  it('关系隔离：一个分支的素材不会漏给另一个分支', async () => {
    const repo = createInMemoryPresenceRepository()
    const harness = new PresenceHarness(repo)
    const presence = await harness.createPresence(LAN)
    const branchYu = await harness.createBranch({
      presenceId: presence.id,
      creatorId: LAN.id,
      recipientId: YU.id,
      relationshipType: 'mother_daughter',
    })
    const branchHusband = await harness.createBranch({
      presenceId: presence.id,
      creatorId: LAN.id,
      recipientId: 'person-husband',
      relationshipType: 'spouse',
    })
    await harness.ingestAsset({
      id: 'asset-yu-only-01',
      ownerId: LAN.id,
      sourceType: 'original_text',
      modality: 'text',
      capturedAt: '2026-10-18T10:00:00+08:00',
      text: 'x',
      consent: { creatorConsented: true, otherParticipantPresent: false, modelTrainingAllowed: false },
      extractionHints: [
        {
          kind: 'source_quote',
          text: DECISION_QUOTE,
          quote: DECISION_QUOTE,
          tags: ['decision_self_doubt'],
          reason: '只属于陈瑜分支。',
        },
      ],
    })
    await harness.ingestAsset({
      id: 'asset-husband-only-01',
      ownerId: LAN.id,
      sourceType: 'original_text',
      modality: 'text',
      capturedAt: '2026-10-18T10:00:00+08:00',
      text: 'x',
      consent: { creatorConsented: true, otherParticipantPresent: false, modelTrainingAllowed: false },
      extractionHints: [
        {
          kind: 'source_quote',
          text: '出差记得带厚衣服。',
          quote: '出差记得带厚衣服。',
          tags: ['work_trip'],
          reason: '只属于丈夫分支。',
        },
      ],
    })
    for (const [assetId, branch] of [
      ['asset-yu-only-01', branchYu],
      ['asset-husband-only-01', branchHusband],
    ] as const) {
      await harness.assignAssetToBranch(assetId, branch.id)
      const [derived] = await repo.listDerivedByAsset(assetId)
      await harness.confirmDerived(derived.id, true, branch.id)
      await harness.approvePolicy(branch.id)
    }
    await harness.freeze({
      presenceId: presence.id,
      executorId: 'executor-trust-01',
      approvedBranchIds: [branchYu.id, branchHusband.id],
      requireAllPendingReviewed: true,
      releasedAt: '2028-07-11T10:00:00+08:00',
    })

    // 陈瑜的「做错」输入在丈夫分支没有素材 -> 诚实沉默
    const inHusband = await harness.respond(
      expressionOf(branchHusband, { authorId: 'person-husband' }),
    )
    expect(inHusband.kind).toBe('no_source_found')
    // 在陈瑜分支则有来源回应
    const inYu = await harness.respond(expressionOf(branchYu))
    expect(inYu.kind).toBe('grounded_quote')
  })

  it('错误接收者不能调用分支', async () => {
    const { harness, branch } = await buildLanYuReleasedFixture()
    await expect(
      harness.respond(expressionOf(branch, { authorId: 'person-other' })),
    ).rejects.toMatchObject({ code: 'WRONG_RECIPIENT' })
  })

  it('断言9：接收者反馈只调整自己的呈现偏好，不改写创作者 Presence', async () => {
    const { harness, branch, repo } = await buildLanYuReleasedFixture()
    const before = await harness.respond(expressionOf(branch))
    await harness.recordRecipientFeedback(branch.id, {
      fit: 'partly_like_her',
      issue: 'too_cute',
      futureImagePreference: 'restrained_low_expression',
    })
    const after = await harness.respond(expressionOf(branch))
    expect(after.output).toBe(before.output)
    expect(after.sources[0].quote).toBe(before.sources[0].quote)

    const branchNow = await repo.getBranch(branch.id)
    expect(branchNow?.recipientPrefs?.imagePreference).toBe(
      'restrained_low_expression',
    )
    expect(branchNow?.confirmedDerivedIds.length).toBeGreaterThanOrEqual(8)
    expect(branchNow?.policy.approvedAt).toBeDefined()
  })

  it('断言10：硬件 Context 永远不携带情绪推断；精确位置不存储', async () => {
    const { harness, branch } = await buildLanYuReleasedFixture()
    await expect(
      harness.respond(
        expressionOf(branch, {
          currentContext: { emotionInferredFromWearable: true },
        }),
      ),
    ).rejects.toMatchObject({ code: 'EMOTION_INFERENCE_REJECTED' })
    await expect(
      harness.respond(
        expressionOf(branch, {
          currentContext: { preciseLocationStored: true },
        }),
      ),
    ).rejects.toMatchObject({ code: 'EMOTION_INFERENCE_REJECTED' })
  })

  it('留声给 Ta：保存到时间线，不伪造已读、不强行生成回复', async () => {
    const { harness, branch } = await buildLanYuReleasedFixture()
    await harness.respond(expressionOf(branch))
    await harness.recordVoiceNote(
      branch.id,
      YU.id,
      '2029-11-07T19:05:00+08:00',
    )
    const timeline = await harness.timeline(branch.id)
    expect(timeline.length).toBe(3)
    expect(timeline[2].kind).toBe('recipient_voice_note')
    expect(timeline.filter((e) => e.kind === 'presence_response').length).toBe(1)
  })

  it('断言12：一轮有价值的互动在一轮后结束，不追加追问', async () => {
    const { harness, branch } = await buildLanYuReleasedFixture()
    const response = await harness.respond(expressionOf(branch))
    expect(response.output).not.toMatch(/[？?]/)
    const policy = (await harness.timeline(branch.id)) && branch.policy
    expect(policy?.textConstraints.maxFollowUpQuestions).toBe(0)
  })
})

// ------------------------------------------------ 种子数据自身不变量

describe('种子数据（周岚 / 陈瑜）不变量', () => {
  it('全部资产审核完成，Presence 计数与文档 §4.1 语义一致', async () => {
    const { presence, repo } = await buildLanYuReleasedFixture()
    expect(presence.originalAssetCount).toBe(5)
    expect(presence.reviewedAssetCount).toBe(5)
    expect(presence.unreviewedAssetCount).toBe(0)
    const assets = await repo.listAssets(LAN.id)
    expect(assets.every((a) => a.consent.creatorConsented)).toBe(true)
    expect(assets.every((a) => !a.consent.modelTrainingAllowed)).toBe(true)
  })

  it('释放后 Presence 冻结，只开放指定分支', async () => {
    const { presence, branch } = await buildLanYuReleasedFixture()
    expect(presence.state).toBe('frozen_released')
    expect(presence.frozenAt).toBe('2028-07-11T10:00:00+08:00')
    expect(branch.status).toBe('released')
    expect(branch.releasedAt).toBe('2028-07-11T10:00:00+08:00')
  })

  it('Person 模型与文档一致', () => {
    expect(LAN.displayName).toBe('周岚')
    expect(YU.displayName).toBe('陈瑜')
    expect(LAN.preferredSelfName).toBe('岚')
  })
})
