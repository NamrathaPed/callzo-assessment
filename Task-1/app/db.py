from pathlib import Path

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import settings

pool = ConnectionPool(
    settings.database_url,
    min_size=1,
    max_size=10,
    kwargs={"row_factory": dict_row},
    open=False,
)


def init_db() -> None:
    pool.open(wait=True, timeout=30)
    schema = (Path(__file__).parent / "schema.sql").read_text()
    with pool.connection() as conn:
        conn.execute(schema)
