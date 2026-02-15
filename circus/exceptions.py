class CircusError(Exception):
    """Base exception for Circus."""


class DeviceNotFoundError(CircusError):
    """No device found matching the criteria."""


class DeviceConnectionError(CircusError):
    """Failed to connect to a device."""


class DeviceBusyError(CircusError):
    """Device is already in use."""


class AutomationError(CircusError):
    """Automation action failed."""


class TaskError(CircusError):
    """Task execution failed."""


class TaskTimeoutError(TaskError):
    """Task exceeded its timeout."""
