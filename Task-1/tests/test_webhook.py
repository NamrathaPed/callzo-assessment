import json
from datetime import datetime, timedelta, timezone

import pytest

from app.db import pool
from helpers import make_event, month_of, post_event, post_raw, sign, usage


def count(table: str) -> int:
    with pool.connection() as conn:
        return conn.execute(f"SELECT count(*) AS n FROM {table}").fetchone()["n"]


# ---- signature -------------------------------------------------------------

def test_missing_signature_is_rejected_and_nothing_is_stored(client):
    body = json.dumps(make_event()).encode()
    assert post_raw(client, body, signature=None).status_code == 401
    assert count("raw_events") == 0


def test_wrong_signature_is_rejected(client):
    body = json.dumps(make_event()).encode()
    assert post_raw(client, body, signature="deadbeef").status_code == 401
    assert count("raw_events") == 0


def test_signature_of_a_different_body_is_rejected(client):
    original = json.dumps(make_event(cost_cents=1)).encode()
    tampered = json.dumps(make_event(cost_cents=999)).encode()
    assert post_raw(client, tampered, signature=sign(original)).status_code == 401


# ---- malformed input -------------------------------------------------------

@pytest.mark.parametrize("body", [
    b"",
    b'{"event_id": "evt_1", "event_type": "call.ended"',
    b"not json at all",
    b"[]",
])
def test_unparseable_bodies_are_422(client, body):
    assert post_raw(client, body).status_code == 422
    assert count("raw_events") == 0


def test_unknown_event_type_is_a_client_error(client):
    event = make_event()
    event["event_type"] = "call.exploded"
    assert post_event(client, event).status_code == 422


def test_missing_field_is_a_client_error(client):
    event = make_event()
    del event["account_id"]
    assert post_event(client, event).status_code == 422


@pytest.mark.parametrize("field,value", [
    ("cost_cents", 1.5),
    ("cost_cents", "10"),
    ("cost_cents", -1),
    ("duration_seconds", "abc"),
    ("account_id", "acct_1"),
    ("timestamp", "yesterday"),
    ("timestamp", "2026-11-01T10:15:30"),
])
def test_wrong_types_or_values_are_client_errors(client, field, value):
    event = make_event()
    event[field] = value
    assert post_event(client, event).status_code == 422
    assert count("raw_events") == 0


# ---- duplicates, ordering, failures ---------------------------------------

def test_duplicate_events_are_counted_once(client):
    event = make_event(cost_cents=40)
    statuses = [post_event(client, event).json()["status"] for _ in range(3)]
    assert statuses == ["accepted", "duplicate", "duplicate"]
    assert count("raw_events") == 1
    assert usage(client)["total_cost_cents"] == 40


def test_ended_before_started_ends_in_the_same_state(client):
    call_id = "call_out_of_order"
    now = datetime.now(timezone.utc)
    post_event(client, make_event("call.ended", call_id=call_id, cost_cents=30, timestamp=now))
    post_event(client, make_event("call.started", call_id=call_id, cost_cents=0,
                                  duration_seconds=0, timestamp=now - timedelta(minutes=5)))
    result = usage(client)
    assert result["total_cost_cents"] == 30
    assert result["call_count"] == 1
    with pool.connection() as conn:
        call = conn.execute("SELECT * FROM calls WHERE call_id = %s", (call_id,)).fetchone()
    assert call["status"] == "ended" and call["started_at"] is not None


def test_second_ended_event_with_new_id_is_not_double_counted(client):
    first = make_event(call_id="call_x", cost_cents=25)
    second = make_event(call_id="call_x", cost_cents=25)
    post_event(client, first)
    post_event(client, second)
    assert usage(client)["total_cost_cents"] == 25


def test_failed_call_costs_nothing(client):
    post_event(client, make_event("call.failed", cost_cents=0, duration_seconds=0))
    result = usage(client)
    assert result["total_cost_cents"] == 0 and result["call_count"] == 0


# ---- cap (test config: cap = 100 cents, soft) ------------------------------

def test_cap_boundary(client):
    expectations = [(40, 40, False), (40, 80, False), (19, 99, False),
                    (1, 100, True),    # exactly at the cap counts as capped
                    (50, 150, True)]   # still accepted and counted in full
    for cost, expected_total, expected_capped in expectations:
        assert post_event(client, make_event(cost_cents=cost)).status_code == 200
        result = usage(client)
        assert result["total_cost_cents"] == expected_total
        assert result["capped"] is expected_capped
    assert usage(client)["remaining_cents"] == 0


def test_cap_is_per_account(client):
    post_event(client, make_event(account_id="acct_001", cost_cents=500))
    post_event(client, make_event(account_id="acct_002", cost_cents=10))
    assert usage(client, "acct_001")["capped"] is True
    assert usage(client, "acct_002")["capped"] is False


# ---- late events -----------------------------------------------------------

def test_late_event_is_billed_to_its_own_month_and_flagged(client):
    old = datetime.now(timezone.utc) - timedelta(days=35)
    post_event(client, make_event(cost_cents=20, timestamp=old))
    old_month = usage(client, month=month_of(old))
    assert old_month["total_cost_cents"] == 20
    assert old_month["late_call_count"] == 1
    this_month = month_of(datetime.now(timezone.utc))
    if this_month != month_of(old):
        assert usage(client, month=this_month)["total_cost_cents"] == 0
