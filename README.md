# Callzo Engineering Assessment

Two independent deliverables, each with its own stack, `docker-compose.yml` and README.

| # | Deliverable | Stack | Ports |
|---|---|---|---|
| 1 | Usage metering service — webhook ingestion, dedupe, retry, monthly caps, reconcile, metrics | Python 3.12, FastAPI, PostgreSQL 16, psycopg 3 | API `8000`, DB internal |
| 2 | Usage admin console — accounts table, summary chart, 4-step settings wizard | React 18, Tailwind 3, Recharts 2, Nginx | UI `3000`, mock API `8001` |

They run side by side without conflicting ports.

## Task 1 — metering service

```bash
cd Task-1
docker compose up --build      # Postgres, API on :8000, then the scenario simulator
curl -H "X-API-Key: dev_api_key_change_me" \
  "http://localhost:8000/accounts/acct_001/usage?month=2026-11"
docker compose --profile test run --rm tests    # 32 tests
```

Details: [Task-1/README.md](Task-1/README.md)

## Task 2 — usage admin console

```bash
cd Task-2
docker compose up -d           # pulls the pre-built image, no build step
open http://localhost:3000
```

The frontend image is published and public:
`namrathapeddamalla/callzo-task2-frontend:latest`. The mock API
(`meetrj/callzo-mock-usage-api`, 10,500 accounts) is served on `:8001` and proxied
by Nginx under `/api/`.

Details: [Task-2/README.md](Task-2/README.md)

## Layout

```
Task-1/
  app/            FastAPI app: webhooks, metering, retry worker, reconcile, metrics
  tests/          pytest suite (32 tests)
  Dockerfile, docker-compose.yml
Task-2/
  src/            React app: views, hooks, components, fetch wrapper
  nginx.conf      static hosting + /api proxy
  Dockerfile, docker-compose.yml
```

## Notes

- The mock API's `/accounts/summary` fails about 1 call in 5 by design; the client
  retries with backoff and keeps the last good chart, so the rest of the page is
  unaffected.
- Dev secrets in both compose files are defaults prefixed `change_me`; both tasks
  document how to override them via `.env`.
