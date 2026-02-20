from __future__ import annotations

import asyncio
import time
from typing import Callable

from circus.device.models import Device, DeviceInfo, DeviceStatus
from circus.device.discovery import discover_devices, get_device_properties
from circus.exceptions import DeviceBusyError, DeviceNotFoundError

# Callback signature: (event: "added"|"removed", serial: str) -> None
OnChangeCallback = Callable[[str, str], None]
# Sync callback: (devices: list[Device]) -> None
OnSyncCallback = Callable[[list[Device]], None]


class DevicePool:
    def __init__(self, on_change: OnChangeCallback | None = None, on_sync: OnSyncCallback | None = None):
        self._devices: dict[str, Device] = {}
        self._lock: asyncio.Lock | None = None
        self._on_change = on_change
        self._on_sync = on_sync

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def refresh(self) -> list[Device]:
        """Scan ADB for devices. Add new ones, mark missing ones offline."""
        serials = await asyncio.to_thread(discover_devices)

        added: list[str] = []
        removed: list[str] = []

        async with self._get_lock():
            # Mark disappeared devices offline
            for serial, dev in self._devices.items():
                if serial not in serials and dev.status != DeviceStatus.OFFLINE:
                    dev.status = DeviceStatus.OFFLINE
                    removed.append(serial)

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
                    added.append(serial)
                else:
                    dev = self._devices[serial]
                    dev.last_seen = time.time()
                    if dev.status == DeviceStatus.OFFLINE:
                        dev.status = DeviceStatus.AVAILABLE
                        added.append(serial)

        # Fire callbacks outside lock
        if self._on_change:
            for serial in added:
                self._on_change("added", serial)
            for serial in removed:
                self._on_change("removed", serial)

        # Fire sync callback with all devices
        if self._on_sync:
            self._on_sync(list(self._devices.values()))

        return list(self._devices.values())

    async def acquire(self, serial: str | None = None, task_id: str | None = None) -> Device:
        """Acquire a device for task execution.

        If serial is given, acquire that specific device.
        Otherwise, pick any available device.
        If task_id is provided, atomically mark the device busy under the lock.
        """
        async with self._get_lock():
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
        async with self._get_lock():
            dev = self._devices.get(serial)
            if dev:
                dev.mark_available()

    def list_all(self) -> list[Device]:
        return list(self._devices.values())

    def get(self, serial: str) -> Device | None:
        return self._devices.get(serial)
