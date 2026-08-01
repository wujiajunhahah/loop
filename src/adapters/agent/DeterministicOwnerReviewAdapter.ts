import type {
  AgentOwnerReviewPort,
  OwnerReviewDecision,
} from '../../features/agent'

export class DeterministicOwnerReviewAdapter implements AgentOwnerReviewPort {
  constructor(private readonly decision: OwnerReviewDecision) {}

  async review(): Promise<OwnerReviewDecision> {
    return this.decision
  }
}
