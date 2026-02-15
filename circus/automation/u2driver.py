from typing import Any

import uiautomator2 as u2
from PIL import Image

from circus.automation.base import AutomationDriver
from circus.exceptions import AutomationError


class U2Driver(AutomationDriver):
    """UIAutomator2 automation driver — primary driver for Circus."""

    def __init__(self) -> None:
        self._device: u2.Device | None = None

    @property
    def d(self) -> u2.Device:
        if not self._device:
            raise AutomationError("Not connected to a device")
        return self._device

    def connect(self, serial: str) -> None:
        try:
            self._device = u2.connect(serial)
            self._device.implicitly_wait(10.0)
        except Exception as e:
            raise AutomationError(f"Failed to connect to {serial}: {e}") from e

    def disconnect(self) -> None:
        self._device = None

    def tap(self, x: int | float, y: int | float) -> None:
        self.d.click(int(x), int(y))

    def long_press(
        self, x: int | float, y: int | float, duration: float = 1.0
    ) -> None:
        self.d.long_click(int(x), int(y), duration)

    def swipe(
        self,
        sx: float,
        sy: float,
        ex: float,
        ey: float,
        duration: float = 0.5,
    ) -> None:
        self.d.swipe(int(sx), int(sy), int(ex), int(ey), duration)

    def type_text(self, text: str) -> None:
        self.d.send_keys(text)

    def press_key(self, key: str) -> None:
        self.d.press(key)

    def screenshot(self) -> Image.Image:
        return self.d.screenshot()

    def app_start(self, package: str, activity: str | None = None) -> None:
        self.d.app_start(package, activity=activity, stop=True)

    def app_stop(self, package: str) -> None:
        self.d.app_stop(package)

    def find_element(self, **selector: Any) -> Any:
        el = self.d(**selector)
        if not el.exists:
            return None
        return el

    def wait_element(self, timeout: float = 10.0, **selector: Any) -> Any:
        el = self.d(**selector)
        if el.wait(timeout=timeout):
            return el
        raise AutomationError(f"Element not found within {timeout}s: {selector}")

    def element_exists(self, **selector: Any) -> bool:
        return self.d(**selector).exists

    def get_screen_size(self) -> tuple[int, int]:
        return self.d.window_size()
