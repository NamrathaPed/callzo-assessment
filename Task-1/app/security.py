import hashlib
import hmac

from fastapi import Header, HTTPException

from .config import settings


def signature_is_valid(raw_body: bytes, received: str | None) -> bool:
    if not received:
        return False
    expected = hmac.new(
        settings.webhook_secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(received.strip().lower().encode(), expected.encode())


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not x_api_key or not hmac.compare_digest(
        x_api_key.encode(), settings.api_key.encode()
    ):
        raise HTTPException(status_code=401, detail="invalid api key")
