from __future__ import annotations

import logging
import random
import time
from dataclasses import dataclass, field
from typing import Any

import json
import re as _re

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
    if "screen_is" in condition:
        hierarchy = driver.dump_hierarchy()
        result = _detect_screen_from_hierarchy(hierarchy)
        target = condition["screen_is"]
        return target in result["screens"]
    if "screen_not" in condition:
        hierarchy = driver.dump_hierarchy()
        result = _detect_screen_from_hierarchy(hierarchy)
        target = condition["screen_not"]
        return target not in result["screens"]
    if "text_on_screen" in condition:
        hierarchy = driver.dump_hierarchy()
        target = condition["text_on_screen"]
        return target in hierarchy
    return False


def execute_actions(
    driver: AutomationDriver, actions: list[dict], depth: int
) -> ActionResult:
    """Execute a list of actions sequentially, used by control flow handlers.

    Collects data from all inner results into a list on the final ActionResult.
    """
    collected: list = []
    for action in actions:
        result = execute_action(driver, action, depth=depth + 1)
        if not result.success:
            return result
        if result.data is not None:
            if isinstance(result.data, list):
                collected.extend(result.data)
            else:
                collected.append(result.data)
    return ActionResult(success=True, data=collected if collected else None)


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
        elif action_type == "open_url":
            driver.open_url(action["url"], package=action.get("package"))
        elif action_type == "detect_screen":
            return _handle_detect_screen(driver, action)
        elif action_type == "vision":
            return _handle_vision(driver, action)
        elif action_type == "vision_tap":
            return _handle_vision_tap(driver, action)
        elif action_type == "extract_elements":
            return _handle_extract_elements(driver, action)
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
    collected: list = []
    for _ in range(int(action["count"])):
        result = execute_actions(driver, action["actions"], depth)
        if not result.success:
            return result
        if result.data is not None:
            if isinstance(result.data, list):
                collected.extend(result.data)
            else:
                collected.append(result.data)
    return ActionResult(success=True, data=collected if collected else None)


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
    selector: dict[str, Any] = {}
    if "text" in action:
        selector["text"] = action["text"]
    if "resource_id" in action:
        selector["resourceId"] = action["resource_id"]
    if selector:
        el = driver.wait_element(timeout=timeout, **selector)
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


# -- Screen detection via UI hierarchy --

# Instagram screen signatures: resource IDs and text patterns that identify each screen
_SCREEN_SIGNATURES: dict[str, list[dict]] = {
    "instagram_profile": [
        {"resource_id": "com.instagram.android:id/profile_tab_icon_view"},
    ],
    "instagram_followers": [
        {"text_pattern": r"^\d[\d,.]*\s+followers$"},
        {"text": "Followers"},
    ],
    "instagram_following": [
        {"text": "Following"},
    ],
    "instagram_comments": [
        {"resource_id": "com.instagram.android:id/layout_comment_thread_edittext"},
    ],
    "instagram_post": [
        {"resource_id": "com.instagram.android:id/row_feed_comment_textview_layout"},
    ],
    "instagram_feed": [
        {"resource_id": "com.instagram.android:id/feed_tab_icon_view"},
    ],
    "instagram_login": [
        {"text": "Log in"},
        {"text": "Log In"},
    ],
    "browser_chooser": [
        {"text": "Open with"},
        {"text": "Just once"},
        {"resource_id": "android:id/resolver_list"},
    ],
}


def _detect_screen_from_hierarchy(hierarchy: str) -> dict:
    """Analyze UI hierarchy XML to determine the current screen."""
    detected: list[str] = []
    texts: list[str] = []
    resource_ids: list[str] = []

    # Extract all text and resource-id attributes from XML
    for match in _re.finditer(r'text="([^"]*)"', hierarchy):
        t = match.group(1).strip()
        if t:
            texts.append(t)
    for match in _re.finditer(r'resource-id="([^"]*)"', hierarchy):
        r = match.group(1).strip()
        if r:
            resource_ids.append(r)

    # Match against signatures
    for screen_name, signatures in _SCREEN_SIGNATURES.items():
        for sig in signatures:
            if "text" in sig and sig["text"] in texts:
                detected.append(screen_name)
                break
            if "resource_id" in sig and sig["resource_id"] in resource_ids:
                detected.append(screen_name)
                break
            if "text_pattern" in sig:
                pattern = sig["text_pattern"]
                if any(_re.search(pattern, t, _re.IGNORECASE) for t in texts):
                    detected.append(screen_name)
                    break

    # Get the current package
    package = ""
    pkg_match = _re.search(r'package="([^"]*)"', hierarchy)
    if pkg_match:
        package = pkg_match.group(1)

    return {
        "screens": detected,
        "screen": detected[0] if detected else "unknown",
        "package": package,
        "text_count": len(texts),
        "texts_sample": texts[:20],
    }


