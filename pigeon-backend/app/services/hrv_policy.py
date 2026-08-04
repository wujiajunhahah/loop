from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import median

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import HrvReadingRecord
from app.schemas import HrvState


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@dataclass(frozen=True)
class HrvSnapshot:
    state: HrvState
    value: float | None
    baseline: float
    measured_at: datetime | None
    valid_until: datetime | None


class HrvPolicy:
    def __init__(self, settings: Settings):
        self.settings = settings

    def baseline(self, session: Session, device_id: str) -> float:
        if self.settings.hrv_baseline_mode == "fixed":
            return self.settings.hrv_fixed_baseline

        query: Select[tuple[HrvReadingRecord]] = (
            select(HrvReadingRecord)
            .where(HrvReadingRecord.device_id == device_id, HrvReadingRecord.valid.is_(True))
            .order_by(HrvReadingRecord.measured_at.desc())
            .limit(self.settings.hrv_rolling_window)
        )
        values = [row.value for row in session.scalars(query).all()]
        return median(values) if len(values) >= 5 else self.settings.hrv_fixed_baseline

    def classify_value(self, value: float, baseline: float) -> HrvState:
        if value < baseline * self.settings.hrv_low_ratio:
            return HrvState.LOW
        if value > baseline * self.settings.hrv_high_ratio:
            return HrvState.HIGH
        return HrvState.NORMAL

    def is_quality_valid(self, quality: float | None) -> bool:
        return quality is None or quality >= self.settings.hrv_quality_min

    def latest(self, session: Session, device_id: str, now: datetime | None = None) -> HrvSnapshot:
        current = as_utc(now or datetime.now(timezone.utc))
        baseline = self.baseline(session, device_id)
        query = (
            select(HrvReadingRecord)
            .where(HrvReadingRecord.device_id == device_id, HrvReadingRecord.valid.is_(True))
            .order_by(HrvReadingRecord.measured_at.desc())
            .limit(1)
        )
        record = session.scalar(query)
        if record is None:
            return HrvSnapshot(HrvState.UNKNOWN, None, baseline, None, None)

        measured_at = as_utc(record.measured_at)
        valid_until = measured_at + timedelta(seconds=self.settings.hrv_reading_ttl_seconds)
        if measured_at > current + timedelta(minutes=5) or valid_until < current:
            return HrvSnapshot(HrvState.UNKNOWN, None, baseline, measured_at, valid_until)
        return HrvSnapshot(
            state=self.classify_value(record.value, baseline),
            value=record.value,
            baseline=baseline,
            measured_at=measured_at,
            valid_until=valid_until,
        )
