from unittest.mock import MagicMock, call, patch

import pytest

from circus.automation.actions import (
    ActionResult,
    evaluate_condition,
    execute_action,
    execute_actions,
    MAX_NESTING_DEPTH,
)


@pytest.fixture
def driver():
    return MagicMock()


# --- evaluate_condition ---


class TestEvaluateCondition:
    def test_element_exists_true(self, driver):
        driver.element_exists.return_value = True
        assert evaluate_condition(driver, {"element_exists": {"text": "Allow"}}) is True
        driver.element_exists.assert_called_once_with(text="Allow")

    def test_element_exists_false(self, driver):
        driver.element_exists.return_value = False
        assert evaluate_condition(driver, {"element_exists": {"text": "Allow"}}) is False

    def test_element_not_exists_true(self, driver):
        driver.element_exists.return_value = False
        assert evaluate_condition(driver, {"element_not_exists": {"text": "Error"}}) is True

    def test_element_not_exists_false(self, driver):
        driver.element_exists.return_value = True
        assert evaluate_condition(driver, {"element_not_exists": {"text": "Error"}}) is False

    def test_app_running_true(self, driver):
        driver.get_current_package.return_value = "com.instagram.android"
        assert evaluate_condition(
            driver, {"app_running": {"package": "com.instagram.android"}}
        ) is True

    def test_app_running_false(self, driver):
        driver.get_current_package.return_value = "com.other.app"
        assert evaluate_condition(
            driver, {"app_running": {"package": "com.instagram.android"}}
        ) is False

    def test_unknown_condition_returns_false(self, driver):
        assert evaluate_condition(driver, {"bogus": True}) is False


# --- if action ---


class TestIfAction:
    def test_if_true_runs_then(self, driver):
        driver.element_exists.return_value = True
        action = {
            "action": "if",
            "condition": {"element_exists": {"text": "Allow"}},
            "then": [{"action": "press", "key": "back"}],
            "else": [{"action": "sleep", "duration": 0.01}],
        }
        result = execute_action(driver, action)
        assert result.success
        driver.press_key.assert_called_once_with("back")

    def test_if_false_runs_else(self, driver):
        driver.element_exists.return_value = False
        action = {
            "action": "if",
            "condition": {"element_exists": {"text": "Allow"}},
            "then": [{"action": "press", "key": "back"}],
            "else": [{"action": "sleep", "duration": 0.01}],
        }
        result = execute_action(driver, action)
        assert result.success
        driver.press_key.assert_not_called()

    def test_if_true_no_then(self, driver):
        driver.element_exists.return_value = True
        action = {
            "action": "if",
            "condition": {"element_exists": {"text": "X"}},
        }
        result = execute_action(driver, action)
        assert result.success

    def test_if_false_no_else(self, driver):
        driver.element_exists.return_value = False
        action = {
            "action": "if",
            "condition": {"element_exists": {"text": "X"}},
            "then": [{"action": "press", "key": "back"}],
        }
        result = execute_action(driver, action)
        assert result.success
        driver.press_key.assert_not_called()


# --- repeat action ---


class TestRepeatAction:
    def test_repeat_runs_n_times(self, driver):
        driver.get_screen_size.return_value = (1080, 2400)
        action = {
            "action": "repeat",
            "count": 3,
            "actions": [{"action": "swipe", "direction": "up"}],
        }
        result = execute_action(driver, action)
        assert result.success
        assert driver.swipe.call_count == 3

    def test_repeat_zero(self, driver):
        action = {
            "action": "repeat",
            "count": 0,
            "actions": [{"action": "press", "key": "back"}],
        }
        result = execute_action(driver, action)
        assert result.success
        driver.press_key.assert_not_called()

    def test_repeat_stops_on_failure(self, driver):
        # First call succeeds, second raises
        driver.press_key.side_effect = [None, Exception("device lost")]
        action = {
            "action": "repeat",
            "count": 3,
            "actions": [{"action": "press", "key": "back"}],
        }
        result = execute_action(driver, action)
        assert not result.success
        assert driver.press_key.call_count == 2


# --- while action ---


