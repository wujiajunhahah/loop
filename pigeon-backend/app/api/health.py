from __future__ import annotations

from fastapi import APIRouter, Request

from app.schemas import HealthResponse


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    settings = request.app.state.settings
    return HealthResponse(
        service=settings.app_name,
        model_mode=settings.effective_model_mode,
        model=settings.openai_model if settings.effective_model_mode == "openai" else "deterministic-demo",
        harness_version=settings.harness_version,
    )
