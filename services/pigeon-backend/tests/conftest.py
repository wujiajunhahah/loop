from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    settings = Settings(
        _env_file=None,
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        model_mode="fake",
        openai_api_key="",
        alloop_device_tokens="alloop-demo-001:test-device-token",
        hrv_baseline_mode="fixed",
        hrv_fixed_baseline=50,
        hrv_reading_ttl_seconds=300,
        voice_diary_storage_dir=str(tmp_path / "voice-diary"),
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client
