import random
from datetime import date

from django.conf import settings
from django.db.models import Max
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from api.models import (
    LLMConfig, Persona, QueuedRun,
    ScheduledTask, ServiceCredential, Task, TaskResult,
)
from api.serializers import (
    LLMConfigSerializer,
    PersonaListSerializer,
    PersonaSerializer,
    QueuedRunCreateSerializer,
    QueuedRunSerializer,
    ScheduledTaskSerializer,
    TaskResultSerializer,
    TaskSerializer,
)


class PersonaViewSet(viewsets.ModelViewSet):
    queryset = Persona.objects.prefetch_related("credentials").all()

    def get_serializer_class(self):
        if self.action == "list":
            return PersonaListSerializer
        return PersonaSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        from api.sync import export_persona_to_yaml
        export_persona_to_yaml(instance)

    def perform_destroy(self, instance):
        from api.sync import delete_persona_yaml
        delete_persona_yaml(instance.id)
        instance.delete()

    @action(detail=False, methods=["post"])
    def generate(self, request):
        count = request.data.get("count", 1)
        services = request.data.get("services", None)
        niche = request.data.get("niche", None)
        tone = request.data.get("tone", None)
        age_min = request.data.get("age_min", None)
        age_max = request.data.get("age_max", None)
        genre = request.data.get("genre", None)
        archetype = request.data.get("archetype", None)

        from api.services import generate_personas
        circus_personas = generate_personas(
            count, services,
            niche=niche, tone=tone,
            age_min=age_min, age_max=age_max,
            genre=genre, archetype=archetype,
        )

        created = []
        for cp in circus_personas:
            persona = Persona.objects.create(
                id=cp.id,
                name=cp.name,
                age=cp.age,
                gender=cp.gender,
                email=cp.email,
                phone=cp.phone,
                city=cp.city,
                state=cp.state,
                country=cp.country,
                username=cp.username,
                bio=cp.bio,
                interests=cp.interests,
                niche=cp.niche,
                tone=cp.tone,
                background_story=cp.background_story,
                content_style=cp.content_style,
                genre=cp.genre,
                archetype=cp.archetype,
                favorite_artists=cp.favorite_artists,
                music_discovery_style=cp.music_discovery_style,
                comment_style=cp.comment_style,
                bio_template=cp.bio_template,
                username_style=cp.username_style,
                engagement_pattern=cp.engagement_pattern,
                content_behavior=cp.content_behavior,
                profile_aesthetic=cp.profile_aesthetic,
                artist_knowledge_depth=cp.artist_knowledge_depth,
                engagement_style=cp.behavior.engagement_style,
                session_duration_min=cp.behavior.session_duration_min,
                session_duration_max=cp.behavior.session_duration_max,
                posting_frequency=cp.behavior.posting_frequency,
                active_hours_start=cp.behavior.active_hours_start,
                active_hours_end=cp.behavior.active_hours_end,
                scroll_speed=cp.behavior.scroll_speed,
            )
            for svc_name, cred in cp.credentials.items():
                ServiceCredential.objects.create(
                    persona=persona,
                    service_name=svc_name,
                    username=cred.username,
                    password=cred.password,
                    email=cred.email,
                )
            from api.sync import export_persona_to_yaml
            export_persona_to_yaml(persona)
            created.append(persona)

        serializer = PersonaListSerializer(created, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        persona = self.get_object()
        device_serial = request.data.get("device_serial")
        if not device_serial:
            return Response({"error": "device_serial required"}, status=status.HTTP_400_BAD_REQUEST)
        # Unassign any other persona from this device
        Persona.objects.filter(assigned_device=device_serial).update(assigned_device="")
        persona.assigned_device = device_serial
        persona.save()
        from api.sync import export_persona_to_yaml, sync_assignments_to_yaml
        export_persona_to_yaml(persona)
        sync_assignments_to_yaml()
        return Response({"status": "assigned", "device_serial": device_serial})

    @action(detail=True, methods=["post"])
    def unassign(self, request, pk=None):
        persona = self.get_object()
        persona.assigned_device = ""
        persona.save()
        from api.sync import sync_assignments_to_yaml
        sync_assignments_to_yaml()
        return Response({"status": "unassigned"})


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        from api.sync import export_task_to_yaml
        export_task_to_yaml(instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        from api.sync import export_task_to_yaml
        export_task_to_yaml(instance)

    def perform_destroy(self, instance):
        from api.sync import delete_task_yaml
        delete_task_yaml(instance.source_file)
        instance.delete()

    @action(detail=False, methods=["post"])
    def sync(self, request):
        from api.sync import import_tasks_from_yaml
        count = import_tasks_from_yaml(settings.CIRCUS_TASK_DIR)
        return Response({"imported": count})

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        task = self.get_object()
        device_serial = request.data.get("device_serial", None)
        background = request.data.get("background", False)

        if background:
            run = QueuedRun.objects.create(
                task=task,
                device_serial=device_serial or "",
                max_retries=task.retry_count,
            )
            return Response(
                {"queued_run_id": run.id, "status": "queued"},
                status=status.HTTP_202_ACCEPTED,
            )

        from api.services import run_task_on_device
        try:
            result_data = run_task_on_device(task, device_serial)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        # Save to DB
        TaskResult.objects.create(
            task_id=result_data["task_id"],
            task_name=task.name,
            device_serial=result_data["device_serial"],
            success=result_data["success"],
            actions_completed=result_data["actions_completed"],
            actions_total=result_data["actions_total"],
            duration=result_data["duration"],
            error=result_data.get("error"),
            screenshot_count=result_data.get("screenshot_count", 0),
        )
        return Response(result_data)

    @action(detail=True, methods=["post"], url_path="run-all")
    def run_all(self, request, pk=None):
        task = self.get_object()
        device_filter = request.data.get("device_filter", None)
        from api.services import run_task_on_all
        try:
            summary = run_task_on_all(task, device_filter)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        # Save each result to DB
        for r in summary.get("results", []):
            TaskResult.objects.create(
                task_id=r["task_id"],
                task_name=task.name,
                device_serial=r["device_serial"],
                success=r["success"],
                actions_completed=r["actions_completed"],
                actions_total=r["actions_total"],
                duration=r["duration"],
                error=r.get("error"),
                screenshot_count=r.get("screenshot_count", 0),
            )
        return Response(summary)


class TaskResultViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TaskResultSerializer

    def get_queryset(self):
        qs = TaskResult.objects.all()
        date_str = self.request.query_params.get("date")
        task_id = self.request.query_params.get("task_id")
        if date_str:
            qs = qs.filter(timestamp__date=date_str)
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs

    @action(detail=False, methods=["post"])
    def sync(self, request):
        from api.sync import import_results_from_jsonl
        count = import_results_from_jsonl(settings.CIRCUS_RESULTS_DIR)
        return Response({"imported": count})


# -- Device views (not model-backed, uses in-memory pool) --

@api_view(["GET"])
def device_list(request):
    from api.services import list_devices
    return Response(list_devices())


@api_view(["POST"])
def device_refresh(request):
    from api.services import refresh_devices
    return Response(refresh_devices())


@api_view(["GET"])
def device_detail(request, serial):
    from api.services import get_device
    device = get_device(serial)
    if device is None:
        return Response({"error": "Device not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(device)


@api_view(["GET"])
def status_overview(request):
    from api.services import list_devices
    devices = list_devices()
    device_counts = {}
    for d in devices:
        s = d["status"]
        device_counts[s] = device_counts.get(s, 0) + 1

    today = date.today()
    today_results = TaskResult.objects.filter(timestamp__date=today)
    today_total = today_results.count()
    today_success = today_results.filter(success=True).count()

    return Response({
        "personas": Persona.objects.count(),
        "devices": {
            "total": len(devices),
            "by_status": device_counts,
        },
        "tasks": Task.objects.count(),
        "results_today": {
            "total": today_total,
            "successful": today_success,
            "failed": today_total - today_success,
        },
        "schedules": ScheduledTask.objects.filter(status="active").count(),
        "queue": {
            "queued": QueuedRun.objects.filter(status="queued").count(),
            "running": QueuedRun.objects.filter(status="running").count(),
        },
        "warming": {
            "active": ScheduledTask.objects.filter(is_warming=True, status="active").exists(),
            "active_schedules": ScheduledTask.objects.filter(is_warming=True, status="active").count(),
        },
    })


# -- Schedule and Queue viewsets --


class ScheduledTaskViewSet(viewsets.ModelViewSet):
    queryset = ScheduledTask.objects.select_related("task", "persona").all()
    serializer_class = ScheduledTaskSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        is_warming = self.request.query_params.get("is_warming")
        if is_warming is not None:
            qs = qs.filter(is_warming=is_warming.lower() in ("true", "1"))
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        from api.scheduler import get_scheduler
        scheduler = get_scheduler()
        if scheduler._started:
            scheduler.sync_schedule(instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        from api.scheduler import get_scheduler
        scheduler = get_scheduler()
        if scheduler._started:
            scheduler.sync_schedule(instance)

    def perform_destroy(self, instance):
        from api.scheduler import get_scheduler
        scheduler = get_scheduler()
        if scheduler._started:
            scheduler.remove_schedule(instance.id)
        instance.delete()

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        schedule = self.get_object()
        schedule.status = "paused"
        schedule.save(update_fields=["status"])
        from api.scheduler import get_scheduler
        scheduler = get_scheduler()
        if scheduler._started:
            scheduler.remove_schedule(schedule.id)
        return Response({"status": "paused"})

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        schedule = self.get_object()
        schedule.status = "active"
        schedule.save(update_fields=["status"])
        from api.scheduler import get_scheduler
        scheduler = get_scheduler()
        if scheduler._started:
            scheduler.sync_schedule(schedule)
        return Response({"status": "active"})


class QueuedRunViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = QueuedRunSerializer

    def get_queryset(self):
        qs = QueuedRun.objects.select_related("task", "persona", "schedule").all()
        run_status = self.request.query_params.get("status")
        task_id = self.request.query_params.get("task_id")
        schedule_id = self.request.query_params.get("schedule")
        if run_status:
            qs = qs.filter(status=run_status)
        if task_id:
            qs = qs.filter(task_id=task_id)
        if schedule_id:
            qs = qs.filter(schedule_id=schedule_id)
        return qs

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        run = self.get_object()
        if run.status != "queued":
            return Response(
                {"error": "Can only cancel queued runs"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        run.status = "cancelled"
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "completed_at"])
        return Response({"status": "cancelled"})

    @action(detail=False, methods=["post"])
    def enqueue(self, request):
        serializer = QueuedRunCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            task = Task.objects.get(id=data["task_id"])
        except Task.DoesNotExist:
            return Response(
                {"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND
            )

        persona = None
        if data.get("persona_id"):
            try:
                persona = Persona.objects.get(id=data["persona_id"])
            except Persona.DoesNotExist:
                return Response(
                    {"error": "Persona not found"}, status=status.HTTP_404_NOT_FOUND
                )

        run = QueuedRun.objects.create(
            task=task,
            persona=persona,
            device_serial=data.get("device_serial", ""),
            priority=data.get("priority", 0),
            max_retries=task.retry_count,
        )
        return Response(
            QueuedRunSerializer(run).data, status=status.HTTP_201_CREATED
        )


# -- LLM Config --


class LLMConfigViewSet(viewsets.ModelViewSet):
    queryset = LLMConfig.objects.all()
    serializer_class = LLMConfigSerializer

    def list(self, request, *args, **kwargs):
        # Auto-create rows for any missing purposes
        existing = set(LLMConfig.objects.values_list("purpose", flat=True))
        for choice_val, _label in LLMConfig.PURPOSE_CHOICES:
            if choice_val not in existing:
                LLMConfig.objects.create(purpose=choice_val)
        return super().list(request, *args, **kwargs)


@api_view(["GET"])
def llm_providers(request):
    from circus.llm.providers import get_available_providers
    return Response(get_available_providers())


@api_view(["GET", "POST"])
def provider_keys(request):
    from api.models import ProviderAPIKey
    from circus.llm.providers import PROVIDERS

    if request.method == "GET":
        saved = {obj.provider: obj.api_key for obj in ProviderAPIKey.objects.all()}
        result = []
        for provider_id, info in PROVIDERS.items():
            key = saved.get(provider_id, "")
            result.append({
                "provider": provider_id,
                "label": info["label"],
                "has_key": bool(key),
                "masked_key": f"...{key[-4:]}" if len(key) >= 4 else "",
            })
        return Response(result)

    # POST — upsert a key
    provider_id = request.data.get("provider", "")
    api_key = request.data.get("api_key", "")
    if provider_id not in PROVIDERS:
        return Response({"error": "Unknown provider"}, status=status.HTTP_400_BAD_REQUEST)
    if not api_key:
        return Response({"error": "api_key required"}, status=status.HTTP_400_BAD_REQUEST)

    obj, _created = ProviderAPIKey.objects.update_or_create(
        provider=provider_id, defaults={"api_key": api_key}
    )
    return Response({"provider": provider_id, "status": "saved"})


@api_view(["DELETE"])
def provider_key_delete(request, provider):
    from api.models import ProviderAPIKey

    ProviderAPIKey.objects.filter(provider=provider).delete()
    return Response({"provider": provider, "status": "deleted"})


# -- Warming endpoints --

WARMING_TASKS = [
    "warm_scroll_feed",
    "warm_like_posts",
    "warm_explore",
    "warm_watch_stories",
    "warm_search_interest",
]


def _random_cron(hour_start, hour_end):
    """Generate a random daily cron expression within the given hour range."""
    hour = random.randint(hour_start, max(hour_start, hour_end - 1))
    minute = random.randint(0, 59)
    return f"{minute} {hour} * * *"


@api_view(["POST"])
def warming_activate(request):
    """Create warming schedules for all personas with assigned devices."""
    personas = Persona.objects.exclude(assigned_device="")
    if not personas.exists():
        return Response(
            {"error": "No personas with assigned devices found"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Find warming tasks in the DB
    warming_tasks = Task.objects.filter(name__in=WARMING_TASKS)
    if not warming_tasks.exists():
        return Response(
            {"error": "Warming tasks not found. Run task sync first."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    warming_tasks_list = list(warming_tasks)

    created_count = 0
    for persona in personas:
        # Remove any existing warming schedules for this persona
        ScheduledTask.objects.filter(persona=persona, is_warming=True).delete()

        # Pick 3 tasks: scroll_feed + like_posts + one random from the rest
        primary_tasks = [t for t in warming_tasks_list if t.name in ("warm_scroll_feed", "warm_like_posts")]
        extra_tasks = [t for t in warming_tasks_list if t.name not in ("warm_scroll_feed", "warm_like_posts")]
        selected = primary_tasks + (random.sample(extra_tasks, min(1, len(extra_tasks))) if extra_tasks else [])

        for task in selected:
            cron = _random_cron(persona.active_hours_start, persona.active_hours_end)
            schedule = ScheduledTask.objects.create(
                task=task,
                persona=persona,
                device_serial=persona.assigned_device,
                trigger_type="cron",
                cron_expression=cron,
                respect_active_hours=True,
                is_warming=True,
                status="active",
            )
            # Sync with live scheduler if running
            try:
                from api.scheduler import get_scheduler
                scheduler = get_scheduler()
                if scheduler._started:
                    scheduler.sync_schedule(schedule)
            except Exception:
                pass
            created_count += 1

    return Response({
        "status": "activated",
        "personas": personas.count(),
        "schedules_created": created_count,
    })


@api_view(["POST"])
def warming_deactivate(request):
    """Pause all warming schedules."""
    warming_schedules = ScheduledTask.objects.filter(is_warming=True, status="active")
    count = warming_schedules.count()

    for schedule in warming_schedules:
        schedule.status = "paused"
        schedule.save(update_fields=["status"])
        try:
            from api.scheduler import get_scheduler
            scheduler = get_scheduler()
            if scheduler._started:
                scheduler.remove_schedule(schedule.id)
        except Exception:
            pass

    return Response({
        "status": "deactivated",
        "schedules_paused": count,
    })


@api_view(["GET"])
def warming_status(request):
    """Return warming state overview and per-persona details."""
    warming_schedules = ScheduledTask.objects.filter(is_warming=True).select_related("task", "persona")

    active_count = warming_schedules.filter(status="active").count()
    paused_count = warming_schedules.filter(status="paused").count()
    total_count = warming_schedules.count()

    # Per-persona breakdown
    personas_with_devices = Persona.objects.exclude(assigned_device="")
    persona_details = []
    for persona in personas_with_devices:
        p_schedules = warming_schedules.filter(persona=persona)
        persona_details.append({
            "persona_id": persona.id,
            "persona_name": persona.name,
            "device_serial": persona.assigned_device,
            "active_schedules": p_schedules.filter(status="active").count(),
            "paused_schedules": p_schedules.filter(status="paused").count(),
            "last_run": p_schedules.aggregate(last=Max("last_run_at"))["last"],
        })

    return Response({
        "active": active_count > 0,
        "schedules": {
            "total": total_count,
            "active": active_count,
            "paused": paused_count,
        },
        "personas": persona_details,
    })
