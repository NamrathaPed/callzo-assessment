import os

import psycopg
import pytest
from psycopg.conninfo import make_conninfo

BASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://callzo:callzo_dev_password@localhost:5432/callzo"
)
TEST_DB = "callzo_test"


def _create_test_database() -> None:
    """Tests run against their own database so they never touch real data."""
    with psycopg.connect(BASE_URL, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,)
        ).fetchone()
        if not exists:
            conn.execute(f"CREATE DATABASE {TEST_DB}")


_create_test_database()
os.environ["DATABASE_URL"] = make_conninfo(BASE_URL, dbname=TEST_DB)
os.environ["WEBHOOK_SECRET"] = "test_secret"
os.environ["API_KEY"] = "test_api_key"
os.environ["MONTHLY_CAP_CENTS"] = "100"
os.environ["WORKER_INTERVAL_SECONDS"] = "3600"

from fastapi.testclient import TestClient  # noqa: E402

from app.db import pool  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clean_tables(client):
    with pool.connection() as conn:
        conn.execute("TRUNCATE raw_events, calls, usage_monthly")
