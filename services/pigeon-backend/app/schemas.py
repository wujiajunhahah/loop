from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HrvState(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    UNKNOWN = "unknown"


class SafetyMode(str, Enum):
    GENTLE = "gentle"
    STANDARD = "standard"
    STANDARD_OPEN = "standard_open"


class Decision(str, Enum):
    GROUNDED_MATCH = "grounded_match"
    PARTIAL_MATCH = "partial_match"
    NO_MATCH = "no_match"
    PAUSE = "pause"


class FeedbackCode(str, Enum):
    VERY_RELEVANT = "very_relevant"
    NOT_RELEVANT = "not_relevant"
    TOO_HEAVY = "too_heavy"
    SUPPRESS_MEMORY = "suppress_memory"
    MISREPRESENTS_CREATOR = "misrepresents_creator"


class HrvReadingCreate(StrictModel):
    reading_id: str = Field(min_length=1, max_length=128)
    device_id: str = Field(min_length=1, max_length=128)
    measured_at: datetime
    value: float
    quality: float | None = Field(default=None, ge=0, le=1)

    @field_validator("value")
    @classmethod
    def finite_value(cls, value: float) -> float:
        if value != value or value in (float("inf"), float("-inf")):
            raise ValueError("HRV value must be finite")
        return value


class HrvReadingAccepted(StrictModel):
    accepted: bool
    duplicate: bool = False
    reading_id: str
    state: HrvState
    valid_until: datetime | None


class HrvLatestResponse(StrictModel):
    device_id: str
    has_reading: bool
    fresh: bool
    valid: bool
    state: HrvState
    value: float | None
    baseline: float
    measured_at: datetime | None
    received_at: datetime | None
    valid_until: datetime | None
    validity_reason: str | None


class VoiceDiaryAccepted(StrictModel):
    accepted: Literal[True] = True
    status: Literal["stored"] = "stored"
    session_id: str
    chunk_id: str
    bytes_received: int
    audio_format: str
    received_at: datetime


class VoiceDiaryRecentItem(StrictModel):
    session_id: str
    chunk_id: str
    bytes_received: int
    audio_format: str
    source: str
    captured_at: datetime | None
    received_at: datetime


class VoiceDiaryRecentResponse(StrictModel):
    items: list[VoiceDiaryRecentItem]


class RecipientInput(StrictModel):
    type: Literal["text"] = "text"
    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def non_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("text cannot be blank")
        return cleaned


class InteractionPreferences(StrictModel):
    content_intensity: Literal["L1", "L2"] = "L1"


class InteractionCreate(StrictModel):
    client_request_id: str = Field(min_length=1, max_length=128)
    relationship_id: Literal["rel_linlan_linya_001"] = "rel_linlan_linya_001"
    recipient_id: Literal["person_linya"] = "person_linya"
    device_id: str = Field(min_length=1, max_length=128)
    input: RecipientInput
    preferences: InteractionPreferences = Field(default_factory=InteractionPreferences)


class HarnessModelOutput(StrictModel):
    decision: Decision
    relevance: float = Field(ge=0, le=1)
    relation_reason: str | None = None
    lead: str
    quote: str | None = None
    context_note: str | None = None
    closing: str | None = None
    source_memory_id: str | None = None
    source_label: str | None = None
    safety_flags: list[str] = Field(default_factory=list)


class ReplyBlock(StrictModel):
    lead: str
    quote: str | None = None
    context_note: str | None = None
    closing: str | None = None


class EvidenceBlock(StrictModel):
    memory_id: str
    title: str
    source_label: str
    creator_confirmed: bool
    relation_reason: str


class PresentationBlock(StrictModel):
    mode: SafetyMode
    reduce_motion: bool
    autoplay_audio: Literal[False] = False
    allow_deeper_prompt: bool


class SafetyBlock(StrictModel):
    grounded: bool
    impersonates_creator: Literal[False] = False
    hrv_interpreted_as_emotion: Literal[False] = False


class InteractionResponse(StrictModel):
    api_version: Literal["v1"] = "v1"
    interaction_id: str
    status: Literal["completed"] = "completed"
    decision: Decision
    reply: ReplyBlock
    evidence: EvidenceBlock | None = None
    presentation: PresentationBlock
    safety: SafetyBlock
    feedback_options: list[FeedbackCode]


class PresentedCreate(StrictModel):
    presented_at: datetime


class FeedbackCreate(StrictModel):
    feedback_code: FeedbackCode
    comment: str | None = Field(default=None, max_length=1000)


class FeedbackAccepted(StrictModel):
    recorded: bool
    interaction_id: str
    feedback_code: FeedbackCode
    effect: str


class HrvOutcomePoint(StrictModel):
    value: float
    measured_at: datetime
    state: HrvState | None = None


class InteractionOutcome(StrictModel):
    interaction_id: str
    subjective_feedback: FeedbackCode | None
    hrv_before: HrvOutcomePoint | None
    hrv_after: HrvOutcomePoint | None
    relative_change: float | None
    trend: Literal["up", "stable", "down", "unknown"]
    measurement_status: Literal["not_presented", "collecting_hrv", "complete", "insufficient_data"]


class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"
    service: str
    model_mode: Literal["fake", "openai"]
    model: str
    harness_version: str
