# Task 1: Usage Metering Service

Receives call events from a telephony provider (webhooks), stores them, computes
usage per account per month, flags accounts over a monthly cap, and exposes usage
through an authenticated API.

Stack: Python 3.12, FastAPI, PostgreSQL 16, psycopg 3. No ORM, so every query is visible.

## Run it

```bash
cd Task-1
docker compose up --build
```

That starts Postgres, the API (port 8000), and then the provided simulator, which
sends every scenario (`--scenario all`) and exits. No manual setup is needed;
development defaults for secrets are in `docker-compose.yml`. To override them,
copy `.env.example` to `.env`.

To try one scenario at a time, change `--scenario` in the `simulator` command
(`normal`, `duplicates`, `out_of_order`, `late`, `malformed`, `bad_signature`, `cap_burst`).

Look at usage while it runs:

```bash
curl -H "X-API-Key: dev_api_key_change_me" \
  "http://localhost:8000/accounts/acct_001/usage?month=2026-11"
```

Run the tests (they use their own `callzo_test` database):

```bash
docker compose --profile test run --rm tests
```

## Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /webhooks/calls` | HMAC `X-Signature` | Receive events |
| `GET /accounts/{account_id}/usage?month=YYYY-MM` | `X-API-Key` | Usage, cap status, remaining budget |
| `POST /admin/reconcile?dry_run=true` | `X-API-Key` | Rebuild totals from raw events and report drift |
| `GET /health` | none | Checks the database connection (503 if down) |
| `GET /metrics` | none | Prometheus-style counters and pending/failed event counts |

## How an event flows

1. Read the **raw bytes**, verify HMAC-SHA256 with a constant-time compare. Bad or
   missing signature gives **401** before the payload is parsed.
2. Validate strictly with Pydantic (integers must be integers, timestamps must carry a
   timezone, unknown `event_type` is rejected). Invalid gives **422**; nothing is stored.
3. `INSERT ... ON CONFLICT (event_id) DO NOTHING` into `raw_events`. If nothing was
   inserted it is a duplicate and we return 200 `duplicate`.
4. In a second transaction, fold the event into `calls` and `usage_monthly`.
   If that fails, the event stays in `raw_events` as `pending` and the retry job picks it up.
   The sender still gets 200, because we have the event safely stored.

## Design decisions and trade-offs

**Raw events first.** Storing the untouched event before processing means a bug or
outage in processing can never lose data, and totals can always be rebuilt.
Cost: every event is written twice (raw row plus derived rows).

**Idempotency by `event_id` primary key.** The database enforces it, so it holds even
with concurrent deliveries. A *second `call.ended` with a different `event_id`* for the
same call is also not double-billed: a call is billed only on the first `call.ended` applied.

**Out-of-order events.** `calls` is one row per `call_id` built up from whatever arrives.
`call.started` only fills `started_at`; `call.ended` bills the call. Order doesn't
matter. Row locks (`SELECT ... FOR UPDATE`) serialize concurrent events for one call.
If both `failed` and `ended` arrive for a call, `ended` wins in either order.

**Money is integer cents** (`BIGINT`), never floats. Strict parsing rejects `1.5` or `"10"`.

**Totals are updated with one atomic upsert** (`ON CONFLICT DO UPDATE SET total = total + x`),
so concurrent calls on the same account can't lose updates.

### Assumptions I decided on (the spec leaves these open)

- **The cap is soft and measured in cents** (`MONTHLY_CAP_CENTS`, default 1000).
  A call that already happened cannot be rejected, and the provider would just resend,
  so we always record it. When `total_cost_cents >= cap` the account is flagged
  `capped: true` in the usage API and an `account_over_cap` log line is written.
  **Boundary:** exactly at the cap counts as capped. The call that crosses the line is
  counted in full, so usage can overshoot the cap by up to one call.
  A downstream system (e.g. call routing) is expected to read `capped` and block new calls.
  Trade-off: overshoot is possible. A hard cap would need cross-service locking to
  prevent calls, which this service can't do.
- **Months are UTC and based on the `call.ended` timestamp.** A call spanning
  midnight on the 1st is counted once, in the month it ended.
- **Late events** (timestamp older than 24h at receipt, `LATE_THRESHOLD_SECONDS`) are
  billed to the month of their **own timestamp** (so a 35-day-old event updates last
  month) and flagged `late`; the usage API shows `late_call_count` so they can be
  reviewed. Because `capped` is always `total >= cap`, a late event can flip a closed
  month to capped. I preferred one simple rule over special cases.
- **`call.failed` costs nothing** and is not counted in `call_count`.
- **Unknown accounts** matching `acct_NNN` return zeros rather than 404.

## Failure behavior

| Situation | Result |
|---|---|
| Missing/invalid signature | 401, nothing parsed or stored |
| Empty body, truncated JSON, wrong types, unknown type, missing field | 422, nothing stored |
| Same event delivered again | 200 `duplicate`, no change |
| Processing fails after raw event is stored | 200 `accepted`; event stays `pending`; retried with backoff (10s, then 10s, 20s, 40s... up to 5 min) |
| Still failing after 5 attempts (`MAX_ATTEMPTS`) | marked `failed`, visible in `/metrics`; recovered by reconcile |
| Database down when storing the raw event | 500, so the sender retries; the event is not lost on our side because it was never acknowledged |
| Process crashes between storing and processing | event is still `pending`; the retry job picks it up on restart |

**Retry job:** a background task in the API process wakes every 5s and processes
due `pending` events. `FOR UPDATE SKIP LOCKED` means it never double-processes.

**Reconciliation:** `POST /admin/reconcile` empties `calls` and `usage_monthly`
and replays every raw event through the *same* code used live, in one transaction with
the tables locked. `dry_run=true` (default) rolls back and only reports drift (before vs after per
account/month). `dry_run=false` commits and marks all events `processed`.

## Security

- Secrets come from environment variables (`WEBHOOK_SECRET`, `API_KEY`,
  `DATABASE_URL`); the app refuses to start without them. The values in
  `docker-compose.yml` are **development defaults only** (the simulator signs with the
  default webhook secret); real deployments must override them via `.env` or a secrets manager.
- API key compared in constant time. Path and query inputs validated with regexes.

## Observability

- JSON logs, one line per event: `webhook_handled`, `webhook_rejected`, `event_processed`,
  `event_processing_failed`, `account_over_cap`, `reconcile_finished`.
- `/health` (DB check) and `/metrics` (request outcomes, processing failures, raw event counts by status).

## What I'd do next with more time

- Per-account cap overrides and a cap-changed audit trail (cap is global today).
- Stream reconciliation per account/month instead of loading all events, and run it
  without blocking ingestion for long (currently a brief exclusive lock).
- Replace the in-process worker with a separate worker container so it scales independently.
- Proper migrations (Alembic) instead of `CREATE TABLE IF NOT EXISTS` on startup.
- Rate limiting and a max body size on the webhook; protect `/metrics`.
- Replay protection (reject stale signed timestamps) if the provider supports it.
- Load test the `cap_burst` scenario with concurrent senders.
