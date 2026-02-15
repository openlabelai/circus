import re
from typing import Any

from circus.persona.models import Persona

_PERSONA_VAR_RE = re.compile(r"\{persona\.([a-zA-Z0-9_.]+)\}")


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