def _handle_detect_screen(driver: AutomationDriver, action: dict) -> ActionResult:
    """Detect the current screen using UI hierarchy analysis (instant, no LLM)."""
    hierarchy = driver.dump_hierarchy()
    result = _detect_screen_from_hierarchy(hierarchy)
    logger.info("Screen detected: %s (package: %s)", result["screen"], result["package"])
    return ActionResult(success=True, data=result)


def _handle_extract_elements(driver: AutomationDriver, action: dict) -> ActionResult:
    """Extract text from all UI elements matching a selector.

    Returns a dict with a "texts" list containing the text of each matching element.
    Useful for scraping visible text from RecyclerViews, comment lists, etc.

    YAML example:
        action: extract_elements
        resource_id: com.instagram.android:id/row_comment_textview_comment
        key: comments          # optional, defaults to "texts"
        timeout: 5             # optional, how long to wait for first element
    """
    selector: dict[str, Any] = {}
    if "resource_id" in action:
        selector["resourceId"] = action["resource_id"]
    if "text" in action:
        selector["text"] = action["text"]
    if "class_name" in action:
        selector["className"] = action["class_name"]

    if not selector:
        return ActionResult(success=False, error="extract_elements: no selector provided")

    timeout = action.get("timeout", 5)
    key = action.get("key", "texts")

    # Wait briefly for at least one element to appear
    el = driver.find_element(**selector)
    if el is None:
        # No elements found — not an error, just empty
        logger.info("extract_elements: no elements found for %s", selector)
        return ActionResult(success=True, data={key: []})

    # Get all matching elements
    elements = driver.find_elements(**selector)
    texts = []
    for el in elements:
        try:
            info = el.info
            text = info.get("text", "")
            if text and text.strip():
                texts.append(text.strip())
        except Exception:
            continue

    logger.info("extract_elements: found %d texts for %s", len(texts), selector)
    return ActionResult(success=True, data={key: texts})


def _handle_vision_tap(driver: AutomationDriver, action: dict) -> ActionResult:
    """Use vision LLM to locate an element on screen and tap it.

    The LLM is asked to return pixel coordinates for the target.
    The driver then taps those coordinates.
    """
    from circus.llm.providers import call_vision_llm

    img = driver.screenshot()
    w, h = img.size
    user_prompt = action.get("prompt", "Find the element to tap.")
    max_tokens = action.get("max_tokens", 300)

    coordinate_prompt = (
        f"The screen is {w}x{h} pixels. "
        f"{user_prompt}\n\n"
        "Return ONLY a JSON object with the pixel coordinates to tap: "
        '{"x": <number>, "y": <number>}\n'
        "No explanation, no markdown — just the JSON."
    )

    text = call_vision_llm("vision", img, coordinate_prompt, max_tokens)
    if text is None:
        return ActionResult(success=False, error="Vision LLM returned no response for vision_tap")

    # Parse coordinates
    try:
        # Strip markdown if present
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        coords = json.loads(cleaned)
        x, y = int(coords["x"]), int(coords["y"])
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
        return ActionResult(success=False, error=f"vision_tap: failed to parse coordinates from LLM: {text[:200]}")

    logger.info("vision_tap: tapping at (%d, %d) on %dx%d screen", x, y, w, h)
    driver.tap(x, y)
    return ActionResult(success=True, data={"tapped": {"x": x, "y": y}})


def _handle_vision(driver: AutomationDriver, action: dict) -> ActionResult:
    """Screenshot the screen and send to a vision LLM for extraction."""
    from circus.llm.providers import call_vision_llm

    img = driver.screenshot()
    prompt = action.get("prompt", "Describe what you see on screen.")
    max_tokens = action.get("max_tokens", 500)

    text = call_vision_llm("vision", img, prompt, max_tokens)
    if text is None:
        return ActionResult(success=False, error="Vision LLM returned no response")

    # Try to parse JSON from the response
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON from markdown code block
        stripped = text.strip()
        if stripped.startswith("```"):
            lines = stripped.split("\n")
            json_lines = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
            try:
                parsed = json.loads("\n".join(json_lines))
            except json.JSONDecodeError:
                parsed = {"raw_text": text}
        else:
            parsed = {"raw_text": text}

    return ActionResult(success=True, data=parsed)
