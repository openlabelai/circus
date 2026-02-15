import adbutils


def discover_devices() -> list[str]:
    """Return serial numbers of all connected ADB devices."""
    client = adbutils.AdbClient()
    devices = client.device_list()
    return [d.serial for d in devices]


def get_device_properties(serial: str) -> dict:
    """Fetch device model, brand, android version via ADB."""
    client = adbutils.AdbClient()
    d = client.device(serial=serial)
    return {
        "model": d.prop.get("ro.product.model", ""),
        "brand": d.prop.get("ro.product.brand", ""),
        "android_version": d.prop.get("ro.build.version.release", ""),
        "sdk_version": int(d.prop.get("ro.build.version.sdk", "0") or "0"),
    }
