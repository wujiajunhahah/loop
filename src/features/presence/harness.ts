/**
 * Presence Harness —— 把「前面的 content」蒸馏成「这个人」，再服务遗族交互。
 *
 * 对照 2026-08-02 会议共识：engine 本质上就是一套 harness，
 * 输入是前人留下的 content（想对你说什么、希望你未来怎么做、某些情境注意什么），
 * 输出是给遗族的、有来源、受策略约束的呈现。
 *
 * 在世阶段（living_editable）：
 *   ingest（收录原始资产，生成候选）
 *   -> confirm（本人确认资产归属分支 + 确认/拒绝派生内容）
 *   -> rehearse / applyCorrection（预演未来回应并纠正系统）
 *   -> freeze（可信执行人确认释放条件，冻结 Presence）
 *
 * 离世后阶段（frozen_released）：
 *   respond（遗族新输入 + 旧 Context -> 有源检索 -> 策略约束生成 -> 呈现）
 *   recordRecipientFeedback（反馈只调整接收者自己的呈现偏好）
 *   recordVoiceNote（留声，不伪造已读、不强行回复）
 */
import { PresenceError } from './errors'
import { RuleBasedExtractor, type PresenceExtractor } from './extractor'
import { composeResponse } from './generation'
import { assertPolicySafe, isSourceBlocked } from './policy'
import type { PresenceRepository } from './repository'
import { retrieveGroundedSources } from './retrieval'
import type {
  DeepPartial,
  DerivedContext,
  GenerationPolicy,
  Person,
  Presence,
  PresenceResponse,
  RecipientExpression,
  RecipientFeedback,
  RehearsalCorrection,
  RehearsalResult,
  RelationshipBranch,
  RelationshipTimelineEntry,
  ReleaseOrder,
  SourceAsset,
} from './types'

export interface CreateBranchInput {
  presenceId: string
  creatorId: string
  recipientId: string
  relationshipType: string
  creatorCallsRecipient?: string
}

export class PresenceHarness {
  private idCounter = 0

  constructor(
    private readonly repo: PresenceRepository,
    private readonly extractor: PresenceExtractor = new RuleBasedExtractor(),
  ) {}

  private newId(prefix: string): string {
    this.idCounter += 1
    return `${prefix}-${this.idCounter}`
  }

  // ---------------------------------------------------------------- 建仓

  async createPresence(owner: Person): Promise<Presence> {
    const id = `presence-${owner.id}`
    if (await this.repo.getPresence(id)) {
      throw new PresenceError(
        'PRESENCE_NOT_FOUND',
        `Presence for owner ${owner.id} already exists.`,
      )
    }
    const presence: Presence = {
      id,
      ownerId: owner.id,
      state: 'living_editable',
      version: 1,
      originalAssetCount: 0,
      reviewedAssetCount: 0,
      unreviewedAssetCount: 0,
      reviewedAssetIds: [],
      branchIds: [],
    }
    await this.repo.savePresence(presence)
    return presence
  }

  async createBranch(input: CreateBranchInput): Promise<RelationshipBranch> {
    const presence = await this.requirePresence(input.presenceId)
    this.requireEditable(presence)
    const branch: RelationshipBranch = {
      id: this.newId('branch'),
      presenceId: presence.id,
      creatorId: input.creatorId,
      recipientId: input.recipientId,
      relationshipType: input.relationshipType,
      creatorCallsRecipient: input.creatorCallsRecipient,
      status: 'living_training',
      approvedSourceIds: [],
      confirmedDerivedIds: [],
      policy: defaultPolicy(this.newId('policy')),
    }
    await this.repo.saveBranch(branch)
    presence.branchIds = [...presence.branchIds, branch.id]
    await this.repo.savePresence(presence)
    return branch
  }

  // ------------------------------------------- 蒸馏：ingest -> extract -> confirm

