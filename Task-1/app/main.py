import asyncio
import contextlib
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import PlainTextResponse
from pydantic import ValidationError

from . import metrics
from .db import init_db, pool
from .events import ingest_event
from .logging_config import configure_logging, log
from .metering import get_usage, month_of
from .models import CallEvent
from .reconcile import reconcile
from .security import require_api_key, signature_is_valid
from .worker import run_retry_worker

ACCOUNT_PATTERN = r"^acct_\d{3}$"
MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    init_db()
    worker = asyncio.create_task(run_retry_worker())
    yield
    worker.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await worker
    pool.close()


app = FastAPI(title="Callzo Usage Metering", lifespan=lifespan)


@app.post("/webhooks/calls")
async def receive_call_event(request: Request):
    raw_body = await request.body()

    if not signature_is_valid(raw_body, request.headers.get("X-Signature")):
        metrics.inc("webhook_requests_total", outcome="bad_signature")
        log("webhook_rejected", level=logging.WARNING, reason="bad_signature")
        raise HTTPException(status_code=401, detail="invalid signature")

    try:
        event = CallEvent.model_validate_json(raw_body, strict=True)
    except ValidationError as exc:
        metrics.inc("webhook_requests_total", outcome="invalid")
        log("webhook_rejected", level=logging.WARNING, reason="invalid_payload")
        problems = [{"loc": e["loc"], "msg": e["msg"]} for e in exc.errors()]
        raise HTTPException(status_code=422, detail=problems)

    outcome = await run_in_threadpool(ingest_event, event, json.loads(raw_body))
    metrics.inc("webhook_requests_total", outcome=outcome)
    log("webhook_handled", outcome=outcome, event_id=event.event_id)
    return {"status": outcome}


@app.get("/accounts/{account_id}/usage", dependencies=[Depends(require_api_key)])
def account_usage(
    account_id: str = Path(pattern=ACCOUNT_PATTERN),
    month: str | None = Query(default=None, pattern=MONTH_PATTERN),
):
    with pool.connection() as conn:
        return get_usage(conn, account_id, month or month_of(datetime.now(timezone.utc)))


@app.post("/admin/reconcile", dependencies=[Depends(require_api_key)])
def admin_reconcile(dry_run: bool = True):
    return reconcile(dry_run)


@app.get("/health")
def health():
    try:
        with pool.connection() as conn:
            conn.execute("SELECT 1")
    except Exception:
        raise HTTPException(status_code=503, detail="database unavailable")
    return {"status": "ok"}


@app.get("/metrics", response_class=PlainTextResponse)
def prometheus_metrics():
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT status, count(*) AS n FROM raw_events GROUP BY status"
        ).fetchall()
    counts = {row["status"]: row["n"] for row in rows}
    gauges = {
        f'raw_events{{status="{status}"}}': counts.get(status, 0)
        for status in ("pending", "processed", "failed")
    }
    return metrics.render(gauges)
