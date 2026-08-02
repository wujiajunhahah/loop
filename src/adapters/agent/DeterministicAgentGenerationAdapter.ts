import type {
  AgentGenerationAdapter,
  GeneratedDraft,
} from '../../features/agent'

export class DeterministicAgentGenerationAdapter
  implements AgentGenerationAdapter
{
  constructor(private readonly override: Partial<GeneratedDraft> = {}) {}

  async generate(
    input: Parameters<AgentGenerationAdapter['generate']>[0],
  ): Promise<GeneratedDraft> {
    const sourceText = input.sources.map(({ meaning }) => meaning).join(' ')
    const prefix =
      input.mode === 'source_composition'
        ? `Approved-source summary for ${input.topic}:`
        : `Bounded inference from approved ${input.topic} sources:`
    const content = input.presentContext
      ? `你说：“${input.presentContext.content.trim()}” 这让 W·HERE 找到一段经过本人确认的记忆：${sourceText}`
      : `${prefix} ${sourceText}`

    return {
      content,
      confidence: input.mode === 'persona_inference' ? 0.75 : 1,
      containsNewFacts: false,
      makesMajorDecision: false,
      expressesUnreviewedIntent: false,
      model: 'deterministic-mock-v1',
      ...this.override,
    }
  }
}
