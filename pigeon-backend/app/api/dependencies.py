from __future__ import annotations

from collections.abc import Generator

from fastapi import Request
from sqlalchemy.orm import Session

from app.services.interaction_service import InteractionService


def get_session(request: Request) -> Generator[Session, None, None]:
    with request.app.state.database.session_factory() as session:
        yield session


def get_interaction_service(request: Request) -> InteractionService:
    return request.app.state.interaction_service
