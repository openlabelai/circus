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


class TaskRunner:
    def __init__(self, pool: DevicePool, config: Config | None = None) -> None:
        self.pool = pool
        self.config = config or Config()

    async def run(self, task: Task, serial: str | None = None) -> TaskResult:
        """Run a task on a device. Acquires from pool, executes, releases."""
        device = await self.pool.acquire(serial)
        device.mark_busy(task.id)

        driver = U2Driver()
        start = time.time()
        actions_completed = 0
        screenshots: list[Image.Image] = []

        try:
            await asyncio.to_thread(driver.connect, device.serial)
            logger.info("Running task '%s' on %s", task.name, device.serial)

            for i, action_def in enumerate(task.actions):
                elapsed = time.time() - start
                if elapsed > task.timeout:
                    raise TaskTimeoutError(
                        f"Task timed out after {elapsed:.1f}s"
                    )

                logger.debug(
                    "  Action %d/%d: %s",
                    i + 1,
                    len(task.actions),
                    action_def.get("action"),
                )
                result = await asyncio.to_thread(execute_action, driver, action_def)

                if not result.success:
                    raise TaskError(f"Action {i + 1} failed: {result.error}")

                if result.data and action_def.get("action") == "screenshot":
                    screenshots.append(result.data)

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