  /**
   * 收录一条原始资产并提取待确认候选。
   * 返回的候选全部是 candidate；未经本人确认的内容永远不可见、不可用。
   */
  async ingestAsset(asset: SourceAsset): Promise<DerivedContext[]> {
    const presence = await this.repo.getPresenceByOwner(asset.ownerId)
    if (!presence) {
      throw new PresenceError(
        'PRESENCE_NOT_FOUND',
        `No presence exists for owner ${asset.ownerId}; create it first.`,
      )
    }
    if (!asset.consent.creatorConsented) {
      throw new PresenceError(
        'CONSENT_MISSING',
        `Asset ${asset.id} lacks creator consent and cannot be ingested.`,
      )
    }
    if (asset.consent.modelTrainingAllowed) {
      throw new PresenceError(
        'POLICY_UNSAFE',
        'Model training consent must stay false for ingested assets.',
      )
    }
    await this.repo.saveAsset(asset)

    presence.originalAssetCount += 1
    presence.unreviewedAssetCount += 1
    presence.version += 1
    await this.repo.savePresence(presence)

    const candidates = await this.extractor.extract(asset)
    for (const candidate of candidates) {
      await this.repo.saveDerived(candidate)
    }
    return candidates
  }

  /** 本人把资产放入某个关系分支（归属关系，仍不释放给接收者）。 */
  async assignAssetToBranch(assetId: string, branchId: string): Promise<void> {
    const asset = await this.repo.getAsset(assetId)
    if (!asset) {
      throw new PresenceError('ASSET_NOT_FOUND', `Asset ${assetId} not found.`)
    }
    const branch = await this.requireBranch(branchId)
    const presence = await this.requirePresence(branch.presenceId)
    this.requireEditable(presence)
    if (asset.ownerId !== branch.creatorId) {
      throw new PresenceError(
        'WRONG_RECIPIENT',
        `Asset ${assetId} does not belong to creator ${branch.creatorId}.`,
      )
    }
    if (branch.approvedSourceIds.includes(assetId)) return
    branch.approvedSourceIds = [...branch.approvedSourceIds, assetId]
    await this.repo.saveBranch(branch)
  }

  /**
   * 本人确认或拒绝一条派生候选。
   * 确认禁区表达会同步写进所属分支的策略硬过滤；
   * 资产的全部候选审核完成后，Presence 的已审核计数才 +1。
   */
  async confirmDerived(
    derivedId: string,
    approved: boolean,
    branchId?: string,
  ): Promise<void> {
    const derived = await this.repo.getDerived(derivedId)
    if (!derived) {
      throw new PresenceError('DERIVED_NOT_FOUND', `Derived ${derivedId} not found.`)
    }
    const presence = await this.repo.getPresenceByOwner(
      (await this.repo.getAsset(derived.assetId))?.ownerId ?? '',
    )
    if (presence) this.requireEditable(presence)

    derived.status = approved ? 'confirmed' : 'rejected'
    derived.approvedByCreator = approved
    derived.confirmedAt = new Date().toISOString()
    await this.repo.saveDerived(derived)

    // 登记到所属分支：确认的禁区表达同步成为该分支策略的硬过滤词
    const targetBranch = branchId
      ? await this.repo.getBranch(branchId)
      : await this.repo.findBranchByAsset(derived.assetId)
    if (targetBranch && approved) {
      if (!targetBranch.confirmedDerivedIds.includes(derivedId)) {
        targetBranch.confirmedDerivedIds = [
          ...targetBranch.confirmedDerivedIds,
          derivedId,
        ]
      }
      if (derived.kind === 'forbidden_expression' && derived.text) {
        const blocked = targetBranch.policy.textConstraints.blockedPhrases
        if (!blocked.includes(derived.text)) {
          targetBranch.policy = {
            ...targetBranch.policy,
            version: targetBranch.policy.version + 1,
            textConstraints: {
              ...targetBranch.policy.textConstraints,
              blockedPhrases: [...blocked, derived.text],
            },
          }
        }
      }
      await this.repo.saveBranch(targetBranch)
    }

    // 资产级审核计数：该资产全部候选都已被确认/拒绝后，资产才算审核完成
    if (presence) {
      const asset = await this.repo.getAsset(derived.assetId)
      const all = await this.repo.listDerivedByAsset(derived.assetId)
      if (asset && all.every((d) => d.status !== 'candidate')) {
        if (!presence.reviewedAssetIds.includes(asset.id)) {
          presence.reviewedAssetIds = [...presence.reviewedAssetIds, asset.id]
          presence.reviewedAssetCount += 1
          presence.unreviewedAssetCount = Math.max(
            0,
            presence.unreviewedAssetCount - 1,
          )
          presence.version += 1
          await this.repo.savePresence(presence)
        }
      }
    }
  }

