from __future__ import annotations

import logging
import random
import time
from dataclasses import dataclass, field
from typing import Any

from circus.automation.base import AutomationDriver

logger = logging.getLogger(__name__)

MAX_NESTING_DEPTH = 20


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


def evaluate_condition(driver: AutomationDriver, condition: dict) -> bool:
    """Evaluate a condition dict against the driver."""
    if "element_exists" in condition:
        return driver.element_exists(**condition["element_exists"])
    if "element_not_exists" in condition:
        return not driver.element_exists(**condition["element_not_exists"])
    if "app_running" in condition:
        current = driver.get_current_package()
        return current == condition["app_running"].get("package")
    return False


def execute_actions(
    driver: AutomationDriver, actions: list[dict], depth: int
) -> ActionResult:
    """Execute a list of actions sequentially, used by control flow handlers."""
    for action in actions:
        result = execute_action(driver, action, depth=depth + 1)
        if not result.success:
            return result
    return ActionResult(success=True)


def execute_action(
    driver: AutomationDriver, action: dict, depth: int = 0
) -> ActionResult:
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

    Control flow actions:
        {"action": "if", "condition": {...}, "then": [...], "else": [...]}
        {"action": "repeat", "count": N, "actions": [...]}
        {"action": "while", "condition": {...}, "actions": [...], "max_iterations": N}
        {"action": "try", "actions": [...], "on_error": [...]}
    """
    if depth > MAX_NESTING_DEPTH:
        return ActionResult(
            success=False, error=f"Max nesting depth ({MAX_NESTING_DEPTH}) exceeded"
        )

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
        elif action_type == "if":
            return _handle_if(driver, action, depth)
        elif action_type == "repeat":
            return _handle_repeat(driver, action, depth)
        elif action_type == "while":
            return _handle_while(driver, action, depth)
        elif action_type == "try":
            return _handle_try(driver, action, depth)
        elif action_type == "assert":
            return _handle_assert(driver, action)
        elif action_type == "wait_gone":
            _do_wait_gone(driver, action)
        elif action_type == "clear":
            _do_clear(driver, action)
        elif action_type == "random_sleep":
            time.sleep(random.uniform(action.get("min", 0.5), action.get("max", 2.0)))
        else:
            return ActionResult(success=False, error=f"Unknown action: {action_type}")

        return ActionResult(success=True)

    except Exception as e:
        return ActionResult(success=False, error=str(e))


# --- Control flow handlers ---


def _handle_if(
    driver: AutomationDriver, action: dict, depth: int
) -> ActionResult:
    if evaluate_condition(driver, action["condition"]):
        return execute_actions(driver, action.get("then", []), depth)
    else:
        return execute_actions(driver, action.get("else", []), depth)


def _handle_repeat(
    driver: AutomationDriver, action: dict, depth: int
) -> ActionResult:
    for _ in range(action["count"]):
        result = execute_actions(driver, action["actions"], depth)
        if not result.success:
            return result
    return ActionResult(success=True)


def _handle_while(
    driver: AutomationDriver, action: dict, depth: int
) -> ActionResult:
    max_iter = action.get("max_iterations", 100)
    for _ in range(max_iter):
        if not evaluate_condition(driver, action["condition"]):
            break
        result = execute_actions(driver, action["actions"], depth)
        if not result.success:
            return result
    return ActionResult(success=True)


def _handle_try(
    driver: AutomationDriver, action: dict, depth: int
) -> ActionResult:
    result = execute_actions(driver, action["actions"], depth)
    if not result.success and "on_error" in action:
        return execute_actions(driver, action["on_error"], depth)
    return result


# --- Primitive action handlers ---


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


def _handle_assert(driver: AutomationDriver, action: dict) -> ActionResult:
    timeout = action.get("timeout", 0)
    message = action.get("message", "Assertion failed")
    condition = action["condition"]

    if timeout > 0:
        deadline = time.time() + timeout
        while time.time() < deadline:
            if evaluate_condition(driver, condition):
                return ActionResult(success=True)
            time.sleep(0.5)
    else:
        if evaluate_condition(driver, condition):
            return ActionResult(success=True)

    return ActionResult(success=False, error=message)


def _do_wait_gone(driver: AutomationDriver, action: dict) -> None:
    timeout = action.get("timeout", 30)
    selector: dict[str, Any] = {}
    if "text" in action:
        selector["text"] = action["text"]
    if "resource_id" in action:
        selector["resourceId"] = action["resource_id"]

    deadline = time.time() + timeout
    while time.time() < deadline:
        if not driver.element_exists(**selector):
            return
        time.sleep(0.5)
    raise TimeoutError(
        f"Element still present after {timeout}s: {selector}"
    )


def _do_clear(driver: AutomationDriver, action: dict) -> None:
    selector: dict[str, Any] = {}
    if "text" in action:
        selector["text"] = action["text"]
    if "resource_id" in action:
        selector["resourceId"] = action["resource_id"]
    driver.clear_text(**selector)
