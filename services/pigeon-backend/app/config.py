from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "我在·远行信使后端"
    app_env: str = "development"
    database_url: str = "sqlite:///./pigeon.db"
    backend_log_file: str = "./logs/backend.log"
    frontend_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    openai_api_key: str = ""
    openai_model: str = "gpt-5.6-terra"
    openai_base_url: str = ""
    openai_reasoning_effort: Literal["none", "low", "medium", "high", "xhigh", "max"] = "low"
    model_mode: Literal["auto", "fake", "openai"] = "auto"
    model_timeout_seconds: float = Field(default=20.0, gt=0, le=120)
    model_max_retries: int = Field(default=1, ge=0, le=3)
    harness_version: str = "travel-messenger-v1"

    alloop_device_tokens: str = "alloop-demo-001:change-this-device-token"
    hrv_baseline_mode: Literal["fixed", "rolling_median"] = "fixed"
    hrv_fixed_baseline: float = Field(default=50.0, gt=0)
    hrv_low_ratio: float = Field(default=0.85, gt=0, lt=1)
    hrv_high_ratio: float = Field(default=1.15, gt=1)
    hrv_reading_ttl_seconds: int = Field(default=120, ge=10, le=3600)
    hrv_quality_min: float = Field(default=0.5, ge=0, le=1)
    hrv_rolling_window: int = Field(default=20, ge=5, le=200)

    voice_diary_storage_dir: str = "./storage/voice-diary"
    voice_diary_max_bytes: int = Field(default=5_242_880, ge=1_024, le=52_428_800)
    voice_diary_device_token: str = ""

    @field_validator("openai_api_key", "openai_base_url", "voice_diary_device_token", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> str:
        return "" if value is None else str(value).strip()

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.frontend_origins.split(",") if item.strip()]

    @property
    def device_tokens(self) -> dict[str, str]:
        result: dict[str, str] = {}
        for pair in self.alloop_device_tokens.split(","):
            device_id, separator, token = pair.strip().partition(":")
            if separator and device_id and token:
                result[device_id] = token
        return result

    @property
    def effective_model_mode(self) -> Literal["fake", "openai"]:
        if self.model_mode == "fake":
            return "fake"
        if self.model_mode == "openai":
            return "openai"
        return "openai" if self.openai_api_key else "fake"


@lru_cache
def get_settings() -> Settings:
    return Settings()