  /** 更新分支生成策略；策略层硬约束（声音克隆等）永远不可打开。 */
  async updatePolicy(
    branchId: string,
    patch: DeepPartial<GenerationPolicy>,
  ): Promise<GenerationPolicy> {
    const branch = await this.requireBranch(branchId)
    const presence = await this.requirePresence(branch.presenceId)
    this.requireEditable(presence)
    const next = mergePolicy(branch.policy, patch)
    assertPolicySafe(next)
    branch.policy = next
    await this.repo.saveBranch(branch)
    return next
  }

  /** 本人批准当前策略版本（批准前，离世后阶段不会服务任何回应）。 */
  async approvePolicy(branchId: string): Promise<GenerationPolicy> {
    const branch = await this.requireBranch(branchId)
    const presence = await this.requirePresence(branch.presenceId)
    this.requireEditable(presence)
    assertPolicySafe(branch.policy)
    branch.policy = {
      ...branch.policy,
      approvedByCreator: true,
      approvedAt: new Date().toISOString(),
      version: branch.policy.version + 1,
    }
    await this.repo.saveBranch(branch)
    return branch.policy
  }

  // --------------------------------------------- 蒸馏：预演未来回应并纠正系统

  /** 本人输入一句「测试输入」，预演未来系统会如何回应（不写时间线）。 */
  async rehearse(branchId: string, input: string): Promise<RehearsalResult> {
    const branch = await this.requireBranch(branchId)
    const presence = await this.requirePresence(branch.presenceId)
    const expression: RecipientExpression = {
      id: this.newId('rehearsal'),
      branchId: branch.id,
      authorId: branch.recipientId,
      mode: 'rehearsal',
      content: { type: 'text', text: input },
      createdAt: new Date().toISOString(),
    }
    const response = await this.composeResponse(expression, branch, presence)
    return { input, response, corrected: false }
  }

  /** 本人对预演结果做纠正：拒绝候选、追加禁区、调整策略。 */
  async applyCorrection(
    branchId: string,
    correction: RehearsalCorrection,
  ): Promise<void> {
    const branch = await this.requireBranch(branchId)
    const presence = await this.requirePresence(branch.presenceId)
    this.requireEditable(presence)

    for (const derivedId of correction.rejectDerivedIds ?? []) {
      const derived = await this.repo.getDerived(derivedId)
      if (derived && derived.status !== 'rejected') {
        derived.status = 'rejected'
        derived.approvedByCreator = false
        await this.repo.saveDerived(derived)
      }
    }

    if (correction.addBlockedPhrases?.length) {
      const blocked = branch.policy.textConstraints.blockedPhrases
      const added = correction.addBlockedPhrases.filter(
        (p) => p.length > 0 && !blocked.includes(p),
      )
      if (added.length > 0) {
        branch.policy = {
          ...branch.policy,
          version: branch.policy.version + 1,
          textConstraints: {
            ...branch.policy.textConstraints,
            blockedPhrases: [...blocked, ...added],
          },
        }
      }
    }

    if (correction.policyPatch) {
      const next = mergePolicy(branch.policy, correction.policyPatch)
      assertPolicySafe(next)
      branch.policy = next
    }

    await this.repo.saveBranch(branch)
  }

  // ----------------------------------------------- 状态翻转：freeze / release

