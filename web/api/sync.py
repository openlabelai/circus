"""Sync between file-based storage (YAML/JSONL) and Django DB."""
from __future__ import annotations

import json
import os

from django.conf import settings

from api.models import Persona, ServiceCredential, Task, TaskResult


def import_personas_from_yaml(persona_dir: str | None = None) -> int:
    """Read all YAML persona files and upsert into DB. Returns count imported."""
    from circus.persona.storage import PersonaStore

    persona_dir = persona_dir or settings.CIRCUS_PERSONA_DIR
    store = PersonaStore(persona_dir)
    personas = store.list_all()
    assignments = store.get_assignments()

    count = 0
    for cp in personas:
        device = ""
        for pid, serial in assignments.items():
            if pid == cp.id:
                device = serial
                break

        persona, _ = Persona.objects.update_or_create(
            id=cp.id,
            defaults={
                "name": cp.name,
                "age": cp.age,
                "gender": cp.gender,
                "email": cp.email,
                "phone": cp.phone,
                "city": cp.city,
                "state": cp.state,
                "country": cp.country,
                "username": cp.username,
                "bio": cp.bio,
                "interests": cp.interests,
                "niche": cp.niche,
                "tone": cp.tone,
                "background_story": cp.background_story,
                "content_style": cp.content_style,
                "engagement_style": cp.behavior.engagement_style,
                "session_duration_min": cp.behavior.session_duration_min,
                "session_duration_max": cp.behavior.session_duration_max,
                "posting_frequency": cp.behavior.posting_frequency,
                "active_hours_start": cp.behavior.active_hours_start,
                "active_hours_end": cp.behavior.active_hours_end,
                "scroll_speed": cp.behavior.scroll_speed,
                "assigned_device": device,
            },
        )
        # Sync credentials
        persona.credentials.all().delete()
        for svc_name, cred in cp.credentials.items():
            ServiceCredential.objects.create(
                persona=persona,
                service_name=svc_name,
                username=cred.username,
                password=cred.password,
                email=cred.email,
            )
        count += 1

    return count


def export_persona_to_yaml(db_persona) -> str:
    """Convert a Django Persona model to circus Persona and write YAML."""
    from circus.persona.models import BehavioralProfile as BP
    from circus.persona.models import Persona as CircusPersona
    from circus.persona.models import ServiceCredentials as SC

    credentials = {}
    for cred in db_persona.credentials.all():
        credentials[cred.service_name] = SC(
            username=cred.username,
            password=cred.password,
            email=cred.email,
        )

    cp = CircusPersona(
        id=db_persona.id,
        name=db_persona.name,
        age=db_persona.age,
        gender=db_persona.gender,
        email=db_persona.email,
        phone=db_persona.phone,
        city=db_persona.city,
        state=db_persona.state,
        country=db_persona.country,
        username=db_persona.username,
        bio=db_persona.bio,
        interests=db_persona.interests,
        niche=db_persona.niche,
        tone=db_persona.tone,
        background_story=db_persona.background_story,
        content_style=db_persona.content_style,
        behavior=BP(
            engagement_style=db_persona.engagement_style,
            session_duration_min=db_persona.session_duration_min,
            session_duration_max=db_persona.session_duration_max,
            posting_frequency=db_persona.posting_frequency,
            active_hours_start=db_persona.active_hours_start,
            active_hours_end=db_persona.active_hours_end,
            scroll_speed=db_persona.scroll_speed,
        ),
        credentials=credentials,
    )

    persona_dir = settings.CIRCUS_PERSONA_DIR
    os.makedirs(persona_dir, exist_ok=True)
    path = os.path.join(persona_dir, f"{cp.id}.yaml")
    cp.to_yaml(path)
    return path


def delete_persona_yaml(persona_id: str) -> None:
    """Remove persona YAML file and clean up assignments."""
    persona_dir = settings.CIRCUS_PERSONA_DIR
    path = os.path.join(persona_dir, f"{persona_id}.yaml")
    if os.path.exists(path):
        os.remove(path)
    sync_assignments_to_yaml()


