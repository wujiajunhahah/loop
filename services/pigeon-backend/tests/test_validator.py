from __future__ import annotations

from app.schemas import Decision, HarnessModelOutput
from app.services.memory_provider import FixedMemoryProvider
from app.services.output_validator import OutputValidator


def test_validator_rejects_invented_creator_quote() -> None:
    memory = FixedMemoryProvider().get_for_relationship("rel_linlan_linya_001")
    output = HarnessModelOutput(
        decision=Decision.GROUNDED_MATCH,
        relevance=0.9,
        relation_reason="都谈到新的尝试。",
        lead="妈妈现在想对你说一些话。",
        quote="孩子，我永远支持你。",
        source_memory_id=memory.memory_id,
        source_label=memory.source_label,
    )
    result = OutputValidator().validate(output, memory)
    assert result.passed is False
    assert any("quote" in error for error in result.errors)
    assert any("impersonation" in error for error in result.errors)