  /** 可信执行人确认释放条件：冻结 Presence，只开放指定关系分支。 */
  async freeze(order: ReleaseOrder): Promise<Presence> {
    const presence = await this.requirePresence(order.presenceId)
    this.requireEditable(presence)

    for (const branchId of order.approvedBranchIds) {
      const branch = await this.requireBranch(branchId)
      if (branch.presenceId !== presence.id) {
        throw new PresenceError(
          'BRANCH_NOT_FOUND',
          `Branch ${branchId} does not belong to presence ${presence.id}.`,
        )
      }
      if (!branch.policy.approvedByCreator) {
        throw new PresenceError(
          'POLICY_NOT_APPROVED',
          `Branch ${branchId} policy is not approved by the creator before release.`,
        )
      }
      if (order.requireAllPendingReviewed) {
        for (const assetId of branch.approvedSourceIds) {
          const asset = await this.repo.getAsset(assetId)
          if (!asset) continue
          if (
            (asset.sourceType === 'original_audio' ||
              asset.sourceType === 'guided_answer') &&
            !asset.transcript?.reviewedByCreator
          ) {
            throw new PresenceError(
              'UNREVIEWED_ASSET',
              `Asset ${assetId} transcript has not been reviewed by the creator.`,
            )
          }
          const pending = await this.repo.listDerivedByAsset(assetId)
          if (pending.some((d) => d.status === 'candidate')) {
            throw new PresenceError(
              'PENDING_REVIEW_AT_RELEASE',
              `Asset ${assetId} still has unreviewed candidates.`,
            )
          }
        }
      }
    }

    const approvedSet = new Set(order.approvedBranchIds)
    for (const branch of await this.repo.listBranches(presence.id)) {
      if (approvedSet.has(branch.id)) {
        branch.status = 'released'
        branch.releasedAt = order.releasedAt
      } else {
        branch.status = 'suspended'
      }
      await this.repo.saveBranch(branch)
    }

    presence.state = 'frozen_released'
    presence.frozenAt = order.releasedAt
    presence.version += 1
    await this.repo.savePresence(presence)
    return presence
  }

  // ------------------------------------------------------- 遗族交互：respond

  /** 遗族发来今天的新输入；返回有来源的回应，并写入双方关系时间线。 */
  async respond(expression: RecipientExpression): Promise<PresenceResponse> {
    const branch = await this.requireBranch(expression.branchId)
    const presence = await this.requirePresence(branch.presenceId)

    // 硬件 Context 只能参与生活情境与媒介选择，永远不允许携带情绪推断
    if (expression.currentContext?.emotionInferredFromWearable) {
      throw new PresenceError(
        'EMOTION_INFERENCE_REJECTED',
        'Wearable context must never carry emotion inference.',
      )
    }
    if (expression.currentContext?.preciseLocationStored) {
      throw new PresenceError(
        'EMOTION_INFERENCE_REJECTED',
        'Precise location must not be stored.',
      )
    }
    if (presence.state !== 'frozen_released') {
      throw new PresenceError(
        'NOT_RELEASED',
        `Presence ${presence.id} has not been released.`,
      )
    }
    if (branch.status !== 'released') {
      throw new PresenceError(
        'BRANCH_NOT_RELEASED',
        `Branch ${branch.id} is not released for this recipient.`,
      )
    }
    if (expression.authorId !== branch.recipientId) {
      throw new PresenceError(
        'WRONG_RECIPIENT',
        `Expression author ${expression.authorId} is not the recipient of branch ${branch.id}.`,
      )
    }
    if (!branch.policy.approvedByCreator) {
      throw new PresenceError(
        'POLICY_NOT_APPROVED',
        `Branch ${branch.id} policy is not approved by the creator.`,
      )
    }

    const response = await this.composeResponse(expression, branch, presence)

    const base = {
      branchId: branch.id,
      authorId: expression.authorId,
      createdAt: expression.createdAt,
    }
    await this.repo.appendTimeline({
      id: this.newId('timeline'),
      kind: 'recipient_expression',
      expressionId: expression.id,
      ...base,
    } satisfies RelationshipTimelineEntry)
    await this.repo.appendTimeline({
      id: this.newId('timeline'),
      kind: 'presence_response',
      expressionId: expression.id,
      responseId: response.id,
      ...base,
    } satisfies RelationshipTimelineEntry)
    return response
  }

  /** 接收者反馈：只调整接收者自己的呈现偏好，不改写创作者 Presence。 */
  async recordRecipientFeedback(
    branchId: string,
    feedback: RecipientFeedback,
  ): Promise<void> {
    const branch = await this.requireBranch(branchId)
    branch.recipientPrefs = {
      ...branch.recipientPrefs,
      ...(feedback.futureTextPreference
        ? { textPreference: feedback.futureTextPreference }
        : {}),
      ...(feedback.futureImagePreference
        ? { imagePreference: feedback.futureImagePreference }
        : {}),
    }
    await this.repo.saveBranch(branch)
    await this.repo.saveFeedback(branchId, feedback)
  }

