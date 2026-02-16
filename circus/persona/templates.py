import re
from typing import Any

from circus.persona.models import Persona

_PERSONA_VAR_RE = re.compile(r"\{persona\.([a-zA-Z0-9_.]+)\}")
_TASK_VAR_RE = re.compile(r"\{task\.([a-zA-Z0-9_]+)\}")


def substitute_persona_vars(value: Any, persona: Persona) -> Any:
    """Recursively substitute {persona.xxx} placeholders in action data.

    Handles strings, dicts, and lists. Non-string leaves pass through unchanged.
    """
    if isinstance(value, str):
        return _PERSONA_VAR_RE.sub(
            lambda m: persona.resolve(m.group(1)), value
        )
    if isinstance(value, dict):
        return {k: substitute_persona_vars(v, persona) for k, v in value.items()}
    if isinstance(value, list):
        return [substitute_persona_vars(item, persona) for item in value]
    return value


def substitute_task_vars(value: Any, variables: dict[str, str]) -> Any:
    """Recursively substitute {task.xxx} placeholders with task variables.

    Same recursive pattern as substitute_persona_vars.
    """
    if isinstance(value, str):
        return _TASK_VAR_RE.sub(
            lambda m: variables.get(m.group(1), m.group(0)), value
        )
    if isinstance(value, dict):
        return {k: substitute_task_vars(v, variables) for k, v in value.items()}
    if isinstance(value, list):
        return [substitute_task_vars(item, variables) for item in value]
    return value
