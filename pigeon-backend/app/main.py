from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.hrv import router as hrv_router
from app.api.interactions import router as interactions_router
from app.api.conversation import router as conversation_router
from app.config import Settings, get_settings
from app.database import Database
from app.services.harness import TravelMessengerHarness
from app.services.hrv_policy import HrvPolicy
from app.services.interaction_service import InteractionService
from app.services.memory_provider import FixedMemoryProvider
from app.services.model_gateway import FakeModelGateway, OpenAIModelGateway
from app.services.output_validator import OutputValidator


def configure_file_logging(log_file: str) -> None:
    path = Path(log_file).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    for logger_name in ("uvicorn.error", "uvicorn.access"):
        target = logging.getLogger(logger_name)
        if any(getattr(handler, "name", None) == "pigeon-backend-file" for handler in target.handlers):
            continue
        handler = RotatingFileHandler(path, maxBytes=2_000_000, backupCount=3, encoding="utf-8")
        handler.name = "pigeon-backend-file"
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        target.addHandler(handler)


def create_app(settings: Settings | None = None) -> FastAPI:
    configured = settings or get_settings()
    configure_file_logging(configured.backend_log_file)
    database = Database(configured.database_url)
    database.create_all()
    memory_provider = FixedMemoryProvider()
    hrv_policy = HrvPolicy(configured)
    gateway = OpenAIModelGateway(configured) if configured.effective_model_mode == "openai" else FakeModelGateway()
    harness = TravelMessengerHarness(gateway, OutputValidator())
    interaction_service = InteractionService(
        settings=configured,
        memory_provider=memory_provider,
        hrv_policy=hrv_policy,
        harness=harness,
    )

    app = FastAPI(
        title=configured.app_name,
        version="0.1.0",
        description="女儿端信鸽回信、Alloop HRV 接收、呈现确认和反馈闭环。",
    )
    app.state.settings = configured
    app.state.database = database
    app.state.hrv_policy = hrv_policy
    app.state.interaction_service = interaction_service

    app.add_middleware(
        CORSMiddleware,
        allow_origins=configured.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_json_utf8_charset(request: Request, call_next):
        response = await call_next(request)
        content_type = response.headers.get("content-type", "")
        if content_type.startswith("application/json") and "charset=" not in content_type:
            response.headers["content-type"] = f"{content_type}; charset=utf-8"
        return response

    app.include_router(health_router)
    app.include_router(conversation_router)
    app.include_router(hrv_router)
    app.include_router(interactions_router)
    return app


app = create_app()
