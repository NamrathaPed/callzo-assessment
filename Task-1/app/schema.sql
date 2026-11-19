-- Every validated event is stored here first, exactly as received.
-- This table is the source of truth; everything else can be rebuilt from it.
CREATE TABLE IF NOT EXISTS raw_events (
    event_id      TEXT PRIMARY KEY,
    payload       JSONB NOT NULL,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processed', 'failed')),
    attempts      INTEGER NOT NULL DEFAULT 0,
    last_error    TEXT,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 seconds'
);
CREATE INDEX IF NOT EXISTS raw_events_retry_idx
    ON raw_events (next_retry_at) WHERE status = 'pending';

-- One row per call, built up from started / ended / failed events in any order.
CREATE TABLE IF NOT EXISTS calls (
    call_id          TEXT PRIMARY KEY,
    account_id       TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'ended', 'failed')),
    started_at       TIMESTAMPTZ,
    ended_at         TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    cost_cents       BIGINT NOT NULL DEFAULT 0,
    billed_period    TEXT,
    late             BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS calls_account_period_idx
    ON calls (account_id, billed_period);

-- Running totals per account per month (UTC). Money is integer cents.
CREATE TABLE IF NOT EXISTS usage_monthly (
    account_id       TEXT NOT NULL,
    period           TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
    total_seconds    BIGINT NOT NULL DEFAULT 0,
    total_cost_cents BIGINT NOT NULL DEFAULT 0,
    call_count       INTEGER NOT NULL DEFAULT 0,
    capped           BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (account_id, period)
);