  /** 遗族留一段话给 Ta：保存到关系时间线，不伪造已读、不强行生成回复。 */
  async recordVoiceNote(
    branchId: string,
    authorId: string,
    createdAt: string,
  ): Promise<void> {
    const branch = await this.requireBranch(branchId)
    if (authorId !== branch.recipientId) {
      throw new PresenceError(
        'WRONG_RECIPIENT',
        `Voice note author ${authorId} is not the recipient of branch ${branch.id}.`,
      )
    }
    await this.repo.appendTimeline({
      id: this.newId('timeline'),
      branchId: branch.id,
      authorId,
      kind: 'recipient_voice_note',
      createdAt,
    })
  }

  async timeline(
    branchId: string,
  ): Promise<readonly RelationshipTimelineEntry[]> {
    await this.requireBranch(branchId)
    return this.repo.listTimeline(branchId)
  }

  // ---------------------------------------------------------------- 内部

  /** 共享的回应合成：检索 + 禁区过滤 + 策略约束生成（不写时间线）。 */
  private async composeResponse(
    expression: RecipientExpression,
    branch: RelationshipBranch,
    presence: Presence,
  ): Promise<PresenceResponse> {
    const assetIds = new Set(branch.approvedSourceIds)
    const allDerived = await Promise.all(
      [...assetIds].map((id) => this.repo.listDerivedByAsset(id)),
    )
    const confirmed = allDerived
      .flat()
      .filter((d) => d.status === 'confirmed' && d.approvedByCreator)
    const sources = retrieveGroundedSources(expression, confirmed)
    const usable = sources.filter((s) => {
      const derived = confirmed.find((d) => d.id === s.derivedId)
      return derived ? !isSourceBlocked(derived, branch.policy) : false
    })

    return composeResponse({
      branch,
      presence,
      expression,
      sources: usable,
      confirmedDerived: confirmed,
      now: new Date().toISOString(),
      newId: (prefix) => this.newId(prefix),
    })
  }

  private async requirePresence(id: string): Promise<Presence> {
    const presence = await this.repo.getPresence(id)
    if (!presence) {
      throw new PresenceError('PRESENCE_NOT_FOUND', `Presence ${id} not found.`)
    }
    return presence
  }

  private async requireBranch(id: string): Promise<RelationshipBranch> {
    const branch = await this.repo.getBranch(id)
    if (!branch) {
      throw new PresenceError('BRANCH_NOT_FOUND', `Branch ${id} not found.`)
    }
    return branch
  }

  private requireEditable(presence: Presence): void {
    if (presence.state !== 'living_editable') {
      throw new PresenceError(
        'NOT_EDITABLE',
        `Presence ${presence.id} is ${presence.state}; creator-side edits are closed.`,
      )
    }
  }
}

function mergePolicy(
  base: GenerationPolicy,
  patch: DeepPartial<GenerationPolicy>,
): GenerationPolicy {
  return {
    ...base,
    ...patch,
    permissions: { ...base.permissions, ...(patch.permissions ?? {}) },
    textConstraints: {
      ...base.textConstraints,
      ...(patch.textConstraints ?? {}),
      blockedPhrases: (
        patch.textConstraints?.blockedPhrases ??
        base.textConstraints.blockedPhrases
      ).filter((p): p is string => p !== undefined),
    },
    delivery: { ...base.delivery, ...(patch.delivery ?? {}) },
    version: base.version + 1,
  }
}

function defaultPolicy(branchId: string): GenerationPolicy {
  return {
    branchId,
    version: 1,
    approvedByCreator: false,
    permissions: {
      retrieveOriginalText: true,
      playOriginalAudioOnRecipientRequest: true,
      generateShortTextResponse: true,
      useApprovedFirstPersonStyle: false,
      generateSeparateLineArtResponse: true,
      modifyRecipientOriginalPhoto: false,
      cloneVoice: false,
      generateNewHistoricalFacts: false,
      generateNewPromisesOrWishes: false,
      useForModelTraining: false,
      shareWithOtherRelationshipBranches: false,
    },
    textConstraints: {
      maxChineseCharacters: 80,
      maxFollowUpQuestions: 0,
      requiredSourceAnchors: 1,
      blockedPhrases: [],
    },
    delivery: {
      recipientInitiatedByDefault: true,
      silentContextualEntryAllowed: false,
      automaticVoicePlayback: false,
    },
  }
}
