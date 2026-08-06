from __future__ import annotations

import argparse
import json
from urllib.request import Request, urlopen
from uuid import uuid4


parser = argparse.ArgumentParser(description="Submit one daughter-side pigeon letter.")
parser.add_argument("--base-url", default="http://127.0.0.1:8010")
parser.add_argument("--text", default="我最近准备换工作，但很害怕。")
args = parser.parse_args()

request_id = f"request-{uuid4().hex}"
payload = {
    "client_request_id": request_id,
    "relationship_id": "rel_linlan_linya_001",
    "recipient_id": "person_linya",
    "device_id": "alloop-demo-001",
    "input": {"type": "text", "text": args.text},
    "preferences": {"content_intensity": "L1"},
}
request = Request(
    f"{args.base_url}/api/v1/interactions",
    method="POST",
    headers={"Content-Type": "application/json; charset=utf-8", "Idempotency-Key": request_id},
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
)
with urlopen(request, timeout=30) as response:
    print(json.dumps(json.load(response), ensure_ascii=False, indent=2))