class TestWhileAction:
    def test_while_loops_until_condition_false(self, driver):
        # element_exists returns True 3 times, then False
        driver.element_exists.side_effect = [True, True, True, False]
        action = {
            "action": "while",
            "condition": {"element_exists": {"text": "Loading..."}},
            "actions": [{"action": "sleep", "duration": 0.01}],
            "max_iterations": 10,
        }
        result = execute_action(driver, action)
        assert result.success
        assert driver.element_exists.call_count == 4

    def test_while_respects_max_iterations(self, driver):
        driver.element_exists.return_value = True  # never becomes false
        action = {
            "action": "while",
            "condition": {"element_exists": {"text": "Loading..."}},
            "actions": [{"action": "sleep", "duration": 0.01}],
            "max_iterations": 5,
        }
        result = execute_action(driver, action)
        assert result.success
        # 5 iterations: condition checked 5 times (all True) + body runs 5 times
        # but condition is also checked a 6th time... no, range(5) runs 5 times,
        # each iteration checks condition first. Actually: for _ in range(5): check, run
        # so condition checked 5 times, body runs 5 times
        assert driver.element_exists.call_count == 5

    def test_while_condition_false_immediately(self, driver):
        driver.element_exists.return_value = False
        action = {
            "action": "while",
            "condition": {"element_exists": {"text": "Loading..."}},
            "actions": [{"action": "press", "key": "back"}],
        }
        result = execute_action(driver, action)
        assert result.success
        driver.press_key.assert_not_called()

    def test_while_stops_on_action_failure(self, driver):
        driver.element_exists.return_value = True
        driver.press_key.side_effect = Exception("fail")
        action = {
            "action": "while",
            "condition": {"element_exists": {"text": "X"}},
            "actions": [{"action": "press", "key": "back"}],
            "max_iterations": 5,
        }
        result = execute_action(driver, action)
        assert not result.success


# --- try action ---


class TestTryAction:
    def test_try_success(self, driver):
        action = {
            "action": "try",
            "actions": [{"action": "press", "key": "back"}],
            "on_error": [{"action": "sleep", "duration": 0.01}],
        }
        result = execute_action(driver, action)
        assert result.success
        driver.press_key.assert_called_once_with("back")

    def test_try_error_runs_on_error(self, driver):
        driver.press_key.side_effect = Exception("element not found")
        action = {
            "action": "try",
            "actions": [{"action": "press", "key": "back"}],
            "on_error": [{"action": "sleep", "duration": 0.01}],
        }
        result = execute_action(driver, action)
        assert result.success  # on_error succeeded

    def test_try_error_no_on_error(self, driver):
        driver.press_key.side_effect = Exception("fail")
        action = {
            "action": "try",
            "actions": [{"action": "press", "key": "back"}],
        }
        result = execute_action(driver, action)
        assert not result.success

    def test_try_error_on_error_also_fails(self, driver):
        driver.press_key.side_effect = Exception("fail")
        driver.screenshot.side_effect = Exception("no device")
        action = {
            "action": "try",
            "actions": [{"action": "press", "key": "back"}],
            "on_error": [{"action": "screenshot"}],
        }
        result = execute_action(driver, action)
        assert not result.success


# --- Nesting & depth ---


class TestNesting:
    def test_nested_if_in_repeat(self, driver):
        driver.element_exists.return_value = True
        action = {
            "action": "repeat",
            "count": 2,
            "actions": [
                {
                    "action": "if",
                    "condition": {"element_exists": {"text": "Popup"}},
                    "then": [{"action": "press", "key": "back"}],
                }
            ],
        }
        result = execute_action(driver, action)
        assert result.success
        assert driver.press_key.call_count == 2

    def test_max_depth_exceeded(self, driver):
        result = execute_action(
            driver, {"action": "sleep", "duration": 0.01}, depth=MAX_NESTING_DEPTH + 1
        )
        assert not result.success
        assert "nesting depth" in result.error


# --- execute_actions helper ---


class TestExecuteActions:
    def test_runs_all_actions(self, driver):
        actions = [
            {"action": "sleep", "duration": 0.01},
            {"action": "press", "key": "back"},
        ]
        result = execute_actions(driver, actions, depth=0)
        assert result.success
        driver.press_key.assert_called_once_with("back")

    def test_stops_on_failure(self, driver):
        driver.press_key.side_effect = Exception("fail")
        actions = [
            {"action": "press", "key": "back"},
            {"action": "sleep", "duration": 0.01},
        ]
        result = execute_actions(driver, actions, depth=0)
        assert not result.success

    def test_empty_list(self, driver):
        result = execute_actions(driver, [], depth=0)
        assert result.success


# --- assert action ---


