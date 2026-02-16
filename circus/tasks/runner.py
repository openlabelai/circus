from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

from PIL import Image

from circus.automation.actions import execute_action
from circus.automation.u2driver import U2Driver
from circus.config import Config
from circus.device.models import Device
from circus.device.pool import DevicePool
from circus.exceptions import TaskError, TaskTimeoutError
from circus.persona.storage import PersonaStore
from circus.persona.templates import substitute_persona_vars, substitute_task_vars
from circus.tasks.models import Task

logger = logging.getLogger(__name__)


@dataclass
class TaskResult:
    task_id: str
    device_serial: str
    success: bool
    actions_completed: int
    actions_total: int
    duration: float
    error: str | None = None
    screenshots: list[Image.Image] = field(default_factory=list)
    extraction_data: list[dict] = field(default_factory=list)


class TaskRunner:
    def __init__(self, pool: DevicePool, config: Config | None = None) -> None:
        self.pool = pool
        self.config = config or Config()
        self.persona_store = PersonaStore(self.config.persona_dir)

    async def run(self, task: Task, serial: str | None = None) -> TaskResult:
        """Run a task on a device. Acquires from pool, executes, releases."""
        device = await self.pool.acquire(serial, task_id=task.id)

        driver = U2Driver()
        start = time.time()
        actions_completed = 0
        screenshots: list[Image.Image] = []
        extraction_data: list[dict] = []

        try:
            await asyncio.to_thread(driver.connect, device.serial)
            logger.info("Running task '%s' on %s", task.name, device.serial)

            # Resolve persona for this device (if assigned)
            persona = self.persona_store.get_persona_for_device(device.serial)
            if persona:
                logger.info("Using persona '%s' (%s)", persona.name, persona.id)

            for i, action_def in enumerate(task.actions):
                elapsed = time.time() - start
                if elapsed > task.timeout:
                    raise TaskTimeoutError(
                        f"Task timed out after {elapsed:.1f}s"
                    )

                # Substitute persona template variables
                resolved_action = action_def
                if persona is not None:
                    resolved_action = substitute_persona_vars(action_def, persona)

                # Substitute task variables
                if task.variables:
                    resolved_action = substitute_task_vars(resolved_action, task.variables)

                logger.debug(
                    "  Action %d/%d: %s",
                    i + 1,
                    len(task.actions),
                    resolved_action.get("action"),
                )
                result = await asyncio.to_thread(
                    execute_action, driver, resolved_action
                )

                if not result.success:
                    raise TaskError(f"Action {i + 1} failed: {result.error}")

                if result.data and action_def.get("action") == "screenshot":
                    screenshots.append(result.data)

                # Accumulate extraction data from vision actions
                # (including data bubbled up from nested control flow)
                if result.data and action_def.get("action") != "screenshot":
                    if isinstance(result.data, list):
                        extraction_data.extend(result.data)
                    elif isinstance(result.data, dict):
                        extraction_data.append(result.data)

                actions_completed += 1

                if self.config.action_delay > 0:
                    await asyncio.sleep(self.config.action_delay)

            return TaskResult(
                task_id=task.id,
                device_serial=device.serial,
                success=True,
                actions_completed=actions_completed,
                actions_total=len(task.actions),
                duration=time.time() - start,
                screenshots=screenshots,
                extraction_data=extraction_data,
            )

        except Exception as e:
            device.mark_error(str(e))
            return TaskResult(
                task_id=task.id,
                device_serial=device.serial,
                success=False,
                actions_completed=actions_completed,
                actions_total=len(task.actions),
                duration=time.time() - start,
                error=str(e),
            )

        finally:
            await asyncio.to_thread(driver.disconnect)
            await self.pool.release(device.serial)
