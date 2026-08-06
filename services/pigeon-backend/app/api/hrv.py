from __future__ import annotations

import hmac
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_session
from app.models import HrvReadingRecord
from app.schemas import HrvLatestResponse, HrvReadingAccepted, HrvReadingCreate, HrvState
from app.services.hrv_policy import HrvPolicy, as_utc


router = APIRouter(prefix="/api/v1/hrv", tags=["hrv"])
logger = logging.getLogger("uvicorn.error")


@router.post("/readings", response_model=HrvReadingAccepted)
def create_reading(
    payload: HrvReadingCreate,
    request: Request,
    session: Session = Depends(get_session),
    device_token: str | None = Header(default=None, alias="X-Device-Token"),
) -> HrvReadingAccepted:
    settings = request.app.state.settings
    configured_token = settings.device_tokens.get(payload.device_id)
    if not configured_token or not device_token or not hmac.compare_digest(device_token, configured_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid device token")

    policy: HrvPolicy = request.app.state.hrv_policy
    measured_at = as_utc(payload.measured_at)
    baseline = policy.baseline(session, payload.device_id)
    state_value = policy.classify_value(payload.value, baseline)
    valid_until = measured_at + timedelta(seconds=settings.hrv_reading_ttl_seconds)
    existing = session.get(HrvReadingRecord, payload.reading_id)
    if existing:
        return HrvReadingAccepted(
            accepted=True,
            duplicate=True,
            reading_id=payload.reading_id,
            state=policy.classify_value(existing.value, baseline) if existing.valid else HrvState.UNKNOWN,
            valid_until=valid_until if existing.valid else None,
        )

    valid = policy.is_quality_valid(payload.quality)
    record = HrvReadingRecord(
        reading_id=payload.reading_id,
        device_id=payload.device_id,
        measured_at=measured_at,
        value=payload.value,
        quality=payload.quality,
        valid=valid,
        validity_reason="valid" if valid else "quality_below_threshold",
    )
    session.add(record)
    session.commit()
    logger.info(
        "HRV_RECEIVED device_id=%s reading_id=%s value=%.2f measured_at=%s state=%s valid=%s",
        payload.device_id,
        payload.reading_id,
        payload.value,
        measured_at.isoformat(),
        state_value.value if valid else HrvState.UNKNOWN.value,
        valid,
    )
    return HrvReadingAccepted(
        accepted=True,
        reading_id=payload.reading_id,
        state=state_value if valid else HrvState.UNKNOWN,
        valid_until=valid_until if valid else None,
    )


@router.get("/latest", response_model=HrvLatestResponse)
def get_latest_reading(
    request: Request,
    device_id: str,
    session: Session = Depends(get_session),
) -> HrvLatestResponse:
    """Expose whether the latest ring reading is recent enough to affect a reply."""
    policy: HrvPolicy = request.app.state.hrv_policy
    settings = request.app.state.settings
    baseline = policy.baseline(session, device_id)
    record = session.scalar(
        select(HrvReadingRecord)
        .where(HrvReadingRecord.device_id == device_id)
        .order_by(HrvReadingRecord.measured_at.desc())
        .limit(1)
    )
    if record is None:
        return HrvLatestResponse(
            device_id=device_id,
            has_reading=False,
            fresh=False,
            valid=False,
            state=HrvState.UNKNOWN,
            value=None,
            baseline=baseline,
            measured_at=None,
            received_at=None,
            valid_until=None,
            validity_reason=None,
        )

    measured_at = as_utc(record.measured_at)
    received_at = as_utc(record.received_at)
    valid_until = measured_at + timedelta(seconds=settings.hrv_reading_ttl_seconds)
    now = datetime.now(timezone.utc)
    fresh = record.valid and measured_at <= now + timedelta(minutes=5) and valid_until >= now
    return HrvLatestResponse(
        device_id=device_id,
        has_reading=True,
        fresh=fresh,
        valid=record.valid,
        state=policy.classify_value(record.value, baseline) if fresh else HrvState.UNKNOWN,
        value=record.value,
        baseline=baseline,
        measured_at=measured_at,
        received_at=received_at,
        valid_until=valid_until,
        validity_reason=record.validity_reason,
    )
