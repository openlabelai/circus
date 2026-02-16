from __future__ import annotations

import json
import os

from circus.persona.models import Persona


class PersonaStore:
    """Read/write personas as YAML files and manage device assignments."""

    def __init__(self, persona_dir: str = "./personas"):
        self.persona_dir = persona_dir
        self._assignments_path = os.path.join(persona_dir, "assignments.json")

    def _ensure_dir(self) -> None:
        os.makedirs(self.persona_dir, exist_ok=True)

    def _persona_path(self, persona_id: str) -> str:
        return os.path.join(self.persona_dir, f"{persona_id}.yaml")

    # -- Persona CRUD --

    def save(self, persona: Persona) -> str:
        self._ensure_dir()
        path = self._persona_path(persona.id)
        persona.to_yaml(path)
        return path

    def load(self, persona_id: str) -> Persona:
        path = self._persona_path(persona_id)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Persona not found: {persona_id}")
        return Persona.from_yaml(path)

    def list_all(self) -> list[Persona]:
        if not os.path.isdir(self.persona_dir):
            return []
        personas = []
        for f in sorted(os.listdir(self.persona_dir)):
            if f.endswith((".yaml", ".yml")):
                try:
                    personas.append(
                        Persona.from_yaml(os.path.join(self.persona_dir, f))
                    )
                except Exception:
                    continue
        return personas

    def delete(self, persona_id: str) -> None:
        path = self._persona_path(persona_id)
        if os.path.exists(path):
            os.remove(path)
        assignments = self._load_assignments()
        if persona_id in assignments:
            del assignments[persona_id]
            self._save_assignments(assignments)

    # -- Assignments --

    def _load_assignments(self) -> dict[str, str]:
        if not os.path.exists(self._assignments_path):
            return {}
        with open(self._assignments_path) as f:
            return json.load(f)

    def _save_assignments(self, assignments: dict[str, str]) -> None:
        self._ensure_dir()
        with open(self._assignments_path, "w") as f:
            json.dump(assignments, f, indent=2)

    def assign(self, persona_id: str, device_serial: str) -> None:
        if not os.path.exists(self._persona_path(persona_id)):
            raise FileNotFoundError(f"Persona not found: {persona_id}")
        assignments = self._load_assignments()
        for pid, serial in assignments.items():
            if serial == device_serial and pid != persona_id:
                raise ValueError(
                    f"Device {device_serial} already assigned to persona {pid}"
                )
        assignments[persona_id] = device_serial
        self._save_assignments(assignments)

    def unassign(self, persona_id: str) -> None:
        assignments = self._load_assignments()
        if persona_id not in assignments:
            raise KeyError(f"Persona {persona_id} has no assignment")
        del assignments[persona_id]
        self._save_assignments(assignments)

    def get_assignments(self) -> dict[str, str]:
        return self._load_assignments()

    def get_persona_for_device(self, device_serial: str) -> Persona | None:
        """Look up the persona assigned to a device."""
        assignments = self._load_assignments()
        for persona_id, serial in assignments.items():
            if serial == device_serial:
                try:
                    return self.load(persona_id)
                except FileNotFoundError:
                    return None
        return None

    def get_device_for_persona(self, persona_id: str) -> str | None:
        return self._load_assignments().get(persona_id)
