import uuid
from dataclasses import dataclass, field
from typing import Any

import yaml


@dataclass
class ServiceCredentials:
    username: str = ""
    password: str = ""
    email: str = ""

    def to_dict(self) -> dict[str, str]:
        return {"username": self.username, "password": self.password, "email": self.email}

    @classmethod
    def from_dict(cls, data: dict) -> "ServiceCredentials":
        return cls(
            username=data.get("username", ""),
            password=data.get("password", ""),
            email=data.get("email", ""),
        )


@dataclass
class BehavioralProfile:
    engagement_style: str = "passive"
    session_duration_min: int = 5
    session_duration_max: int = 30
    posting_frequency: str = "daily"
    active_hours_start: int = 9
    active_hours_end: int = 22
    scroll_speed: str = "medium"

    def to_dict(self) -> dict[str, Any]:
        return {
            "engagement_style": self.engagement_style,
            "session_duration_min": self.session_duration_min,
            "session_duration_max": self.session_duration_max,
            "posting_frequency": self.posting_frequency,
            "active_hours_start": self.active_hours_start,
            "active_hours_end": self.active_hours_end,
            "scroll_speed": self.scroll_speed,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "BehavioralProfile":
        return cls(
            engagement_style=data.get("engagement_style", "passive"),
            session_duration_min=data.get("session_duration_min", 5),
            session_duration_max=data.get("session_duration_max", 30),
            posting_frequency=data.get("posting_frequency", "daily"),
            active_hours_start=data.get("active_hours_start", 9),
            active_hours_end=data.get("active_hours_end", 22),
            scroll_speed=data.get("scroll_speed", "medium"),
        )


@dataclass
class Persona:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str = ""
    age: int = 25
    gender: str = ""
    email: str = ""
    phone: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    username: str = ""
    bio: str = ""
    interests: list[str] = field(default_factory=list)
    behavior: BehavioralProfile = field(default_factory=BehavioralProfile)
    credentials: dict[str, ServiceCredentials] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "age": self.age,
            "gender": self.gender,
            "email": self.email,
            "phone": self.phone,
            "city": self.city,
            "state": self.state,
            "country": self.country,
            "username": self.username,
            "bio": self.bio,
            "interests": self.interests,
            "behavior": self.behavior.to_dict(),
            "credentials": {k: v.to_dict() for k, v in self.credentials.items()},
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Persona":
        creds = {
            k: ServiceCredentials.from_dict(v)
            for k, v in data.get("credentials", {}).items()
        }
        behavior = BehavioralProfile.from_dict(data.get("behavior", {}))
        return cls(
            id=data["id"],
            name=data.get("name", ""),
            age=data.get("age", 25),
            gender=data.get("gender", ""),
            email=data.get("email", ""),
            phone=data.get("phone", ""),
            city=data.get("city", ""),
            state=data.get("state", ""),
            country=data.get("country", ""),
            username=data.get("username", ""),
            bio=data.get("bio", ""),
            interests=data.get("interests", []),
            behavior=behavior,
            credentials=creds,
        )

    @classmethod
    def from_yaml(cls, path: str) -> "Persona":
        with open(path) as f:
            data = yaml.safe_load(f)
        return cls.from_dict(data)

    def to_yaml(self, path: str) -> None:
        with open(path, "w") as f:
            yaml.dump(self.to_dict(), f, default_flow_style=False, sort_keys=False)

    def resolve(self, dotpath: str) -> str:
        """Resolve a dot-separated path like 'credentials.instagram.username'."""
        obj: Any = self.to_dict()
        for part in dotpath.split("."):
            if isinstance(obj, dict):
                obj = obj.get(part, "")
            else:
                return ""
        return str(obj)
