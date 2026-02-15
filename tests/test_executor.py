import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from circus.config import Config
from circus.device.models import Device, DeviceInfo, DeviceStatus
from circus.device.pool import DevicePool
from circus.tasks.executor import ParallelExecutor
from circus.tasks.models import Task
from circus.tasks.runner import TaskResult


def _make_device(serial: str) -> Device:
    return Device(
        serial=serial,
        status=DeviceStatus.AVAILABLE,
        info=DeviceInfo(serial=serial, model="TestPhone", brand="Test", android_version="14"),
    )


def _make_task() -> Task:
    return Task(
        name="test_task",
        actions=[{"action": "tap", "x": 100, "y": 200}],
    )


def _make_result(serial: str, success: bool = True) -> TaskResult:
    return TaskResult(
        task_id="t1",
        device_serial=serial,
        success=success,
        actions_completed=1 if success else 0,
        actions_total=1,
        duration=1.0,
        error=None if success else "failed",
    )


class TestParallelExecutor:
    def test_run_on_all_three_devices(self, tmp_path):
        """Run a task across 3 mock devices in parallel."""
        pool = DevicePool()
        # Inject devices directly
        pool._devices = {
            s: _make_device(s) for s in ["DEV1", "DEV2", "DEV3"]
        }

        config = Config(results_dir=str(tmp_path))
        executor = ParallelExecutor(pool, config, store_results=True)

        async def _mock_run(task, serial=None):
            return _make_result(serial)

        with (
            patch.object(pool, "refresh", new_callable=AsyncMock),
            patch("circus.tasks.executor.TaskRunner") as MockRunner,
        ):
            runner_instance = MagicMock()
            runner_instance.run = AsyncMock(side_effect=lambda t, serial=None: _make_result(serial))
            MockRunner.return_value = runner_instance

            summary = asyncio.run(executor.run_on_all(_make_task()))

        assert summary.total_devices == 3
        assert summary.successful == 3
        assert summary.failed == 0
        assert len(summary.results) == 3
        serials = {r.device_serial for r in summary.results}
        assert serials == {"DEV1", "DEV2", "DEV3"}

    def test_device_filter(self, tmp_path):
        """Only run on filtered devices."""
        pool = DevicePool()
        pool._devices = {
            s: _make_device(s) for s in ["DEV1", "DEV2", "DEV3"]
        }

        config = Config(results_dir=str(tmp_path))
        executor = ParallelExecutor(pool, config, store_results=False)

        with (
            patch.object(pool, "refresh", new_callable=AsyncMock),
            patch("circus.tasks.executor.TaskRunner") as MockRunner,
        ):
            runner_instance = MagicMock()
            runner_instance.run = AsyncMock(side_effect=lambda t, serial=None: _make_result(serial))
            MockRunner.return_value = runner_instance

            summary = asyncio.run(executor.run_on_all(_make_task(), device_filter=["DEV1", "DEV3"]))

        assert summary.total_devices == 2
        serials = {r.device_serial for r in summary.results}
        assert serials == {"DEV1", "DEV3"}

    def test_result_storage(self, tmp_path):
        """Results are saved to the store when store_results=True."""
        pool = DevicePool()
        pool._devices = {"DEV1": _make_device("DEV1")}

        config = Config(results_dir=str(tmp_path))
        executor = ParallelExecutor(pool, config, store_results=True)

        with (
            patch.object(pool, "refresh", new_callable=AsyncMock),
            patch("circus.tasks.executor.TaskRunner") as MockRunner,
        ):
            runner_instance = MagicMock()
            runner_instance.run = AsyncMock(side_effect=lambda t, serial=None: _make_result(serial))
            MockRunner.return_value = runner_instance

            asyncio.run(executor.run_on_all(_make_task()))

        # Check that a JSONL file was written
        from circus.tasks.results import ResultStore
        store = ResultStore(str(tmp_path))
        records = store.load_today()
        assert len(records) == 1
        assert records[0]["device_serial"] == "DEV1"

    def test_no_devices_returns_empty_summary(self, tmp_path):
        """No devices available returns zero-count summary."""
        pool = DevicePool()
        config = Config(results_dir=str(tmp_path))
        executor = ParallelExecutor(pool, config, store_results=False)

        with patch.object(pool, "refresh", new_callable=AsyncMock):
            summary = asyncio.run(executor.run_on_all(_make_task()))

        assert summary.total_devices == 0
        assert summary.results == []

    def test_exception_handling(self, tmp_path):
        """Exceptions from runner are captured as failed results."""
        pool = DevicePool()
        pool._devices = {"DEV1": _make_device("DEV1")}

        config = Config(results_dir=str(tmp_path))
        executor = ParallelExecutor(pool, config, store_results=False)

        with (
            patch.object(pool, "refresh", new_callable=AsyncMock),
            patch("circus.tasks.executor.TaskRunner") as MockRunner,
        ):
            runner_instance = MagicMock()
            runner_instance.run = AsyncMock(side_effect=RuntimeError("device exploded"))
            MockRunner.return_value = runner_instance

            summary = asyncio.run(executor.run_on_all(_make_task()))

        assert summary.total_devices == 1
        assert summary.failed == 1
        assert summary.results[0].success is False
        assert "device exploded" in summary.results[0].error
