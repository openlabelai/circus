from abc import ABC, abstractmethod
from typing import Any

from PIL import Image


class AutomationDriver(ABC):
    """Abstract interface for device automation.

    All concrete drivers (U2, Accessibility, Vision) implement this.
    """

    @abstractmethod
    def connect(self, serial: str) -> None: ...

    @abstractmethod
    def disconnect(self) -> None: ...

    @abstractmethod
    def tap(self, x: int | float, y: int | float) -> None: ...

    @abstractmethod
    def long_press(
        self, x: int | float, y: int | float, duration: float = 1.0
    ) -> None: ...

    @abstractmethod
    def swipe(
        self,
        sx: float,
        sy: float,
        ex: float,
        ey: float,
        duration: float = 0.5,
    ) -> None: ...

    @abstractmethod
    def type_text(self, text: str) -> None: ...

    @abstractmethod
    def press_key(self, key: str) -> None: ...

    @abstractmethod
    def screenshot(self) -> Image.Image: ...

    @abstractmethod
    def app_start(self, package: str, activity: str | None = None) -> None: ...

    @abstractmethod
    def app_stop(self, package: str) -> None: ...

    @abstractmethod
    def find_element(self, **selector: Any) -> Any: ...

    @abstractmethod
    def wait_element(self, timeout: float = 10.0, **selector: Any) -> Any: ...

    @abstractmethod
    def element_exists(self, **selector: Any) -> bool: ...

    @abstractmethod
    def get_screen_size(self) -> tuple[int, int]: ...

    @abstractmethod
    def get_current_package(self) -> str | None: ...
