from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from uuid import uuid4


parser = argparse.ArgumentParser(description="Send one simulated Alloop HRV reading.")
parser.add_argument("--base-url", default="http://127.0.0.1:8010")
parser.add_argument("--device-id", default="alloop-demo-001")
parser.add_argument("--device-token", default="change-this-device-token")
parser.add_argument("--value", type=float, default=50)
parser.add_argument("--quality", type=float, default=0.95)
args = parser.parse_args()

payload = {
    "reading_id": f"reading-{uuid4().hex}",
    "device_id": args.device_id,
    "measured_at": datetime.now(timezone.utc).isoformat(),
    "value": args.value,
    "quality": args.quality,
}
request = Request(
    f"{args.base_url}/api/v1/hrv/readings",
    method="POST",
    headers={"Content-Type": "application/json; charset=utf-8", "X-Device-Token": args.device_token},
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
)
with urlopen(request, timeout=10) as response:
    print(json.dumps(json.load(response), ensure_ascii=False, indent=2))
