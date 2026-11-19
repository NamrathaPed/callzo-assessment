from psycopg.types.json import Jsonb

from . import metrics
from .config import settings
from .db import pool
from .logging_config import log
from .metering import apply_event
from .models import CallEvent

FAILURE_UPDATE = """
UPDATE raw_events SET
    attempts      = attempts + 1,
    last_error    = %(error)s,
    status        = CASE WHEN attempts + 1 >= %(max_attempts)s THEN 'failed' ELSE 'pending' END,
    next_retry_at = now() + LEAST(power(2, attempts + 1) * 5, 300) * interval '1 second'
WHERE event_id = %(event_id)s
"""


def ingest_event(event: CallEvent, payload: dict) -> str:
    """Store the raw event, then try to process it. Returns 'accepted' or 'duplicate'."""
    with pool.connection() as conn:
        inserted = conn.execute(
            "INSERT INTO raw_events (event_id, payload) VALUES (%s, %s) "
            "ON CONFLICT (event_id) DO NOTHING RETURNING event_id",
            (event.event_id, Jsonb(payload)),
        ).fetchone()
    if inserted is None:
        return "duplicate"
    process_event(event.event_id)
    return "accepted"


def process_event(event_id: str) -> bool:
    """Apply one pending raw event. Failures are recorded for the retry job."""
    try:
        with pool.connection() as conn:
            row = conn.execute(
                "SELECT payload, received_at FROM raw_events "
                "WHERE event_id = %s AND status = 'pending' FOR UPDATE SKIP LOCKED",
                (event_id,),
            ).fetchone()
            if row is None:
                return False
            event = CallEvent.model_validate(row["payload"])
            usage = apply_event(conn, event, row["received_at"])
            conn.execute(
                "UPDATE raw_events SET status = 'processed', attempts = attempts + 1, "
                "last_error = NULL WHERE event_id = %s",
                (event_id,),
            )
    except Exception as exc:
        _record_failure(event_id, exc)
        return False

    metrics.inc("events_processed_total", event_type=event.event_type)
    log("event_processed", event_id=event_id, call_id=event.call_id,
        account_id=event.account_id, event_type=event.event_type)
    if usage and usage["capped"]:
        log("account_over_cap", account_id=usage["account_id"], period=usage["period"],
            total_cost_cents=usage["total_cost_cents"], cap_cents=settings.monthly_cap_cents)
    return True


def _record_failure(event_id: str, exc: Exception) -> None:
    with pool.connection() as conn:
        conn.execute(
            FAILURE_UPDATE,
            {
                "error": f"{type(exc).__name__}: {exc}"[:500],
                "max_attempts": settings.max_attempts,
                "event_id": event_id,
            },
        )
    metrics.inc("event_processing_failures_total")
    log("event_processing_failed", level=40, event_id=event_id, error=str(exc))


def retry_pending(batch_size: int = 100) -> int:
    """Process pending events whose retry time has come. Returns how many succeeded."""
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT event_id FROM raw_events "
            "WHERE status = 'pending' AND next_retry_at <= now() "
            "ORDER BY received_at LIMIT %s",
            (batch_size,),
        ).fetchall()
    return sum(process_event(row["event_id"]) for row in rows)
