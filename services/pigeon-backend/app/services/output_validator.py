from __future__ import annotations

from dataclasses import dataclass

from app.schemas import Decision, HarnessModelOutput
from app.services.memory_provider import FixedMemory


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    errors: list[str]


class OutputValidator:
    banned_impersonation_phrases = (
        "妈妈现在想对你说",
        "妈妈想对你说",
        "妈妈会支持你",
        "林岚想对你说",
        "她看见了你",
        "她正在看着你",
        "她一定希望",
        "她肯定希望",
        "我一直在你身边",
    )
    banned_hrv_or_emotion_claims = (
        "HRV", "hrv", "心率", "医学", "诊断", "你很开心", "你很悲伤", "你很焦虑",
        "你现在开心", "你现在悲伤", "你现在焦虑",
    )

    def validate(self, output: HarnessModelOutput, memory: FixedMemory) -> ValidationResult:
        errors: list[str] = []
        visible_text = "\n".join(
            part for part in (output.lead, output.relation_reason, output.context_note, output.closing) if part
        )
        for phrase in self.banned_impersonation_phrases:
            if phrase in visible_text:
                errors.append(f"impersonation phrase: {phrase}")
        for phrase in self.banned_hrv_or_emotion_claims:
            if phrase in visible_text:
                errors.append(f"HRV/emotion claim: {phrase}")

        displays_evidence = output.decision in (Decision.GROUNDED_MATCH, Decision.PARTIAL_MATCH)
        if displays_evidence:
            if output.quote != memory.original_quote:
                errors.append("quote is not an exact copy of authorized source")
            if output.source_memory_id != memory.memory_id:
                errors.append("source memory id does not match")
            if output.source_label != memory.source_label:
                errors.append("source label does not match")
            if not output.relation_reason:
                errors.append("matched output is missing relation reason")
        else:
            if output.quote or output.source_memory_id or output.source_label:
                errors.append("unmatched output must not expose evidence")

        if len(visible_text) > 500:
            errors.append("user-facing narration is too long")
        return ValidationResult(passed=not errors, errors=errors)
