from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class HrvReadingRecord(Base):
    __tablename__ = "hrv_readings"

    reading_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    device_id: Mapped[str] = mapped_column(String(128), index=True)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    value: Mapped[float] = mapped_column(Float)
    quality: Mapped[float | None] = mapped_column(Float, nullable=True)
    valid: Mapped[bool] = mapped_column(Boolean, default=True)
    validity_reason: Mapped[str] = mapped_column(String(128), default="valid")


class VoiceDiaryChunkRecord(Base):
    __tablename__ = "voice_diary_chunks"

    chunk_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(128), index=True)
    audio_format: Mapped[str] = mapped_column(String(32))
    source: Mapped[str] = mapped_column(String(128), default="unknown")
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    byte_length: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    file_path: Mapped[str] = mapped_column(Text)


class InteractionRecord(Base):
    __tablename__ = "interactions"
    __table_args__ = (UniqueConstraint("client_request_id", name="uq_interaction_client_request"),)

    interaction_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    client_request_id: Mapped[str] = mapped_column(String(128), nullable=False)
    relationship_id: Mapped[str] = mapped_column(String(128), index=True)
    recipient_id: Mapped[str] = mapped_column(String(128))
    device_id: Mapped[str] = mapped_column(String(128), index=True)
    input_text: Mapped[str] = mapped_column(Text)
    content_intensity: Mapped[str] = mapped_column(String(8), default="L1")
    hrv_before_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    hrv_before_state: Mapped[str] = mapped_column(String(32), default="unknown")
    hrv_before_measured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    safety_mode: Mapped[str] = mapped_column(String(32))
    decision: Mapped[str] = mapped_column(String(32))
    response_json: Mapped[str] = mapped_column(Text)
    model_name: Mapped[str] = mapped_column(String(128))
    model_mode: Mapped[str] = mapped_column(String(32))
    harness_version: Mapped[str] = mapped_column(String(64))
    validation_passed: Mapped[bool] = mapped_column(Boolean, default=True)
    validation_errors_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    presented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FeedbackRecord(Base):
    __tablename__ = "feedback"
    __table_args__ = (UniqueConstraint("interaction_id", name="uq_feedback_interaction"),)

    feedback_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    interaction_id: Mapped[str] = mapped_column(ForeignKey("interactions.interaction_id"), index=True)
    feedback_code: Mapped[str] = mapped_column(String(64))
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class RecipientPreferenceRecord(Base):
    __tablename__ = "recipient_preferences"

    relationship_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    force_gentle: Mapped[bool] = mapped_column(Boolean, default=False)
    suppress_memory: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_only: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
