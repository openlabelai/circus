import os

import adbutils

_ADB_HOST = os.getenv("ANDROID_ADB_SERVER_HOST", "127.0.0.1")
_ADB_PORT = int(os.getenv("ANDROID_ADB_SERVER_PORT", "5037"))


def _client() -> adbutils.AdbClient:
    return adbutils.AdbClient(host=_ADB_HOST, port=_ADB_PORT)


def discover_devices() -> list[str]:
    """Return serial numbers of all connected ADB devices."""
    devices = _client().device_list()
    return [d.serial for d in devices]


def get_device_properties(serial: str) -> dict:
    """Fetch device model, brand, android version via ADB."""
    d = _client().device(serial=serial)
    return {
        "model": d.prop.get("ro.product.model", ""),
        "brand": d.prop.get("ro.product.brand", ""),
        "android_version": d.prop.get("ro.build.version.release", ""),
        "sdk_version": int(d.prop.get("ro.build.version.sdk", "0") or "0"),
    }
