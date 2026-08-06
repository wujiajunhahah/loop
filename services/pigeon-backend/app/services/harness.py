from __future__ import annotations

from app.schemas import Decision, HarnessModelOutput, SafetyMode
from app.services.memory_provider import FixedMemory
from app.services.model_gateway import ModelGateway
from app.services.output_validator import OutputValidator, ValidationResult


class TravelMessengerHarness:
    def __init__(self, gateway: ModelGateway, validator: OutputValidator):
        self.gateway = gateway
        self.validator = validator

    async def run(
        self,
        *,
        recipient_text: str,
        memory: FixedMemory,
        safety_mode: SafetyMode,
        content_intensity: str,
        safety_identifier: str,
    ) -> tuple[HarnessModelOutput, ValidationResult]:
        output = await self.gateway.generate(
            recipient_text=recipient_text,
            memory=memory,
            safety_mode=safety_mode,
            content_intensity=content_intensity,
            safety_identifier=safety_identifier,
        )
        validation = self.validator.validate(output, memory)
        if validation.passed:
            return output, validation

        fallback = HarnessModelOutput(
            decision=Decision.NO_MATCH,
            relevance=0,
            lead="这次没有找到能够安全、准确呈现的原始内容，信使不作补写。",
            closing="可以先把这封信留在这里。",
            safety_flags=["validator_fallback"],
        )
        return fallback, validation
