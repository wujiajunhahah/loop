from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_interaction_service, get_session
from app.schemas import (
    FeedbackAccepted,
    FeedbackCreate,
    InteractionCreate,
    InteractionOutcome,
    InteractionResponse,
    PresentedCreate,
)
from app.services.interaction_service import InteractionNotFound, InteractionService


router = APIRouter(prefix="/api/v1/interactions", tags=["interactions"])


@router.post("", response_model=InteractionResponse)
async def create_interaction(
    payload: InteractionCreate,
    session: Session = Depends(get_session),
    service: InteractionService = Depends(get_interaction_service),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> InteractionResponse:
    if idempotency_key is not None and idempotency_key != payload.client_request_id:
        raise HTTPException(status_code=400, detail="Idempotency-Key must match client_request_id")
    return await service.create(session, payload)


@router.post("/{interaction_id}/presented", status_code=status.HTTP_204_NO_CONTENT)
def mark_presented(
    interaction_id: str,
    payload: PresentedCreate,
    session: Session = Depends(get_session),
    service: InteractionService = Depends(get_interaction_service),
) -> Response:
    try:
        service.mark_presented(session, interaction_id, payload.presented_at)
    except InteractionNotFound as exc:
        raise HTTPException(status_code=404, detail="interaction not found") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{interaction_id}/feedback", response_model=FeedbackAccepted)
def record_feedback(
    interaction_id: str,
    payload: FeedbackCreate,
    session: Session = Depends(get_session),
    service: InteractionService = Depends(get_interaction_service),
) -> FeedbackAccepted:
    try:
        return service.record_feedback(session, interaction_id, payload)
    except InteractionNotFound as exc:
        raise HTTPException(status_code=404, detail="interaction not found") from exc


@router.get("/{interaction_id}/outcome", response_model=InteractionOutcome)
def get_outcome(
    interaction_id: str,
    session: Session = Depends(get_session),
    service: InteractionService = Depends(get_interaction_service),
) -> InteractionOutcome:
    try:
        return service.outcome(session, interaction_id)
    except InteractionNotFound as exc:
        raise HTTPException(status_code=404, detail="interaction not found") from exc
