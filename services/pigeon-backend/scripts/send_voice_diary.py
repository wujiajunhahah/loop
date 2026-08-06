from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from urllib.request import Request, urlopen


parser = argparse.ArgumentParser(description="Send one simulated Omi/Alloop binary voice diary chunk.")
parser.add_argument("--base-url", default="http://127.0.0.1:8010")
parser.add_argument("--session-id", default="acceptance-demo-session")
parser.add_argument("--audio-format", default="opus")
parser.add_argument("--bytes", type=int, default=4096)
args = parser.parse_args()

size = max(4, args.bytes)
audio = b"OggS" + os.urandom(size - 4)
request = Request(
    f"{args.base_url}/api/conversation/voice-diary",
    method="POST",
    headers={
        "Content-Type": "application/octet-stream",
        "X-Session-Id": args.session_id,
        "X-Audio-Format": args.audio_format,
        "X-Timestamp": datetime.now(timezone.utc).isoformat(),
        "X-Source": "acceptance_simulator",
    },
    data=audio,
)
with urlopen(request, timeout=15) as response:
    print(json.dumps(json.load(response), ensure_ascii=False, indent=2))
