from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient


def test_voice_diary_endpoint_is_visible_in_openapi(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/conversation/voice-diary" in paths
    assert "post" in paths["/api/conversation/voice-diary"]


def test_receives_binary_voice_diary_chunk_and_lists_it(client: TestClient) -> None:
    audio = b"OggS-simulated-opus-packet"
    response = client.post(
        "/api/conversation/voice-diary",
        content=audio,
        headers={
            "Content-Type": "application/octet-stream",
            "X-Session-Id": "acceptance-session-001",
            "X-Audio-Format": "opus",
            "X-Timestamp": "2026-08-04T09:00:00Z",
            "X-Source": "omi_simple",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["accepted"] is True
    assert body["status"] == "stored"
    assert body["session_id"] == "acceptance-session-001"
    assert body["bytes_received"] == len(audio)
    assert body["audio_format"] == "opus"

    recent = client.get("/api/conversation/voice-diary/recent?limit=1")
    assert recent.status_code == 200
    item = recent.json()["items"][0]
    assert item["chunk_id"] == body["chunk_id"]
    assert item["source"] == "omi_simple"
    stored_files = list(Path(client.app.state.settings.voice_diary_storage_dir).rglob("*.opus"))
    assert len(stored_files) == 1
    assert stored_files[0].read_bytes() == audio


def test_voice_diary_requires_session_id_and_nonempty_body(client: TestClient) -> None:
    missing_session = client.post(
        "/api/conversation/voice-diary",
        content=b"audio",
        headers={"Content-Type": "application/octet-stream"},
    )
    assert missing_session.status_code == 422

    empty = client.post(
        "/api/conversation/voice-diary",
        content=b"",
        headers={
            "Content-Type": "application/octet-stream",
            "X-Session-Id": "empty-session",
        },
    )
    assert empty.status_code == 422
