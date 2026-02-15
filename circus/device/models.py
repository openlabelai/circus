from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import time


class DeviceStatus(Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    ERROR = "error"
    OFFLINE = "offline"


@dataclass
class DeviceInfo:
    serial: str
    model: str = ""
    brand: str = ""
    android_version: str = ""
    sdk_version: int = 0
    screen_width: int = 0
    screen_height: int = 0


@dataclass
class Device:
    serial: str
    status: DeviceStatus = DeviceStatus.OFFLINE
    info: Optional[DeviceInfo] = None
    current_task: Optional[str] = None
    last_seen: float = field(default_factory=time.time)
    error_message: Optional[str] = None

    def mark_busy(self, task_id: str) -> None:
        self.status = DeviceStatus.BUSY
        self.current_task = task_id
        self.error_message = None

    def mark_available(self) -> None:
        self.status = DeviceStatus.AVAILABLE
        self.current_task = None
        self.error_message = None

    def mark_error(self, msg: str) -> None:
        self.status = DeviceStatus.ERROR
        self.current_task = None
        self.error_message = msg
