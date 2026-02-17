"""Circus task scheduler and queue processor.

Runs inside the Django process. APScheduler handles trigger timing,
Django models track queue state, and a dedicated asyncio event loop
executes tasks via the existing TaskRunner.
"""
from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime, timedelta

from django.utils import timezone

from circus.config import Config
from circus.device.pool import DevicePool
from circus.device.screen import ScreenCaptureManager
from circus.tasks.models import Task as CircusTask
from circus.tasks.runner import TaskRunner

logger = logging.getLogger(__name__)


def _is_within_active_hours(hour: int, start: int, end: int) -> bool:
    """Check if hour is within [start, end) window, handling midnight wrap."""
    if start <= end:
        return start <= hour < end
    return hour >= start or hour < end


class CircusScheduler:
    """Central scheduler owning the event loop, device pool, and APScheduler."""

    def __init__(self):
        self.config = Config()
        self.screen_manager = ScreenCaptureManager()
        self.pool = DevicePool(on_change=self._on_device_change)
        self._loop: asyncio.AbstractEventLoop | None = None
        self._loop_thread: threading.Thread | None = None
        self._aps = None  # APScheduler BackgroundScheduler
        self._started = False

    @property
    def loop(self) -> asyncio.AbstractEventLoop:
        if self._loop is None:
            raise RuntimeError("Scheduler not started")
        return self._loop

    def start(self):
        if self._started:
            return

        # Start persistent asyncio event loop in daemon thread
        self._loop = asyncio.new_event_loop()
        self._loop_thread = threading.Thread(
            target=self._run_loop, daemon=True, name="circus-executor"
        )
        self._loop_thread.start()

        # Start APScheduler with memory store (avoids SQLite locking issues).
        # Schedule state is persisted in our own ScheduledTask model, so we
        # don't need APScheduler's DjangoJobStore — we rebuild jobs on start.
        from apscheduler.schedulers.background import BackgroundScheduler

        self._aps = BackgroundScheduler()

        # Register queue processor (runs every 5 seconds)
        self._aps.add_job(
            _process_queue,
            "interval",
            seconds=5,
            id="circus_queue_processor",
            replace_existing=True,
            misfire_grace_time=30,
        )

        self._aps.start()
        self._started = True
        logger.info("Circus scheduler started")

        # Defer schedule sync to avoid DB access during app init
        _timer = threading.Timer(2.0, self.sync_all_schedules)
        _timer.daemon = True
        _timer.start()

    def _on_device_change(self, event: str, serial: str) -> None:
        """Called by DevicePool when devices are added or removed."""
        logger.info(f"Device {event}: {serial}")
        if event == "added":
            self.screen_manager.start(serial)
        elif event == "removed":
            self.screen_manager.stop(serial)

    def shutdown(self):
        self.screen_manager.stop_all()
        if self._aps:
            self._aps.shutdown(wait=False)
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)
        self._started = False
        logger.info("Circus scheduler stopped")

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def sync_all_schedules(self):
        """Load all active ScheduledTask records into APScheduler."""
        from api.models import ScheduledTask

        for schedule in ScheduledTask.objects.filter(status="active"):
            self.sync_schedule(schedule)

    def sync_schedule(self, schedule):
        """Add or update an APScheduler job from a ScheduledTask model."""
        from apscheduler.triggers.cron import CronTrigger
        from apscheduler.triggers.date import DateTrigger
        from apscheduler.triggers.interval import IntervalTrigger

        job_id = f"schedule_{schedule.id}"

        # Remove existing job if any
        try:
            self._aps.remove_job(job_id)
        except Exception:
            pass

        if schedule.status != "active":
            return

        # Build trigger
        if schedule.trigger_type == "cron" and schedule.cron_expression:
            parts = schedule.cron_expression.strip().split()
            trigger = CronTrigger(
                minute=parts[0] if len(parts) > 0 else "*",
                hour=parts[1] if len(parts) > 1 else "*",
                day=parts[2] if len(parts) > 2 else "*",
                month=parts[3] if len(parts) > 3 else "*",
                day_of_week=parts[4] if len(parts) > 4 else "*",
            )
        elif schedule.trigger_type == "interval" and schedule.interval_seconds > 0:
            trigger = IntervalTrigger(seconds=schedule.interval_seconds)
        elif schedule.trigger_type == "once" and schedule.run_at:
            trigger = DateTrigger(run_date=schedule.run_at)
        else:
            logger.warning(f"Schedule {schedule.id}: invalid trigger config, skipping")
            return

        self._aps.add_job(
            _on_trigger_fire,
            trigger,
            args=[schedule.id],
            id=job_id,
            replace_existing=True,
            misfire_grace_time=3600,
        )

        # Update next_run_at
        job = self._aps.get_job(job_id)
        if job and job.next_run_time:
            schedule.next_run_at = job.next_run_time
            schedule.save(update_fields=["next_run_at"])

        logger.info(f"Synced schedule {schedule.id} ({schedule.trigger_type})")

    def remove_schedule(self, schedule_id: str):
        job_id = f"schedule_{schedule_id}"
        try:
            self._aps.remove_job(job_id)
        except Exception:
            pass


# --- Module-level singleton ---

_scheduler: CircusScheduler | None = None
_lock = threading.Lock()


def get_scheduler() -> CircusScheduler:
    global _scheduler
    if _scheduler is None:
        with _lock:
            if _scheduler is None:
                _scheduler = CircusScheduler()
    return _scheduler


# --- Trigger and queue functions ---


