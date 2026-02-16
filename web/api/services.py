"""Bridge between Django views and existing circus async business logic.

Uses the shared CircusScheduler executor loop instead of asyncio.run()
per request, fixing event loop fragility and sharing the DevicePool.
"""
import asyncio

from circus.persona.generator import generate_personas as _gen_personas
from circus.tasks.executor import ParallelExecutor
from circus.tasks.models import Task as CircusTask
from circus.tasks.runner import TaskRunner


def _get_scheduler():
    from api.scheduler import get_scheduler
    return get_scheduler()


def get_config():
    return _get_scheduler().config


def get_pool():
    return _get_scheduler().pool


def _run_async(coro, timeout=None):
    """Submit a coroutine to the shared executor loop and wait for result."""
    scheduler = _get_scheduler()
    if not scheduler._started:
        scheduler.start()
    future = asyncio.run_coroutine_threadsafe(coro, scheduler.loop)
    return future.result(timeout=timeout)


def _serialize_device(dev) -> dict:
    return {
        "serial": dev.serial,
        "status": dev.status.value,
        "model": dev.info.model if dev.info else "",
        "brand": dev.info.brand if dev.info else "",
        "android_version": dev.info.android_version if dev.info else "",
        "sdk_version": dev.info.sdk_version if dev.info else 0,
        "current_task": dev.current_task,
        "last_seen": dev.last_seen,
        "error_message": dev.error_message,
    }


def refresh_devices() -> list[dict]:
    pool = get_pool()
    devices = _run_async(pool.refresh())
    return [_serialize_device(d) for d in devices]


def list_devices() -> list[dict]:
    return [_serialize_device(d) for d in get_pool().list_all()]


def get_device(serial: str) -> dict | None:
    dev = get_pool().get(serial)
    if dev is None:
        return None
    return _serialize_device(dev)


def _db_task_to_circus(task) -> CircusTask:
    """Convert a Django Task model instance to a circus Task dataclass."""
    return CircusTask(
        name=task.name,
        actions=task.actions,
        description=task.description,
        target_package=task.target_package,
        timeout=task.timeout,
        retry_count=task.retry_count,
        id=task.id,
    )


def _ensure_devices():
    """Auto-refresh device pool if empty."""
    pool = get_pool()
    if not pool.list_all():
        _run_async(pool.refresh())


def run_task_on_device(task, serial: str | None = None) -> dict:
    config = get_config()
    pool = get_pool()
    _ensure_devices()
    circus_task = _db_task_to_circus(task)
    runner = TaskRunner(pool, config)
    result = _run_async(runner.run(circus_task, serial=serial), timeout=task.timeout + 30)
    return {
        "task_id": result.task_id,
        "device_serial": result.device_serial,
        "success": result.success,
        "actions_completed": result.actions_completed,
        "actions_total": result.actions_total,
        "duration": round(result.duration, 2),
        "error": result.error,
        "screenshot_count": len(result.screenshots),
    }


def run_task_on_all(task, device_filter: list[str] | None = None) -> dict:
    config = get_config()
    pool = get_pool()
    _ensure_devices()
    circus_task = _db_task_to_circus(task)
    executor = ParallelExecutor(pool, config, store_results=False)
    summary = _run_async(executor.run_on_all(circus_task, device_filter=device_filter))
    return {
        "total_devices": summary.total_devices,
        "successful": summary.successful,
        "failed": summary.failed,
        "duration": round(summary.duration, 2),
        "results": [
            {
                "task_id": r.task_id,
                "device_serial": r.device_serial,
                "success": r.success,
                "actions_completed": r.actions_completed,
                "actions_total": r.actions_total,
                "duration": round(r.duration, 2),
                "error": r.error,
                "screenshot_count": len(r.screenshots),
            }
            for r in summary.results
        ],
    }


def generate_personas(
    count: int,
    services: list[str] | None = None,
    niche: str | None = None,
    tone: str | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
):
    return _gen_personas(
        count, services=services,
        niche=niche, tone=tone,
        age_min=age_min, age_max=age_max,
    )
