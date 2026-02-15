import time
from dataclasses import dataclass, field
from typing import Any

from circus.automation.base import AutomationDriver


@dataclass
class ActionResult:
    success: bool
    data: Any = None
    error: str | None = None


# Normalized swipe directions → (start_x%, start_y%, end_x%, end_y%)
_SWIPE_DIRECTIONS: dict[str, tuple[float, float, float, float]] = {
    "up": (0.5, 0.7, 0.5, 0.3),
    "down": (0.5, 0.3, 0.5, 0.7),
    "left": (0.7, 0.5, 0.3, 0.5),
    "right": (0.3, 0.5, 0.7, 0.5),
}


def execute_action(driver: AutomationDriver, action: dict) -> ActionResult:
    """Execute a single action dict against a driver.

    Action format examples:
        {"action": "tap", "x": 500, "y": 300}
        {"action": "tap", "text": "Login"}
        {"action": "swipe", "direction": "up"}
        {"action": "type", "text": "hello"}
        {"action": "app_start", "package": "com.example.app"}
        {"action": "wait", "text": "Welcome", "timeout": 15}
        {"action": "press", "key": "back"}
        {"action": "screenshot"}
        {"action": "sleep", "duration": 2.0}
    """
    try:
        action_type = action["action"]

        if action_type == "tap":
            _do_tap(driver, action)
        elif action_type == "long_press":
            _do_long_press(driver, action)
        elif action_type == "swipe":
            _do_swipe(driver, action)
        elif action_type == "type":
            _do_type(driver, action)
        elif action_type == "app_start":
            driver.app_start(action["package"], action.get("activity"))
        elif action_type == "app_stop":
            driver.app_stop(action["package"])
        elif action_type == "wait":
            _do_wait(driver, action)
        elif action_type == "press":
            driver.press_key(action["key"])
        elif action_type == "screenshot":
            img = driver.screenshot()
            return ActionResult(success=True, data=img)
        elif action_type == "sleep":
            time.sleep(action.get("duration", 1.0))
        else:
            return ActionResult(success=False, error=f"Unknown action: {action_type}")

        return ActionResult(success=True)

    except Exception as e:
        return ActionResult(success=False, error=str(e))


def _do_tap(driver: AutomationDriver, action: dict) -> None:
    timeout = action.get("timeout", 10)
    if "text" in action:
        el = driver.wait_element(timeout=timeout, text=action["text"])
        el.click()
    elif "resource_id" in action:
        el = driver.wait_element(timeout=timeout, resourceId=action["resource_id"])
        el.click()
    else:
        driver.tap(action["x"], action["y"])


def _do_long_press(driver: AutomationDriver, action: dict) -> None:
    duration = action.get("duration", 1.0)
    if "text" in action:
        el = driver.wait_element(text=action["text"])
        info = el.info
        bounds = info["bounds"]
        cx = (bounds["left"] + bounds["right"]) // 2
        cy = (bounds["top"] + bounds["bottom"]) // 2
        driver.long_press(cx, cy, duration)
    else:
        driver.long_press(action["x"], action["y"], duration)


def _do_swipe(driver: AutomationDriver, action: dict) -> None:
    if "direction" in action:
        direction = action["direction"]
        if direction not in _SWIPE_DIRECTIONS:
            raise ValueError(f"Unknown swipe direction: {direction}")
        sx_pct, sy_pct, ex_pct, ey_pct = _SWIPE_DIRECTIONS[direction]
        w, h = driver.get_screen_size()
        driver.swipe(sx_pct * w, sy_pct * h, ex_pct * w, ey_pct * h)
    else:
        driver.swipe(action["sx"], action["sy"], action["ex"], action["ey"])


def _do_type(driver: AutomationDriver, action: dict) -> None:
    if "into" in action:
        by = action.get("into_by", "text")
        el = driver.wait_element(**{by: action["into"]})
        el.set_text(action["text"])
    else:
        driver.type_text(action["text"])


def _do_wait(driver: AutomationDriver, action: dict) -> None:
    timeout = action.get("timeout", 10)
    selector: dict[str, Any] = {}
    if "text" in action:
        selector["text"] = action["text"]
    if "resource_id" in action:
        selector["resourceId"] = action["resource_id"]
    driver.wait_element(timeout=timeout, **selector)
