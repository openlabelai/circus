import asyncio
from unittest.mock import MagicMock, patch

import pytest

from circus.automation.actions import ActionResult, execute_action
from circus.config import Config
from circus.device.models import DeviceStatus
from circus.device.pool import DevicePool
from circus.tasks.models import Task
from circus.tasks.runner import TaskRunner


def _mock_discover():
    return ["TEST001"]


def _mock_props(serial):
    return {
        "model": "TestPhone",
        "brand": "Test",
        "android_version": "14",
        "sdk_version": 34,
    }


@pytest.fixture
def pool():
    p = DevicePool()
    with (
        patch("circus.device.pool.discover_devices", return_value=_mock_discover()),
        patch("circus.device.pool.get_device_properties", side_effect=_mock_props),
    ):
        asyncio.run(p.refresh())
    return p


@pytest.fixture
def simple_task():
    return Task(
        name="test_task",
        actions=[
            {"action": "sleep", "duration": 0.01},
            {"action": "sleep", "duration": 0.01},
        ],
        timeout=10.0,
    )


class TestTaskModel:
    def test_from_yaml(self, tmp_path):
        yaml_content = """
name: test
description: A test task
target_package: com.test
timeout: 30
actions:
  - action: sleep
    duration: 1.0
  - action: tap
    x: 100
    y: 200
"""
        task_file = tmp_path / "test.yaml"
        task_file.write_text(yaml_content)

        task = Task.from_yaml(str(task_file))
        assert task.name == "test"
        assert task.description == "A test task"
        assert task.target_package == "com.test"
        assert task.timeout == 30
        assert len(task.actions) == 2


class TestExecuteAction:
    def test_sleep_action(self):
        driver = MagicMock()
        result = execute_action(driver, {"action": "sleep", "duration": 0.01})
        assert result.success

    def test_unknown_action(self):
        driver = MagicMock()
        result = execute_action(driver, {"action": "unknown_action"})
        assert not result.success
        assert "Unknown action" in result.error

    def test_tap_by_coords(self):
        driver = MagicMock()
        result = execute_action(driver, {"action": "tap", "x": 100, "y": 200})
        assert result.success
        driver.tap.assert_called_once_with(100, 200)

    def test_tap_by_text(self):
        driver = MagicMock()
        mock_el = MagicMock()
        driver.wait_element.return_value = mock_el

        result = execute_action(driver, {"action": "tap", "text": "Login"})
        assert result.success
        driver.wait_element.assert_called_once()
        mock_el.click.assert_called_once()

    def test_swipe_direction(self):
        driver = MagicMock()
        driver.get_screen_size.return_value = (1080, 2400)

        result = execute_action(driver, {"action": "swipe", "direction": "up"})
        assert result.success
        driver.swipe.assert_called_once()

    def test_app_start(self):
        driver = MagicMock()
        result = execute_action(
            driver, {"action": "app_start", "package": "com.test"}
        )
        assert result.success
        driver.app_start.assert_called_once_with("com.test", None)

    def test_press_key(self):
        driver = MagicMock()
        result = execute_action(driver, {"action": "press", "key": "back"})
        assert result.success
        driver.press_key.assert_called_once_with("back")

    def test_screenshot(self):
        driver = MagicMock()
        fake_img = MagicMock()
        driver.screenshot.return_value = fake_img

        result = execute_action(driver, {"action": "screenshot"})
        assert result.success
        assert result.data is fake_img


class TestTaskRunner:
    def test_run_simple_task(self, pool, simple_task):
        config = Config(action_delay=0)

        with patch("circus.tasks.runner.U2Driver") as MockDriver:
            mock_driver = MagicMock()
            MockDriver.return_value = mock_driver

            runner = TaskRunner(pool, config)
            result = asyncio.run(runner.run(simple_task))

            assert result.success
            assert result.actions_completed == 2
            mock_driver.connect.assert_called_once_with("TEST001")

    def test_device_released_after_task(self, pool, simple_task):
        config = Config(action_delay=0)

        with patch("circus.tasks.runner.U2Driver") as MockDriver:
            MockDriver.return_value = MagicMock()

            runner = TaskRunner(pool, config)
            asyncio.run(runner.run(simple_task))

            dev = pool.get("TEST001")
            assert dev.status == DeviceStatus.AVAILABLE

    def test_device_released_on_error(self, pool):
        task = Task(
            name="failing_task",
            actions=[{"action": "unknown_bad_action"}],
            timeout=10.0,
        )
        config = Config(action_delay=0)

        with patch("circus.tasks.runner.U2Driver") as MockDriver:
            MockDriver.return_value = MagicMock()

            runner = TaskRunner(pool, config)
            result = asyncio.run(runner.run(task))

            assert not result.success
            dev = pool.get("TEST001")
            assert dev.status == DeviceStatus.AVAILABLE