def sync_assignments_to_yaml() -> None:
    """Write current DB assignments to the assignments.json file."""
    assignments = {}
    for p in Persona.objects.exclude(assigned_device=""):
        assignments[p.id] = p.assigned_device

    persona_dir = settings.CIRCUS_PERSONA_DIR
    os.makedirs(persona_dir, exist_ok=True)
    path = os.path.join(persona_dir, "assignments.json")
    with open(path, "w") as f:
        json.dump(assignments, f, indent=2)


def export_task_to_yaml(db_task) -> str:
    """Write a Task model instance back to YAML on disk."""
    import yaml

    task_dir = settings.CIRCUS_TASK_DIR
    os.makedirs(task_dir, exist_ok=True)

    data = {
        "name": db_task.name,
        "description": db_task.description,
        "target_package": db_task.target_package,
        "timeout": db_task.timeout,
        "retry_count": db_task.retry_count,
        "actions": db_task.actions,
    }

    fname = db_task.source_file or f"{db_task.name.lower().replace(' ', '_')}.yaml"
    if not db_task.source_file:
        db_task.source_file = fname
        db_task.save(update_fields=["source_file"])

    path = os.path.join(task_dir, fname)
    with open(path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
    return path


def delete_task_yaml(source_file: str) -> None:
    """Remove task YAML file from disk."""
    if not source_file:
        return
    path = os.path.join(settings.CIRCUS_TASK_DIR, source_file)
    if os.path.exists(path):
        os.remove(path)


def import_tasks_from_yaml(task_dir: str | None = None) -> int:
    """Scan task directory for YAML files and upsert into Task table."""
    import yaml

    task_dir = task_dir or settings.CIRCUS_TASK_DIR
    if not os.path.isdir(task_dir):
        return 0

    count = 0
    for fname in os.listdir(task_dir):
        if not fname.endswith((".yaml", ".yml")):
            continue
        path = os.path.join(task_dir, fname)
        with open(path) as f:
            data = yaml.safe_load(f)
        if not data or "name" not in data:
            continue

        Task.objects.update_or_create(
            source_file=fname,
            defaults={
                "name": data["name"],
                "description": data.get("description", ""),
                "target_package": data.get("target_package", ""),
                "timeout": data.get("timeout", 300.0),
                "retry_count": data.get("retry_count", 0),
                "actions": data.get("actions", []),
            },
        )
        count += 1

    return count


def import_results_from_jsonl(results_dir: str | None = None) -> int:
    """Read all .jsonl result files and insert into TaskResult table."""
    from datetime import datetime, timezone

    results_dir = results_dir or settings.CIRCUS_RESULTS_DIR
    if not os.path.isdir(results_dir):
        return 0

    count = 0
    for fname in sorted(os.listdir(results_dir)):
        if not fname.endswith(".jsonl"):
            continue
        path = os.path.join(results_dir, fname)
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                ts = rec.get("timestamp", "")
                try:
                    parsed_ts = datetime.fromisoformat(ts) if ts else None
                except ValueError:
                    parsed_ts = None

                # Skip if we already have this exact result
                if parsed_ts:
                    exists = TaskResult.objects.filter(
                        task_id=rec["task_id"],
                        device_serial=rec["device_serial"],
                        timestamp=parsed_ts,
                    ).exists()
                    if exists:
                        continue

                TaskResult.objects.create(
                    task_id=rec["task_id"],
                    device_serial=rec["device_serial"],
                    success=rec["success"],
                    actions_completed=rec["actions_completed"],
                    actions_total=rec["actions_total"],
                    duration=rec["duration"],
                    error=rec.get("error"),
                    screenshot_count=rec.get("screenshot_count", 0),
                    **({"timestamp": parsed_ts} if parsed_ts else {}),
                )
                count += 1

    return count
