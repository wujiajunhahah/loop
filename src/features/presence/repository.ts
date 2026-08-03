/**
 * Presence 仓储契约 + 内存实现。
 *
 * Harness 只依赖契约，UI / 生产环境可以换成自己的持久化实现；
 * 内存实现用于黑客松 Demo 与测试。
 */
import type {
  DerivedContext,
  Presence,
  RecipientFeedback,
  RelationshipBranch,
  RelationshipTimelineEntry,
  SourceAsset,
} from './types'

export interface PresenceRepository {
  getPresence(id: string): Promise<Presence | undefined>
  getPresenceByOwner(ownerId: string): Promise<Presence | undefined>
  savePresence(presence: Presence): Promise<void>
  getBranch(id: string): Promise<RelationshipBranch | undefined>
  saveBranch(branch: RelationshipBranch): Promise<void>
  listBranches(presenceId: string): Promise<readonly RelationshipBranch[]>
  findBranchByAsset(assetId: string): Promise<RelationshipBranch | undefined>
  getAsset(id: string): Promise<SourceAsset | undefined>
  saveAsset(asset: SourceAsset): Promise<void>
  listAssets(ownerId: string): Promise<readonly SourceAsset[]>
  getDerived(id: string): Promise<DerivedContext | undefined>
  saveDerived(derived: DerivedContext): Promise<void>
  listDerivedByAsset(assetId: string): Promise<readonly DerivedContext[]>
  appendTimeline(entry: RelationshipTimelineEntry): Promise<void>
  listTimeline(branchId: string): Promise<readonly RelationshipTimelineEntry[]>
  saveFeedback(branchId: string, feedback: RecipientFeedback): Promise<void>
}

export function createInMemoryPresenceRepository(): PresenceRepository {
  const presences = new Map<string, Presence>()
  const branches = new Map<string, RelationshipBranch>()
  const assets = new Map<string, SourceAsset>()
  const derived = new Map<string, DerivedContext>()
  const timeline = new Map<string, RelationshipTimelineEntry[]>()
  const feedback = new Map<string, RecipientFeedback[]>()

  return {
    async getPresence(id) {
      return presences.get(id)
    },
    async getPresenceByOwner(ownerId) {
      return [...presences.values()].find((p) => p.ownerId === ownerId)
    },
    async savePresence(p) {
      presences.set(p.id, p)
    },
    async getBranch(id) {
      return branches.get(id)
    },
    async saveBranch(b) {
      branches.set(b.id, b)
    },
    async listBranches(presenceId) {
      return [...branches.values()].filter((b) => b.presenceId === presenceId)
    },
    async findBranchByAsset(assetId) {
      return [...branches.values()].find((b) =>
        b.approvedSourceIds.includes(assetId),
      )
    },
    async getAsset(id) {
      return assets.get(id)
    },
    async saveAsset(a) {
      assets.set(a.id, a)
    },
    async listAssets(ownerId) {
      return [...assets.values()].filter((a) => a.ownerId === ownerId)
    },
    async getDerived(id) {
      return derived.get(id)
    },
    async saveDerived(d) {
      derived.set(d.id, d)
    },
    async listDerivedByAsset(assetId) {
      return [...derived.values()].filter((d) => d.assetId === assetId)
    },
    async appendTimeline(entry) {
      const list = timeline.get(entry.branchId) ?? []
      list.push(entry)
      timeline.set(entry.branchId, list)
    },
    async listTimeline(branchId) {
      return timeline.get(branchId) ?? []
    },
    async saveFeedback(branchId, f) {
      const list = feedback.get(branchId) ?? []
      list.push(f)
      feedback.set(branchId, list)
    },
  }
}
