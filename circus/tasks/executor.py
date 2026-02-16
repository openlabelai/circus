from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field

from circus.config import Config
from circus.device.pool import DevicePool
from circus.tasks.models import Task
from circus.tasks.results import ResultStore
from circus.tasks.runner import TaskResult, TaskRunner

logger = logging.getLogger(__name__)


@dataclass
class ExecutionSummary:
    total_devices: int
    successful: int
    failed: int
    results: list[TaskResult]
    duration: float


class ParallelExecutor:
    def __init__(
        self,
        pool: DevicePool,
        config: Config | None = None,
        store_results: bool = True,
    ) -> None:
        self.pool = pool
        self.config = config or Config()
        self.store_results = store_results
        self._store = ResultStore(self.config.results_dir) if store_results else None

    async def run_on_all(
        self,
        task: Task,
        device_filter: list[str] | None = None,
    ) -> ExecutionSummary:
        """Run a task on all available devices in parallel."""
        await self.pool.refresh()
        devices = [
            d for d in self.pool.list_all()
            if d.status.value == "available"
        ]

        if device_filter:
            devices = [d for d in devices if d.serial in device_filter]

        if not devices:
            return ExecutionSummary(
                total_devices=0, successful=0, failed=0, results=[], duration=0.0
            )

        runner = TaskRunner(self.pool, self.config)
        start = time.time()

        async def _run_one(serial: str) -> TaskResult:
            # Clone task with unique ID per device
            device_task = Task(
                name=task.name,
                actions=task.actions,
                description=task.description,
                target_package=task.target_package,
                timeout=task.timeout,
                retry_count=task.retry_count,
                id=uuid.uuid4().hex[:8],
            )
            return await runner.run(device_task, serial=serial)

        results = await asyncio.gather(
            *[_run_one(d.serial) for d in devices],
            return_exceptions=True,
        )

        task_results: list[TaskResult] = []
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                tr = TaskResult(
                    task_id=task.id,
                    device_serial=devices[i].serial,
                    success=False,
                    actions_completed=0,
                    actions_total=len(task.actions),
                    duration=time.time() - start,
                    error=str(r),
                )
                task_results.append(tr)
            else:
                task_results.append(r)

        if self._store:
            for tr in task_results:
                self._store.save(tr)

        successful = sum(1 for r in task_results if r.success)
        return ExecutionSummary(
            total_devices=len(task_results),
            successful=successful,
            failed=len(task_results) - successful,
            results=task_results,
            duration=time.time() - start,
        )
