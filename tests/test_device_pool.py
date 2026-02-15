import asyncio
from unittest.mock import patch

import pytest

from circus.device.models import Device, DeviceStatus
from circus.device.pool import DevicePool
from circus.exceptions import DeviceBusyError, DeviceNotFoundError


@pytest.fixture
def pool():
    return DevicePool()


def _mock_discover():
    return ["ABC123", "DEF456"]


def _mock_props(serial):
    return {
        "model": f"Phone-{serial[:3]}",
        "brand": "TestBrand",
        "android_version": "14",
        "sdk_version": 34,
    }


class TestDevicePool:
    def test_refresh_discovers_devices(self, pool):
        with (
            patch("circus.device.pool.discover_devices", return_value=_mock_discover()),
            patch("circus.device.pool.get_device_properties", side_effect=_mock_props),
        ):
            devs = asyncio.run(pool.refresh())
            assert len(devs) == 2
            assert all(d.status == DeviceStatus.AVAILABLE for d in devs)

    def test_acquire_specific_device(self, pool):
        with (
            patch("circus.device.pool.discover_devices", return_value=_mock_discover()),
            patch("circus.device.pool.get_device_properties", side_effect=_mock_props),
        ):
            asyncio.run(pool.refresh())
            dev = asyncio.run(pool.acquire("ABC123"))
            assert dev.serial == "ABC123"

    def test_acquire_any_device(self, pool):
        with (
            patch("circus.device.pool.discover_devices", return_value=_mock_discover()),
            patch("circus.device.pool.get_device_properties", side_effect=_mock_props),
        ):
            asyncio.run(pool.refresh())
            dev = asyncio.run(pool.acquire())
            assert dev.serial in ("ABC123", "DEF456")

    def test_acquire_nonexistent_raises(self, pool):
        with pytest.raises(DeviceNotFoundError):
            asyncio.run(pool.acquire("MISSING"))

    def test_acquire_busy_device_raises(self, pool):
        with (
            patch("circus.device.pool.discover_devices", return_value=_mock_discover()),
            patch("circus.device.pool.get_device_properties", side_effect=_mock_props),
        ):
            asyncio.run(pool.refresh())
            dev = asyncio.run(pool.acquire("ABC123"))
            dev.mark_busy("task-1")
            with pytest.raises(DeviceBusyError):
                asyncio.run(pool.acquire("ABC123"))

    def test_release_makes_device_available(self, pool):
        with (
            patch("circus.device.pool.discover_devices", return_value=_mock_discover()),
            patch("circus.device.pool.get_device_properties", side_effect=_mock_props),
        ):
            asyncio.run(pool.refresh())
            dev = asyncio.run(pool.acquire("ABC123"))
            dev.mark_busy("task-1")
            asyncio.run(pool.release("ABC123"))
            assert dev.status == DeviceStatus.AVAILABLE

    def test_refresh_marks_missing_devices_offline(self, pool):
        with (
            patch("circus.device.pool.discover_devices", return_value=_mock_discover()),
            patch("circus.device.pool.get_device_properties", side_effect=_mock_props),
        ):
            asyncio.run(pool.refresh())

        # Second refresh with only one device
        with (
            patch("circus.device.pool.discover_devices", return_value=["ABC123"]),
            patch("circus.device.pool.get_device_properties", side_effect=_mock_props),
        ):
            asyncio.run(pool.refresh())
            dev = pool.get("DEF456")
            assert dev is not None
            assert dev.status == DeviceStatus.OFFLINE

    def test_no_available_devices_raises(self, pool):
        with pytest.raises(DeviceNotFoundError, match="No available"):
            asyncio.run(pool.acquire())
