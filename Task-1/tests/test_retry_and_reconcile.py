import pytest

import app.events as events
from app.config import settings
from app.db import pool
from helpers import API_KEY_HEADER, make_event, post_event, usage


def raw_row(event_id: str) -> dict:
    with pool.connection() as conn:
        return conn.execute("SELECT * FROM raw_events WHERE event_id = %s", (event_id,)).fetchone()


def make_due() -> None:
    with pool.connection() as conn:
        conn.execute("UPDATE raw_events SET next_retry_at = now() - interval '1 second'")


@pytest.fixture
def failing_once(monkeypatch):
    real_apply = events.apply_event
    state = {"calls": 0}

    def flaky(*args, **kwargs):
        state["calls"] += 1
        if state["calls"] == 1:
            raise RuntimeError("database hiccup")
        return real_apply(*args, **kwargs)

    monkeypatch.setattr(events, "apply_event", flaky)


def test_failed_processing_is_kept_and_retried(client, failing_once):
    event = make_event(cost_cents=30)
    assert post_event(client, event).status_code == 200  # raw event is safe

    row = raw_row(event["event_id"])
    assert row["status"] == "pending" and row["attempts"] == 1
    assert "database hiccup" in row["last_error"]
    assert usage(client)["total_cost_cents"] == 0

    make_due()
    assert events.retry_pending() == 1
    assert raw_row(event["event_id"])["status"] == "processed"
    assert usage(client)["total_cost_cents"] == 30


def test_event_is_marked_failed_after_max_attempts_then_reconcile_recovers_it(client, monkeypatch):
    real_apply = events.apply_event
    monkeypatch.setattr(events, "apply_event", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("down")))

    event = make_event(cost_cents=30)
    post_event(client, event)
    for _ in range(settings.max_attempts - 1):
        make_due()
        events.retry_pending()
    assert raw_row(event["event_id"])["status"] == "failed"

    monkeypatch.setattr(events, "apply_event", real_apply)
    result = client.post("/admin/reconcile?dry_run=false", headers=API_KEY_HEADER).json()
    assert result["events_replayed"] == 1
    assert raw_row(event["event_id"])["status"] == "processed"
    assert usage(client)["total_cost_cents"] == 30


def test_reconcile_dry_run_reports_drift_without_changing_anything(client):
    post_event(client, make_event(cost_cents=40))
    with pool.connection() as conn:
        conn.execute("UPDATE usage_monthly SET total_cost_cents = 9999")

    report = client.post("/admin/reconcile", headers=API_KEY_HEADER).json()
    assert report["dry_run"] is True and report["drift_count"] == 1
    assert report["drift"][0]["before"]["total_cost_cents"] == 9999
    assert report["drift"][0]["after"]["total_cost_cents"] == 40
    assert usage(client)["total_cost_cents"] == 9999  # untouched


def test_reconcile_apply_repairs_usage(client):
    post_event(client, make_event(cost_cents=40))
    post_event(client, make_event(cost_cents=70))
    with pool.connection() as conn:
        conn.execute("UPDATE usage_monthly SET total_cost_cents = 1, capped = false")

    client.post("/admin/reconcile?dry_run=false", headers=API_KEY_HEADER)
    repaired = usage(client)
    assert repaired["total_cost_cents"] == 110 and repaired["capped"] is True


def test_reconcile_requires_api_key(client):
    assert client.post("/admin/reconcile").status_code == 401
