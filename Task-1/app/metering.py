from datetime import datetime, timezone

from .config import settings
from .models import CallEvent

USAGE_UPSERT = """
INSERT INTO usage_monthly
    (account_id, period, total_seconds, total_cost_cents, call_count, capped)
VALUES
    (%(account_id)s, %(period)s, %(seconds)s, %(cost)s, 1, %(cost)s >= %(cap)s)
ON CONFLICT (account_id, period) DO UPDATE SET
    total_seconds    = usage_monthly.total_seconds + EXCLUDED.total_seconds,
    total_cost_cents = usage_monthly.total_cost_cents + EXCLUDED.total_cost_cents,
    call_count       = usage_monthly.call_count + 1,
    capped           = usage_monthly.total_cost_cents + EXCLUDED.total_cost_cents >= %(cap)s
RETURNING account_id, period, total_cost_cents, capped
"""


def month_of(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m")


def apply_event(conn, event: CallEvent, received_at: datetime) -> dict | None:
    """Fold one event into the calls and usage tables.

    Safe to call in any order: a call is billed once, when its first
    call.ended event is applied, no matter what else arrived before it.
    Returns the updated usage row if the call was billed, otherwise None.
    """
    conn.execute(
        "INSERT INTO calls (call_id, account_id) VALUES (%s, %s) "
        "ON CONFLICT (call_id) DO NOTHING",
        (event.call_id, event.account_id),
    )
    call = conn.execute(
        "SELECT status FROM calls WHERE call_id = %s FOR UPDATE", (event.call_id,)
    ).fetchone()

    if event.event_type == "call.started":
        conn.execute(
            "UPDATE calls SET started_at = COALESCE(started_at, %s) WHERE call_id = %s",
            (event.timestamp, event.call_id),
        )
    elif event.event_type == "call.failed":
        if call["status"] == "open":
            conn.execute(
                "UPDATE calls SET status = 'failed' WHERE call_id = %s",
                (event.call_id,),
            )
    elif call["status"] != "ended":
        return _bill_call(conn, event, received_at)
    return None


def _bill_call(conn, event: CallEvent, received_at: datetime) -> dict:
    period = month_of(event.timestamp)
    lateness = (received_at - event.timestamp).total_seconds()
    conn.execute(
        "UPDATE calls SET status = 'ended', ended_at = %s, duration_seconds = %s, "
        "cost_cents = %s, billed_period = %s, late = %s WHERE call_id = %s",
        (
            event.timestamp,
            event.duration_seconds,
            event.cost_cents,
            period,
            lateness > settings.late_threshold_seconds,
            event.call_id,
        ),
    )
    return conn.execute(
        USAGE_UPSERT,
        {
            "account_id": event.account_id,
            "period": period,
            "seconds": event.duration_seconds,
            "cost": event.cost_cents,
            "cap": settings.monthly_cap_cents,
        },
    ).fetchone()


def get_usage(conn, account_id: str, month: str) -> dict:
    row = conn.execute(
        "SELECT total_seconds, total_cost_cents, call_count, capped "
        "FROM usage_monthly WHERE account_id = %s AND period = %s",
        (account_id, month),
    ).fetchone() or {
        "total_seconds": 0,
        "total_cost_cents": 0,
        "call_count": 0,
        "capped": False,
    }
    late_calls = conn.execute(
        "SELECT count(*) AS n FROM calls "
        "WHERE account_id = %s AND billed_period = %s AND late",
        (account_id, month),
    ).fetchone()["n"]
    cap = settings.monthly_cap_cents
    return {
        "account_id": account_id,
        "month": month,
        **row,
        "late_call_count": late_calls,
        "cap_cents": cap,
        "remaining_cents": max(cap - row["total_cost_cents"], 0),
    }
