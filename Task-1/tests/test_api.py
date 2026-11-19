from helpers import API_KEY_HEADER, make_event, post_event


def test_usage_requires_api_key(client):
    assert client.get("/accounts/acct_001/usage").status_code == 401
    assert client.get("/accounts/acct_001/usage", headers={"X-API-Key": "wrong"}).status_code == 401


def test_usage_validates_input(client):
    assert client.get("/accounts/bad_id/usage", headers=API_KEY_HEADER).status_code == 422
    assert client.get("/accounts/acct_001/usage?month=2026-13", headers=API_KEY_HEADER).status_code == 422
    assert client.get("/accounts/acct_001/usage?month=nov", headers=API_KEY_HEADER).status_code == 422


def test_account_without_usage_returns_zeros(client):
    body = client.get("/accounts/acct_009/usage", headers=API_KEY_HEADER).json()
    assert body["total_cost_cents"] == 0 and body["capped"] is False


def test_health_and_metrics(client):
    assert client.get("/health").json() == {"status": "ok"}
    post_event(client, make_event())
    metrics_text = client.get("/metrics").text
    assert 'webhook_requests_total{outcome="accepted"}' in metrics_text
    assert 'raw_events{status="processed"}' in metrics_text
