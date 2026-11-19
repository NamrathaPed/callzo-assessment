import asyncio
import logging

from fastapi.concurrency import run_in_threadpool

from .config import settings
from .events import retry_pending
from .logging_config import log


async def run_retry_worker() -> None:
    while True:
        await asyncio.sleep(settings.worker_interval_seconds)
        try:
            await run_in_threadpool(retry_pending)
        except Exception as exc:
            log("retry_worker_error", level=logging.ERROR, error=str(exc))