def _on_trigger_fire(schedule_id: str):
    """Called by APScheduler when a schedule's trigger fires."""
    from api.models import QueuedRun, ScheduledTask

    try:
        schedule = ScheduledTask.objects.select_related("task", "persona").get(
            id=schedule_id
        )
    except ScheduledTask.DoesNotExist:
        logger.warning(f"Schedule {schedule_id} not found, removing job")
        get_scheduler().remove_schedule(schedule_id)
        return

    if schedule.status != "active":
        return

    # Resolve device serial
    device_serial = schedule.device_serial
    if not device_serial and schedule.persona and schedule.persona.assigned_device:
        device_serial = schedule.persona.assigned_device

    # Check active hours
    if schedule.respect_active_hours and schedule.persona:
        current_hour = datetime.now().hour
        start = schedule.persona.active_hours_start
        end = schedule.persona.active_hours_end
        if not _is_within_active_hours(current_hour, start, end):
            QueuedRun.objects.create(
                task=schedule.task,
                schedule=schedule,
                persona=schedule.persona,
                device_serial=device_serial,
                status="skipped",
                error=f"Outside active hours (current={current_hour}, window={start}-{end})",
            )
            logger.info(
                f"Schedule {schedule_id}: skipped, outside active hours "
                f"({current_hour} not in {start}-{end})"
            )
            schedule.last_run_at = timezone.now()
            schedule.save(update_fields=["last_run_at"])
            return

    # Create queued run
    QueuedRun.objects.create(
        task=schedule.task,
        schedule=schedule,
        persona=schedule.persona,
        device_serial=device_serial,
        max_retries=schedule.task.retry_count,
    )

    schedule.last_run_at = timezone.now()
    schedule.save(update_fields=["last_run_at"])
    logger.info(f"Schedule {schedule_id}: queued run for task {schedule.task.name}")


def _process_queue():
    """Pick up queued runs and submit them to the executor loop."""
    from api.models import QueuedRun

    now = timezone.now()
    queued = QueuedRun.objects.filter(
        status="queued", queued_at__lte=now
    ).order_by("-priority", "queued_at")[:10]  # Process up to 10 at a time

    scheduler = get_scheduler()
    if not scheduler._started:
        return

    for run in queued:
        run.status = "running"
        run.started_at = now
        run.attempt += 1
        run.save(update_fields=["status", "started_at", "attempt"])

        asyncio.run_coroutine_threadsafe(
            _execute_run(run.id), scheduler.loop
        )


async def _execute_run(run_id: str):
    """Execute a queued run on the async executor loop."""
    from asgiref.sync import sync_to_async
    from api.models import QueuedRun, TaskResult as DBTaskResult

    try:
        run = await sync_to_async(
            lambda: QueuedRun.objects.select_related("task", "persona").get(id=run_id)
        )()
    except Exception:
        logger.error(f"Run {run_id} not found")
        return

    scheduler = get_scheduler()

    # Convert DB task to circus task
    task = CircusTask(
        name=run.task.name,
        actions=run.task.actions,
        description=run.task.description,
        target_package=run.task.target_package,
        timeout=run.task.timeout,
        retry_count=run.task.retry_count,
        id=run.task.id,
    )

    serial = run.device_serial or None

    try:
        # Ensure pool has devices
        if not scheduler.pool.list_all():
            await scheduler.pool.refresh()

        runner = TaskRunner(scheduler.pool, scheduler.config)
        result = await runner.run(task, serial=serial)

        # Save result to DB
        db_result = await sync_to_async(DBTaskResult.objects.create)(
            task_id=result.task_id,
            task_name=task.name,
            device_serial=result.device_serial,
            success=result.success,
            actions_completed=result.actions_completed,
            actions_total=result.actions_total,
            duration=round(result.duration, 2),
            error=result.error,
            screenshot_count=len(result.screenshots),
            extraction_data=result.extraction_data,
        )

        # Update run status
        if result.success:
            await sync_to_async(_update_run)(
                run_id, "completed", result.error, db_result.id
            )
            logger.info(f"Run {run_id}: completed successfully")
        else:
            await _handle_failure(run_id, run, result.error or "Task failed", db_result.id)

    except Exception as e:
        logger.error(f"Run {run_id}: execution error: {e}")
        await _handle_failure(run_id, run, str(e))


async def _handle_failure(run_id: str, run, error: str, result_id=None):
    """Handle a failed run — retry with backoff or mark as failed."""
    from asgiref.sync import sync_to_async

    if run.attempt < run.max_retries:
        # Retry with exponential backoff
        delay = timedelta(seconds=30 * (2 ** run.attempt))
        retry_at = timezone.now() + delay
        await sync_to_async(_retry_run)(run_id, error, retry_at)
        logger.info(
            f"Run {run_id}: failed (attempt {run.attempt}/{run.max_retries}), "
            f"retrying in {delay.total_seconds()}s"
        )
    else:
        await sync_to_async(_update_run)(run_id, "failed", error, result_id)
        logger.info(f"Run {run_id}: failed permanently after {run.attempt} attempts")


def _update_run(run_id: str, status: str, error: str | None = None, result_id=None):
    """Update a QueuedRun's status (called from sync context)."""
    from api.models import QueuedRun, TaskResult

    updates = {"status": status, "completed_at": timezone.now()}
    if error:
        updates["error"] = error
    if result_id:
        try:
            updates["result"] = TaskResult.objects.get(id=result_id)
        except TaskResult.DoesNotExist:
            pass
    QueuedRun.objects.filter(id=run_id).update(**updates)


def _retry_run(run_id: str, error: str, retry_at):
    """Reset a QueuedRun to queued for retry with backoff."""
    from api.models import QueuedRun

    QueuedRun.objects.filter(id=run_id).update(
        status="queued",
        error=error,
        queued_at=retry_at,
        started_at=None,
    )
