from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient


TOKEN_HEADER = {"X-Device-Token": "test-device-token"}
QUOTE = "一次没做好，不等于你不行。今晚先睡，明天再说。"


def post_hrv(client: TestClient, value: float, measured_at: datetime | None = None) -> dict:
    response = client.post(
        "/api/v1/hrv/readings",
        headers=TOKEN_HEADER,
        json={
            "reading_id": f"reading-{uuid4().hex}",
            "device_id": "alloop-demo-001",
            "measured_at": (measured_at or datetime.now(timezone.utc)).isoformat(),
            "value": value,
            "quality": 0.95,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def create_interaction(client: TestClient, text: str, request_id: str | None = None) -> dict:
    request_id = request_id or f"request-{uuid4().hex}"
    response = client.post(
        "/api/v1/interactions",
        headers={"Idempotency-Key": request_id},
        json={
            "client_request_id": request_id,
            "relationship_id": "rel_linlan_linya_001",
            "recipient_id": "person_linya",
            "device_id": "alloop-demo-001",
            "input": {"type": "text", "text": text},
            "preferences": {"content_intensity": "L1"},
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_health_exposes_safe_mode_not_secret(client: TestClient) -> None:
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["model_mode"] == "fake"
    assert "api_key" not in str(body).lower()


def test_hrv_requires_device_token_and_classifies_relative_value(client: TestClient) -> None:
    unauthorized = client.post(
        "/api/v1/hrv/readings",
        json={
            "reading_id": "unauthorized",
            "device_id": "alloop-demo-001",
            "measured_at": datetime.now(timezone.utc).isoformat(),
            "value": 50,
        },
    )
    assert unauthorized.status_code == 401
    assert post_hrv(client, 40)["state"] == "low"
    assert post_hrv(client, 50)["state"] == "normal"
    assert post_hrv(client, 60)["state"] == "high"


def test_latest_hrv_reports_if_reading_will_affect_reply(client: TestClient) -> None:
    empty = client.get("/api/v1/hrv/latest", params={"device_id": "alloop-demo-001"})
    assert empty.status_code == 200
    assert empty.json()["has_reading"] is False
    assert empty.json()["fresh"] is False

    post_hrv(client, 40)
    latest = client.get("/api/v1/hrv/latest", params={"device_id": "alloop-demo-001"})
    assert latest.status_code == 200
    assert latest.json()["has_reading"] is True
    assert latest.json()["fresh"] is True
    assert latest.json()["valid"] is True
    assert latest.json()["state"] == "low"
    assert latest.json()["value"] == 40


def test_latest_hrv_keeps_stale_value_visible_but_marks_it_unused(client: TestClient) -> None:
    post_hrv(client, 60, datetime.now(timezone.utc) - timedelta(minutes=10))
    latest = client.get("/api/v1/hrv/latest", params={"device_id": "alloop-demo-001"})
    assert latest.status_code == 200
    assert latest.json()["has_reading"] is True
    assert latest.json()["fresh"] is False
    assert latest.json()["state"] == "unknown"
    assert latest.json()["value"] == 60


def test_same_input_low_hrv_is_gentle_and_grounded(client: TestClient) -> None:
    post_hrv(client, 40)
    body = create_interaction(client, "我最近准备换工作，但很害怕。")
    assert body["decision"] == "grounded_match"
    assert body["presentation"]["mode"] == "gentle"
    assert body["presentation"]["reduce_motion"] is True
    assert body["presentation"]["allow_deeper_prompt"] is False
    assert body["reply"]["quote"] == QUOTE
    assert body["evidence"]["memory_id"] == "memory_linlan_20130608_001"
    assert body["safety"]["impersonates_creator"] is False
    assert body["safety"]["hrv_interpreted_as_emotion"] is False


def test_same_input_high_hrv_allows_open_pacing_without_emotion_claim(client: TestClient) -> None:
    post_hrv(client, 60)
    body = create_interaction(client, "我最近准备换工作，但很害怕。")
    assert body["presentation"]["mode"] == "standard_open"
    assert body["presentation"]["allow_deeper_prompt"] is True
    visible = str(body["reply"])
    assert "HRV" not in visible
    assert "你很开心" not in visible
    assert body["reply"]["quote"] == QUOTE


def test_support_question_is_only_partial_match(client: TestClient) -> None:
    post_hrv(client, 50)
    body = create_interaction(client, "妈妈会支持我换工作吗？")
    assert body["decision"] == "partial_match"
    assert "不能代替林岚表态" in body["reply"]["lead"]
    assert body["reply"]["quote"] == QUOTE


def test_irrelevant_input_returns_no_match_without_quote(client: TestClient) -> None:
    post_hrv(client, 50)
    body = create_interaction(client, "今天楼下的桂花开了。")
    assert body["decision"] == "no_match"
    assert body["reply"]["quote"] is None
    assert body["evidence"] is None


def test_idempotent_retry_returns_same_interaction(client: TestClient) -> None:
    post_hrv(client, 50)
    request_id = "stable-client-request"
    first = create_interaction(client, "我最近准备换工作，但很害怕。", request_id)
    second = create_interaction(client, "这一段不会覆盖第一次请求。", request_id)
    assert second == first


def test_too_heavy_feedback_forces_future_gentle_mode(client: TestClient) -> None:
    post_hrv(client, 60)
    first = create_interaction(client, "我最近准备换工作，但很害怕。")
    feedback = client.post(
        f"/api/v1/interactions/{first['interaction_id']}/feedback",
        json={"feedback_code": "too_heavy"},
    )
    assert feedback.status_code == 200
    assert feedback.json()["effect"] == "future_content_forced_to_gentle"
    second = create_interaction(client, "我担心下一次面试没做好。")
    assert second["presentation"]["mode"] == "gentle"


def test_outcome_combines_subjective_feedback_and_post_hrv(client: TestClient) -> None:
    now = datetime.now(timezone.utc)
    post_hrv(client, 50, now - timedelta(seconds=100))
    interaction = create_interaction(client, "我最近准备换工作，但很害怕。")
    interaction_id = interaction["interaction_id"]
    presented_at = now - timedelta(seconds=80)
    presented = client.post(
        f"/api/v1/interactions/{interaction_id}/presented",
        json={"presented_at": presented_at.isoformat()},
    )
    assert presented.status_code == 204
    post_hrv(client, 55, presented_at + timedelta(seconds=40))
    post_hrv(client, 56, presented_at + timedelta(seconds=60))
    feedback = client.post(
        f"/api/v1/interactions/{interaction_id}/feedback",
        json={"feedback_code": "very_relevant"},
    )
    assert feedback.status_code == 200
    outcome = client.get(f"/api/v1/interactions/{interaction_id}/outcome")
    assert outcome.status_code == 200, outcome.text
    body = outcome.json()
    assert body["measurement_status"] == "complete"
    assert body["subjective_feedback"] == "very_relevant"
    assert body["hrv_before"]["value"] == 50
    assert body["hrv_after"]["value"] == 55.5
    assert body["trend"] == "up"