class TestAssertAction:
    def test_assert_condition_true(self, driver):
        driver.element_exists.return_value = True
        action = {
            "action": "assert",
            "condition": {"element_exists": {"text": "Home"}},
        }
        result = execute_action(driver, action)
        assert result.success

    def test_assert_condition_false(self, driver):
        driver.element_exists.return_value = False
        action = {
            "action": "assert",
            "condition": {"element_exists": {"text": "Home"}},
        }
        result = execute_action(driver, action)
        assert not result.success
        assert "Assertion failed" in result.error

    def test_assert_custom_message(self, driver):
        driver.element_exists.return_value = False
        action = {
            "action": "assert",
            "condition": {"element_exists": {"text": "Home"}},
            "message": "Login failed — Home screen not found",
        }
        result = execute_action(driver, action)
        assert not result.success
        assert result.error == "Login failed — Home screen not found"

    @patch("circus.automation.actions.time")
    def test_assert_with_timeout_succeeds(self, mock_time, driver):
        # Condition becomes true on 3rd check
        driver.element_exists.side_effect = [False, False, True]
        mock_time.time.side_effect = [0, 0.5, 1.0, 1.5]
        mock_time.sleep = MagicMock()

        action = {
            "action": "assert",
            "condition": {"element_exists": {"text": "Home"}},
            "timeout": 10,
        }
        result = execute_action(driver, action)
        assert result.success

    @patch("circus.automation.actions.time")
    def test_assert_with_timeout_fails(self, mock_time, driver):
        driver.element_exists.return_value = False
        # Simulate time passing beyond timeout
        mock_time.time.side_effect = [0, 0.5, 1.0, 11.0]
        mock_time.sleep = MagicMock()

        action = {
            "action": "assert",
            "condition": {"element_exists": {"text": "Home"}},
            "timeout": 10,
            "message": "Timed out",
        }
        result = execute_action(driver, action)
        assert not result.success
        assert result.error == "Timed out"


# --- wait_gone action ---


class TestWaitGoneAction:
    @patch("circus.automation.actions.time")
    def test_wait_gone_element_disappears(self, mock_time, driver):
        driver.element_exists.side_effect = [True, True, False]
        mock_time.time.side_effect = [0, 0.5, 1.0, 1.5]
        mock_time.sleep = MagicMock()

        action = {
            "action": "wait_gone",
            "text": "Loading...",
            "timeout": 30,
        }
        result = execute_action(driver, action)
        assert result.success

    @patch("circus.automation.actions.time")
    def test_wait_gone_timeout(self, mock_time, driver):
        driver.element_exists.return_value = True
        mock_time.time.side_effect = [0, 0.5, 31.0]
        mock_time.sleep = MagicMock()

        action = {
            "action": "wait_gone",
            "text": "Loading...",
            "timeout": 30,
        }
        result = execute_action(driver, action)
        assert not result.success
        assert "still present" in result.error


# --- clear action ---


class TestClearAction:
    def test_clear_by_text(self, driver):
        action = {"action": "clear", "text": "Username"}
        result = execute_action(driver, action)
        assert result.success
        driver.clear_text.assert_called_once_with(text="Username")

    def test_clear_by_resource_id(self, driver):
        action = {"action": "clear", "resource_id": "com.app:id/input"}
        result = execute_action(driver, action)
        assert result.success
        driver.clear_text.assert_called_once_with(resourceId="com.app:id/input")


# --- random_sleep action ---


class TestRandomSleepAction:
    @patch("circus.automation.actions.time")
    @patch("circus.automation.actions.random")
    def test_random_sleep(self, mock_random, mock_time, driver):
        mock_random.uniform.return_value = 1.5
        mock_time.sleep = MagicMock()

        action = {"action": "random_sleep", "min": 1.0, "max": 3.0}
        result = execute_action(driver, action)
        assert result.success
        mock_random.uniform.assert_called_once_with(1.0, 3.0)
        mock_time.sleep.assert_called_once_with(1.5)

    @patch("circus.automation.actions.time")
    @patch("circus.automation.actions.random")
    def test_random_sleep_defaults(self, mock_random, mock_time, driver):
        mock_random.uniform.return_value = 1.0
        mock_time.sleep = MagicMock()

        action = {"action": "random_sleep"}
        result = execute_action(driver, action)
        assert result.success
        mock_random.uniform.assert_called_once_with(0.5, 2.0)
