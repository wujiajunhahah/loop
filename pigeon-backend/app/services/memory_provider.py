from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FixedMemory:
    relationship_id: str
    creator_id: str
    creator_name: str
    recipient_id: str
    recipient_name: str
    memory_id: str
    title: str
    original_quote: str
    source_type: str
    source_label: str
    date: str
    scene: str
    creator_confirmed: bool
    recipient_authorized: bool
    allowed_flow: str
    excerpt_intensity: str
    full_story_intensity: str


class FixedMemoryProvider:
    def __init__(self, path: Path | None = None):
        memory_path = path or Path(__file__).resolve().parents[1] / "data" / "fixed_memory.json"
        payload = json.loads(memory_path.read_text(encoding="utf-8"))
        self._memory = FixedMemory(**payload)

    def get_for_relationship(self, relationship_id: str) -> FixedMemory:
        if relationship_id != self._memory.relationship_id:
            raise LookupError("relationship does not have an authorized memory")
        if not self._memory.creator_confirmed or not self._memory.recipient_authorized:
            raise PermissionError("memory is not confirmed and authorized")
        return self._memory
