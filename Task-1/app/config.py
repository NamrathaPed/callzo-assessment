import os
from dataclasses import dataclass


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    database_url: str
    webhook_secret: str
    api_key: str
    monthly_cap_cents: int
    late_threshold_seconds: int
    max_attempts: int
    worker_interval_seconds: float


def load_settings() -> Settings:
    return Settings(
        database_url=_required("DATABASE_URL"),
        webhook_secret=_required("WEBHOOK_SECRET"),
        api_key=_required("API_KEY"),
        monthly_cap_cents=int(os.environ.get("MONTHLY_CAP_CENTS", "1000")),
        late_threshold_seconds=int(os.environ.get("LATE_THRESHOLD_SECONDS", "86400")),
        max_attempts=int(os.environ.get("MAX_ATTEMPTS", "5")),
        worker_interval_seconds=float(os.environ.get("WORKER_INTERVAL_SECONDS", "5")),
    )


settings = load_settings()
