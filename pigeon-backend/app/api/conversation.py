from __future__ import annotations

import hashlib
import hmac
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_session
from app.models import VoiceDiaryChunkRecord
from app.schemas import VoiceDiaryAccepted, VoiceDiaryRecentItem, VoiceDiaryRecentResponse


router = APIRouter(prefix="/api/conversation", tags=["conversation"])
logger = logging.getLogger("uvicorn.error")
SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
AUDIO_FORMAT_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,32}$")


def parse_optional_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="X-Timestamp must be an ISO 8601 timestamp") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


@router.post(
    "/voice-diary",
    response_model=VoiceDiaryAccepted,
    summary="接收 Alloop/Omi 的二进制语音日记片段",
    description=(
        "接收设备每约 5 秒发送的音频块。请求体为 application/octet-stream；"
        "X-Session-Id 用于归并同一次录音，当前 MVP 只负责可靠接收和保存，不自动进行医学或情绪判断。"
    ),
)
async def receive_voice_diary(
    request: Request,
    audio_data: Annotated[
        bytes,
        Body(
            media_type="application/octet-stream",
            min_length=1,
            description="原始音频字节；omi_simple 当前发送 Opus 数据。",
        ),
    ],
    session: Session = Depends(get_session),
    session_id: str = Header(alias="X-Session-Id", min_length=1, max_length=128),
    audio_format: str = Header(default="opus", alias="X-Audio-Format", min_length=1, max_length=32),
    captured_at_header: str | None = Header(default=None, alias="X-Timestamp"),
    source: str = Header(default="unknown", alias="X-Source", max_length=128),
    device_token: str | None = Header(default=None, alias="X-Device-Token"),
) -> VoiceDiaryAccepted:
    settings = request.app.state.settings
    expected_token = settings.voice_diary_device_token
    if expected_token and (not device_token or not hmac.compare_digest(device_token, expected_token)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid device token")
    if not SESSION_ID_PATTERN.fullmatch(session_id):
        raise HTTPException(status_code=422, detail="X-Session-Id contains unsupported characters")
    if not AUDIO_FORMAT_PATTERN.fullmatch(audio_format):
        raise HTTPException(status_code=422, detail="X-Audio-Format contains unsupported characters")
    if len(audio_data) > settings.voice_diary_max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="audio chunk is too large")

    captured_at = parse_optional_timestamp(captured_at_header)
    received_at = datetime.now(timezone.utc)
    chunk_id = f"vd_{uuid4().hex}"
    storage_root = Path(settings.voice_diary_storage_dir).resolve()
    session_directory = (storage_root / session_id).resolve()
    if storage_root != session_directory and storage_root not in session_directory.parents:
        raise HTTPException(status_code=422, detail="invalid session storage path")
    session_directory.mkdir(parents=True, exist_ok=True)
    file_path = session_directory / f"{chunk_id}.{audio_format.lower()}"
    file_path.write_bytes(audio_data)

    record = VoiceDiaryChunkRecord(
        chunk_id=chunk_id,
        session_id=session_id,
        audio_format=audio_format.lower(),
        source=source or "unknown",
        captured_at=captured_at,
        received_at=received_at,
        byte_length=len(audio_data),
        sha256=hashlib.sha256(audio_data).hexdigest(),
        file_path=str(file_path),
    )
    session.add(record)
    session.commit()
    logger.info(
        "VOICE_DIARY_RECEIVED method=POST path=/api/conversation/voice-diary session_id=%s chunk_id=%s bytes=%s format=%s source=%s",
        session_id,
        chunk_id,
        len(audio_data),
        audio_format.lower(),
        source or "unknown",
    )
    return VoiceDiaryAccepted(
        session_id=session_id,
        chunk_id=chunk_id,
        bytes_received=len(audio_data),
        audio_format=audio_format.lower(),
        received_at=received_at,
    )


@router.get(
    "/voice-diary/recent",
    response_model=VoiceDiaryRecentResponse,
    summary="查看最近收到的语音日记片段",
)
def recent_voice_diary_chunks(
    limit: int = Query(default=10, ge=1, le=50),
    session: Session = Depends(get_session),
) -> VoiceDiaryRecentResponse:
    records = session.scalars(
        select(VoiceDiaryChunkRecord)
        .order_by(VoiceDiaryChunkRecord.received_at.desc())
        .limit(limit)
    ).all()
    return VoiceDiaryRecentResponse(
        items=[
            VoiceDiaryRecentItem(
                session_id=record.session_id,
                chunk_id=record.chunk_id,
                bytes_received=record.byte_length,
                audio_format=record.audio_format,
                source=record.source,
                captured_at=record.captured_at,
                received_at=record.received_at,
            )
            for record in records
        ]
    )
