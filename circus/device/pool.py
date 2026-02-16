from __future__ import annotations

import asyncio
import time

from circus.device.models import Device, DeviceInfo, DeviceStatus
from circus.device.discovery import discover_devices, get_device_properties
from circus.exceptions import DeviceBusyError, DeviceNotFoundError


class DevicePool:
    def __init__(self):
        self._devices: dict[str, Device] = {}
        self._lock = asyncio.Lock()

    async def refresh(self) -> list[Device]:
        """Scan ADB for devices. Add new ones, mark missing ones offline."""
        serials = await asyncio.to_thread(discover_devices)

        async with self._lock:
            # Mark disappeared devices offline
            for serial, dev in self._devices.items():
                if serial not in serials and dev.status != DeviceStatus.OFFLINE:
                    dev.status = DeviceStatus.OFFLINE

            # Add or re-activate found devices
            for serial in serials:
                if serial not in self._devices:
                    props = await asyncio.to_thread(get_device_properties, serial)
                    info = DeviceInfo(serial=serial, **props)
                    self._devices[serial] = Device(
                        serial=serial,
                        status=DeviceStatus.AVAILABLE,
                        info=info,
                    )
                else:
                    dev = self._devices[serial]
                    dev.last_seen = time.time()
                    if dev.status == DeviceStatus.OFFLINE:
                        dev.status = DeviceStatus.AVAILABLE

        return list(self._devices.values())

    async def acquire(self, serial: str | None = None, task_id: str | None = None) -> Device:
        """Acquire a device for task execution.

        If serial is given, acquire that specific device.
        Otherwise, pick any available device.
        If task_id is provided, atomically mark the device busy under the lock.
        """
        async with self._lock:
            if serial:
                dev = self._devices.get(serial)
                if not dev:
                    raise DeviceNotFoundError(f"Device not found: {serial}")
                if dev.status != DeviceStatus.AVAILABLE:
                    raise DeviceBusyError(f"Device {serial} is {dev.status.value}")
                if task_id:
                    dev.mark_busy(task_id)
                return dev

            for dev in self._devices.values():
                if dev.status == DeviceStatus.AVAILABLE:
                    if task_id:
                        dev.mark_busy(task_id)
                    return dev

            raise DeviceNotFoundError("No available devices")

    async def release(self, serial: str) -> None:
        """Release a device back to the pool."""
        async with self._lock:
            dev = self._devices.get(serial)
            if dev:
                dev.mark_available()

    def list_all(self) -> list[Device]:
        return list(self._devices.values())

    def get(self, serial: str) -> Device | None:
        return self._devices.get(serial)
