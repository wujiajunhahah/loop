from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from statistics import median
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import FeedbackRecord, HrvReadingRecord, InteractionRecord, RecipientPreferenceRecord
from app.schemas import (
    Decision,
    EvidenceBlock,
    FeedbackAccepted,
    FeedbackCode,
    FeedbackCreate,
    HarnessModelOutput,
    HrvOutcomePoint,
    HrvState,
    InteractionCreate,
    InteractionOutcome,
    InteractionResponse,
    PresentationBlock,
    ReplyBlock,
    SafetyBlock,
    SafetyMode,
)
from app.services.harness import TravelMessengerHarness
from app.services.hrv_policy import HrvPolicy, as_utc
from app.services.memory_provider import FixedMemory, FixedMemoryProvider


FEEDBACK_OPTIONS = list(FeedbackCode)


class InteractionNotFound(LookupError):
    pass


class InteractionService:
    def __init__(
        self,
        *,
        settings: Settings,
        memory_provider: FixedMemoryProvider,
        hrv_policy: HrvPolicy,
        harness: TravelMessengerHarness,
    ):
        self.settings = settings
        self.memory_provider = memory_provider
        self.hrv_policy = hrv_policy
        self.harness = harness

    async def create(self, session: Session, request: InteractionCreate) -> InteractionResponse:
        existing = session.scalar(
            select(InteractionRecord).where(InteractionRecord.client_request_id == request.client_request_id)
        )
        if existing:
            return InteractionResponse.model_validate_json(existing.response_json)

        memory = self.memory_provider.get_for_relationship(request.relationship_id)
        preferences = self._preferences(session, request.relationship_id)
        hrv = self.hrv_policy.latest(session, request.device_id)
        safety_mode = self._safety_mode(hrv.state, preferences.force_gentle)

        validation_passed = True
        validation_errors: list[str] = []
        if preferences.suppress_memory:
            output = HarnessModelOutput(
                decision=Decision.NO_MATCH,
                relevance=0,
                lead="这条记忆已按你的选择隐藏，信使这次不再呈现。",
                closing="以后是否重新打开，由你决定。",
                safety_flags=["memory_suppressed"],
            )
        else:
            try:
                output, validation = await self.harness.run(
                    recipient_text=request.input.text,
                    memory=memory,
                    safety_mode=safety_mode,
                    content_intensity=request.preferences.content_intensity,
                    safety_identifier=request.recipient_id,
                )
                validation_passed = validation.passed
                validation_errors = validation.errors
            except Exception as exc:
                output = HarnessModelOutput(
                    decision=Decision.NO_MATCH,
                    relevance=0,
                    lead="信使暂时无法安全完成这次匹配，因此没有补写任何内容。",
                    closing="可以稍后再试。",
                    safety_flags=["model_unavailable"],
                )
                validation_passed = False
                validation_errors = [f"model unavailable: {type(exc).__name__}"]

        if preferences.raw_only and output.decision in (Decision.GROUNDED_MATCH, Decision.PARTIAL_MATCH):
            output = self._raw_only(output, memory, safety_mode)

        response = self._to_response(output, memory, safety_mode)
        model_name = self.settings.openai_model if self.settings.effective_model_mode == "openai" else "deterministic-demo"
        record = InteractionRecord(
            interaction_id=response.interaction_id,
            client_request_id=request.client_request_id,
            relationship_id=request.relationship_id,
            recipient_id=request.recipient_id,
            device_id=request.device_id,
            input_text=request.input.text,
            content_intensity=request.preferences.content_intensity,
            hrv_before_value=hrv.value,
            hrv_before_state=hrv.state.value,
            hrv_before_measured_at=hrv.measured_at,
            safety_mode=safety_mode.value,
            decision=output.decision.value,
            response_json=response.model_dump_json(),
            model_name=model_name,
            model_mode=self.settings.effective_model_mode,
            harness_version=self.settings.harness_version,
            validation_passed=validation_passed,
            validation_errors_json=json.dumps(validation_errors, ensure_ascii=False),
        )
        session.add(record)
        session.commit()
        return response

    def mark_presented(self, session: Session, interaction_id: str, presented_at: datetime) -> None:
        record = session.get(InteractionRecord, interaction_id)
        if record is None:
            raise InteractionNotFound(interaction_id)
        record.presented_at = as_utc(presented_at)
        session.commit()

    def record_feedback(
        self, session: Session, interaction_id: str, request: FeedbackCreate
    ) -> FeedbackAccepted:
        interaction = session.get(InteractionRecord, interaction_id)
        if interaction is None:
            raise InteractionNotFound(interaction_id)

        feedback = session.scalar(
            select(FeedbackRecord).where(FeedbackRecord.interaction_id == interaction_id)
        )
        if feedback is None:
            feedback = FeedbackRecord(interaction_id=interaction_id, feedback_code=request.feedback_code.value)
            session.add(feedback)
        feedback.feedback_code = request.feedback_code.value
        feedback.comment = request.comment

        preferences = self._preferences(session, interaction.relationship_id)
        effect = "recorded_for_evaluation"
        if request.feedback_code == FeedbackCode.TOO_HEAVY:
            preferences.force_gentle = True
            effect = "future_content_forced_to_gentle"
        elif request.feedback_code == FeedbackCode.SUPPRESS_MEMORY:
            preferences.suppress_memory = True
            effect = "memory_suppressed_for_future_interactions"
        elif request.feedback_code == FeedbackCode.MISREPRESENTS_CREATOR:
            preferences.raw_only = True
            effect = "future_matches_limited_to_verified_raw_text"
        session.commit()
        return FeedbackAccepted(
            recorded=True,
            interaction_id=interaction_id,
            feedback_code=request.feedback_code,
            effect=effect,
        )

    def outcome(self, session: Session, interaction_id: str, now: datetime | None = None) -> InteractionOutcome:
        interaction = session.get(InteractionRecord, interaction_id)
        if interaction is None:
            raise InteractionNotFound(interaction_id)
        feedback = session.scalar(
            select(FeedbackRecord).where(FeedbackRecord.interaction_id == interaction_id)
        )
        feedback_code = FeedbackCode(feedback.feedback_code) if feedback else None

        before = None
        if interaction.hrv_before_value is not None and interaction.hrv_before_measured_at is not None:
            before = HrvOutcomePoint(
                value=interaction.hrv_before_value,
                measured_at=as_utc(interaction.hrv_before_measured_at),
                state=HrvState(interaction.hrv_before_state),
            )
        if interaction.presented_at is None:
            return InteractionOutcome(
                interaction_id=interaction_id,
                subjective_feedback=feedback_code,
                hrv_before=before,
                hrv_after=None,
                relative_change=None,
                trend="unknown",
                measurement_status="not_presented",
            )

        presented = as_utc(interaction.presented_at)
        window_start = presented + timedelta(seconds=30)
        window_end = presented + timedelta(seconds=120)
        current = as_utc(now or datetime.now(timezone.utc))
        readings = session.scalars(
            select(HrvReadingRecord)
            .where(
                HrvReadingRecord.device_id == interaction.device_id,
                HrvReadingRecord.valid.is_(True),
                HrvReadingRecord.measured_at >= window_start,
                HrvReadingRecord.measured_at <= window_end,
            )
            .order_by(HrvReadingRecord.measured_at.asc())
        ).all()
        if not readings:
            status = "collecting_hrv" if current < window_end else "insufficient_data"
            return InteractionOutcome(
                interaction_id=interaction_id,
                subjective_feedback=feedback_code,
                hrv_before=before,
                hrv_after=None,
                relative_change=None,
                trend="unknown",
                measurement_status=status,
            )

        after_value = median([row.value for row in readings])
        representative = readings[len(readings) // 2]
        baseline = self.hrv_policy.baseline(session, interaction.device_id)
        after = HrvOutcomePoint(
            value=after_value,
            measured_at=as_utc(representative.measured_at),
            state=self.hrv_policy.classify_value(after_value, baseline),
        )
        relative_change = None if before is None or before.value == 0 else (after_value - before.value) / before.value
        if relative_change is None:
            trend = "unknown"
        elif relative_change > 0.05:
            trend = "up"
        elif relative_change < -0.05:
            trend = "down"
        else:
            trend = "stable"
        return InteractionOutcome(
            interaction_id=interaction_id,
            subjective_feedback=feedback_code,
            hrv_before=before,
            hrv_after=after,
            relative_change=relative_change,
            trend=trend,
            measurement_status="complete",
        )

    @staticmethod
    def _preferences(session: Session, relationship_id: str) -> RecipientPreferenceRecord:
        preferences = session.get(RecipientPreferenceRecord, relationship_id)
        if preferences is None:
            preferences = RecipientPreferenceRecord(relationship_id=relationship_id)
            session.add(preferences)
            session.flush()
        return preferences

    @staticmethod
    def _safety_mode(hrv_state: HrvState, force_gentle: bool) -> SafetyMode:
        if force_gentle or hrv_state == HrvState.LOW:
            return SafetyMode.GENTLE
        if hrv_state == HrvState.HIGH:
            return SafetyMode.STANDARD_OPEN
        return SafetyMode.STANDARD

    @staticmethod
    def _raw_only(
        output: HarnessModelOutput, memory: FixedMemory, safety_mode: SafetyMode
    ) -> HarnessModelOutput:
        return HarnessModelOutput(
            decision=output.decision,
            relevance=output.relevance,
            relation_reason="这条原文与刚才写下的内容有有限关联；这里只展示已经核对的原文。",
            lead="按你的反馈，信使不再补充解释。",
            quote=memory.original_quote,
            closing="是否继续查看由你决定。" if safety_mode != SafetyMode.GENTLE else "可以先把它放在这里。",
            source_memory_id=memory.memory_id,
            source_label=memory.source_label,
            safety_flags=["raw_only_preference"],
        )

    @staticmethod
    def _to_response(
        output: HarnessModelOutput, memory: FixedMemory, safety_mode: SafetyMode
    ) -> InteractionResponse:
        matched = output.decision in (Decision.GROUNDED_MATCH, Decision.PARTIAL_MATCH)
        evidence = None
        if matched:
            evidence = EvidenceBlock(
                memory_id=memory.memory_id,
                title=memory.title,
                source_label=memory.source_label,
                creator_confirmed=memory.creator_confirmed,
                relation_reason=output.relation_reason or "与用户当前输入存在有限关联。",
            )
        return InteractionResponse(
            interaction_id=f"int_{uuid4().hex}",
            decision=output.decision,
            reply=ReplyBlock(
                lead=output.lead,
                quote=output.quote if matched else None,
                context_note=output.context_note if matched else None,
                closing=output.closing,
            ),
            evidence=evidence,
            presentation=PresentationBlock(
                mode=safety_mode,
                reduce_motion=safety_mode == SafetyMode.GENTLE,
                autoplay_audio=False,
                allow_deeper_prompt=safety_mode == SafetyMode.STANDARD_OPEN,
            ),
            safety=SafetyBlock(
                grounded=matched,
                impersonates_creator=False,
                hrv_interpreted_as_emotion=False,
            ),
            feedback_options=FEEDBACK_OPTIONS,
        )
