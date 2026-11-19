import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

SECRET = "test_secret"
API_KEY_HEADER = {"X-API-Key": "test_api_key"}


def sign(body: bytes) -> str:
    return hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()


def make_event(event_type="call.ended", account_id="acct_001", call_id=None,
               cost_cents=10, duration_seconds=300, timestamp=None, event_id=None):
    return {
        "event_id": event_id or f"evt_{uuid.uuid4().hex[:12]}",
        "event_type": event_type,
        "account_id": account_id,
        "call_id": call_id or f"call_{uuid.uuid4().hex[:12]}",
        "timestamp": (timestamp or datetime.now(timezone.utc)).isoformat(),
        "duration_seconds": duration_seconds,
        "cost_cents": cost_cents,
        "destination_country": "US",
    }


def post_raw(client, body: bytes, signature="valid"):
    headers = {}
    if signature == "valid":
        headers["X-Signature"] = sign(body)
    elif signature is not None:
        headers["X-Signature"] = signature
    return client.post("/webhooks/calls", content=body, headers=headers)


def post_event(client, event: dict):
    return post_raw(client, json.dumps(event).encode())


def month_of(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m")


def usage(client, account_id="acct_001", month=None):
    month = month or month_of(datetime.now(timezone.utc))
    response = client.get(
        f"/accounts/{account_id}/usage?month={month}", headers=API_KEY_HEADER
    )
    assert response.status_code == 200
    return response.json()
