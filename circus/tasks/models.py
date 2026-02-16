import uuid
from dataclasses import dataclass, field

import yaml


@dataclass
class Task:
    name: str
    actions: list[dict]
    description: str = ""
    target_package: str = ""
    timeout: float = 300.0
    retry_count: int = 0
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    variables: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_yaml(cls, path: str) -> "Task":
        with open(path) as f:
            data = yaml.safe_load(f)
        return cls(
            name=data["name"],
            actions=data["actions"],
            description=data.get("description", ""),
            target_package=data.get("target_package", ""),
            timeout=data.get("timeout", 300.0),
            retry_count=data.get("retry_count", 0),
        )
