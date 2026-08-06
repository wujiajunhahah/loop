from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Protocol

from openai import AsyncOpenAI

from app.config import Settings
from app.schemas import Decision, HarnessModelOutput, SafetyMode
from app.services.memory_provider import FixedMemory


class ModelGateway(Protocol):
    async def generate(
        self,
        *,
        recipient_text: str,
        memory: FixedMemory,
        safety_mode: SafetyMode,
        content_intensity: str,
        safety_identifier: str,
    ) -> HarnessModelOutput: ...


class FakeModelGateway:
    """Deterministic local substitute used before an API key is configured."""

    pause_terms = ("先不看", "不想看", "不要回忆", "停一下", "暂停", "别给我")
    boundary_terms = ("支持我", "同意我", "她会", "妈妈会", "想让我", "希望我", "替我决定")
    match_terms = (
        "换工作", "工作", "害怕", "怕", "没做好", "失败", "不行", "考试", "成绩",
        "面试", "尝试", "决定", "选择", "出发", "做不到", "犯错", "失误",
    )

    async def generate(
        self,
        *,
        recipient_text: str,
        memory: FixedMemory,
        safety_mode: SafetyMode,
        content_intensity: str,
        safety_identifier: str,
    ) -> HarnessModelOutput:
        del content_intensity, safety_identifier
        text = recipient_text.strip()
        if any(term in text for term in self.pause_terms):
            return HarnessModelOutput(
                decision=Decision.PAUSE,
                relevance=0,
                lead="这次先停在这里，不展开任何记忆。",
                closing="以后是否再看，由你决定。",
            )
        if any(term in text for term in self.boundary_terms):
            return HarnessModelOutput(
                decision=Decision.PARTIAL_MATCH,
                relevance=0.55,
                relation_reason="这条原文谈到一次没做好时如何先缓一缓，但没有回答她会怎样看待你现在的选择。",
                lead="信使找到一条有部分关联的旧短信；它不能代替林岚表态。",
                quote=memory.original_quote,
                context_note=f"这句话来自{memory.scene}，这里只保留已经核对的原文。",
                closing=self._closing(safety_mode),
                source_memory_id=memory.memory_id,
                source_label=memory.source_label,
            )
        if any(term in text for term in self.match_terms):
            lead = (
                "信使找到一条和“担心一次没有做好”有关的旧短信。"
                if safety_mode == SafetyMode.GENTLE
                else "你写到对下一步的担心。信使找到一条与“如何看待一次没做好”有关的旧短信。"
            )
            return HarnessModelOutput(
                decision=Decision.GROUNDED_MATCH,
                relevance=0.86,
                relation_reason="你此刻担心新的尝试没有做好，而这条原文也谈到如何看待一次没有做好。",
                lead=lead,
                quote=memory.original_quote,
                context_note=(
                    None
                    if safety_mode == SafetyMode.GENTLE
                    else f"它来自{memory.scene}；信使不替林岚解释更多，只呈现已经核对的原文。"
                ),
                closing=self._closing(safety_mode),
                source_memory_id=memory.memory_id,
                source_label=memory.source_label,
            )
        return HarnessModelOutput(
            decision=Decision.NO_MATCH,
            relevance=0.12,
            lead="现有的这条记忆与刚才写下的内容没有足够明确的关系，信使这次不勉强拼接。",
            closing="可以先把这封信留在这里。",
        )

    @staticmethod
    def _closing(safety_mode: SafetyMode) -> str:
        if safety_mode == SafetyMode.GENTLE:
            return "如果现在不想看，可以先把它放在这里。"
        if safety_mode == SafetyMode.STANDARD_OPEN:
            return "如果愿意，以后可以再查看这条短信的原始记录。"
        return "这条原文先送到这里，是否继续由你决定。"


class OpenAIModelGateway:
    def __init__(self, settings: Settings):
        client_kwargs: dict[str, object] = {
            "api_key": settings.openai_api_key,
            "timeout": settings.model_timeout_seconds,
            "max_retries": settings.model_max_retries,
        }
        if settings.openai_base_url:
            client_kwargs["base_url"] = settings.openai_base_url
        self.client = AsyncOpenAI(**client_kwargs)
        self.model = settings.openai_model
        self.reasoning_effort = settings.openai_reasoning_effort
        self.prompt = (
            Path(__file__).resolve().parents[1] / "prompts" / "travel_messenger_v1.txt"
        ).read_text(encoding="utf-8")

    async def generate(
        self,
        *,
        recipient_text: str,
        memory: FixedMemory,
        safety_mode: SafetyMode,
        content_intensity: str,
        safety_identifier: str,
    ) -> HarnessModelOutput:
        payload = {
            "recipient_input": recipient_text,
            "safety_mode": safety_mode.value,
            "content_intensity": content_intensity,
            "authorized_memory": {
                "memory_id": memory.memory_id,
                "title": memory.title,
                "original_quote": memory.original_quote,
                "source_label": memory.source_label,
                "date": memory.date,
                "scene": memory.scene,
                "creator_name": memory.creator_name,
                "recipient_name": memory.recipient_name,
                "creator_confirmed": memory.creator_confirmed,
            },
        }
        hashed_identifier = hashlib.sha256(safety_identifier.encode("utf-8")).hexdigest()
        response = await self.client.responses.parse(
            model=self.model,
            reasoning={"effort": self.reasoning_effort},
            input=[
                {"role": "developer", "content": self.prompt},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
            text_format=HarnessModelOutput,
            safety_identifier=hashed_identifier,
            store=False,
        )
        if response.output_parsed is None:
            raise RuntimeError("model returned no parsed output")
        return response.output_parsed
