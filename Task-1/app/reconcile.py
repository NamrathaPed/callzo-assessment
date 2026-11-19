from .db import pool
from .logging_config import log
from .metering import apply_event
from .models import CallEvent

USAGE_COLUMNS = "account_id, period, total_seconds, total_cost_cents, call_count, capped"


def _snapshot(conn) -> dict:
    rows = conn.execute(f"SELECT {USAGE_COLUMNS} FROM usage_monthly").fetchall()
    return {(r["account_id"], r["period"]): r for r in rows}


def _drift(before: dict, after: dict) -> list[dict]:
    return [
        {"account_id": key[0], "period": key[1],
         "before": before.get(key), "after": after.get(key)}
        for key in sorted(before.keys() | after.keys())
        if before.get(key) != after.get(key)
    ]


def reconcile(dry_run: bool) -> dict:
    """Rebuild calls and usage_monthly from raw_events and report any drift.

    Runs in one transaction with the tables locked, so ingestion waits for a
    moment instead of racing with the rebuild. A dry run rolls everything back.
    """
    with pool.connection() as conn:
        conn.execute("LOCK TABLE raw_events, calls, usage_monthly IN EXCLUSIVE MODE")
        before = _snapshot(conn)
        conn.execute("DELETE FROM usage_monthly")
        conn.execute("DELETE FROM calls")

        events = conn.execute(
            "SELECT payload, received_at FROM raw_events ORDER BY received_at, event_id"
        ).fetchall()
        for row in events:
            apply_event(conn, CallEvent.model_validate(row["payload"]), row["received_at"])

        drift = _drift(before, _snapshot(conn))
        if dry_run:
            conn.rollback()
        else:
            conn.execute(
                "UPDATE raw_events SET status = 'processed', last_error = NULL "
                "WHERE status <> 'processed'"
            )

    log("reconcile_finished", dry_run=dry_run, events_replayed=len(events),
        drift_count=len(drift))
    return {"dry_run": dry_run, "events_replayed": len(events),
            "drift_count": len(drift), "drift": drift}
