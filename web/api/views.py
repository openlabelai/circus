import logging
import random
from datetime import date

logger = logging.getLogger(__name__)

from django.conf import settings
from django.db.models import Max
from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from django.db import models
from django.db.models import Count

from api.models import (
    Agent, ArtistProfile, LLMConfig, Persona, Project, QueuedRun,
    ScheduledTask, ServiceCredential, Task, TaskResult,
)
from api.serializers import (
    AgentSerializer,
    ArtistProfileSerializer,
    LLMConfigSerializer,
    PersonaListSerializer,
    PersonaSerializer,
    ProjectSerializer,
    QueuedRunCreateSerializer,
    QueuedRunSerializer,
    ScheduledTaskSerializer,
    TaskResultSerializer,
    TaskSerializer,
)


def _project_filter(request):
    """Return a dict filter for project scoping from query params."""
    project_id = request.query_params.get("project")
    if project_id:
        return {"project_id": project_id}
    return {}


def _normalize_instagram_handle(handle: str) -> str:
    """Normalize input to a plain username suitable for IG search."""
    return (handle or "").strip().lstrip("@")


class ArtistProfileViewSet(viewsets.ModelViewSet):
    queryset = ArtistProfile.objects.all()
    serializer_class = ArtistProfileSerializer

    @action(detail=True, methods=["post"])
    def research(self, request, pk=None):
        profile = self.get_object()
        if profile.status == "researching":
            return Response(
                {"error": "Research already in progress"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.status = "researching"
        profile.error_message = ""
        profile.save(update_fields=["status", "error_message"])

        # Auto-enrich if api_data is empty
        if not profile.api_data:
            try:
                from circus.research.apis import fetch_all_api_data
                api_data = fetch_all_api_data(profile)
                if api_data:
                    profile.api_data = api_data
                    profile.save(update_fields=["api_data"])
            except Exception:
                pass  # Non-fatal, continue with research

        from circus.persona.artist_research import research_artist
        result = research_artist(
            artist_name=profile.artist_name,
            spotify_url=profile.spotify_url,
            country=profile.country,
            city=profile.city,
            genre=profile.genre,
            instagram_handle=profile.instagram_handle,
            youtube_url=profile.youtube_url,
            tiktok_handle=profile.tiktok_handle,
            twitter_handle=profile.twitter_handle,
            description=profile.description,
            scraped_comments=profile.scraped_comments or None,
            api_data=profile.api_data or None,
        )

        if result["success"]:
            profile.profile_data = result["profile_data"]
            profile.raw_profile_text = result["raw_text"]
            profile.status = "completed"
            profile.error_message = ""
        else:
            profile.status = "failed"
            profile.error_message = result["error"] or "Unknown error"

        profile.save()
        return Response(ArtistProfileSerializer(profile).data)

    @action(detail=True, methods=["post"])
    def fetch_comments(self, request, pk=None):
        profile = self.get_object()
        source = request.data.get("source", "youtube")

        # Scraping intensity levels — target total comments, keep going until met
        intensity = request.data.get("intensity", "mid")
        intensity_map = {
            "soft": {"target_comments": 100,  "max_videos": 10,  "ig_posts": 5},
            "mid":  {"target_comments": 250,  "max_videos": 20,  "ig_posts": 8},
            "hard": {"target_comments": 500,  "max_videos": 40,  "ig_posts": 12},
        }
        scrape_cfg = intensity_map.get(intensity, intensity_map["mid"])

        if source == "youtube":
            if not profile.youtube_url and not profile.artist_name:
                return Response(
                    {"error": "YouTube URL or artist name required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            profile.scraping_status = "scraping"
            profile.save(update_fields=["scraping_status"])

            try:
                from circus.research.youtube import fetch_artist_comments
                result = fetch_artist_comments(
                    artist_name=profile.artist_name,
                    youtube_url=profile.youtube_url,
                    max_videos=scrape_cfg["max_videos"],
                    target_comments=scrape_cfg["target_comments"],
                )
                # Append to existing comments
                existing = profile.scraped_comments or []
                existing.extend(result["comments"])
                profile.scraped_comments = existing

                # Store video metadata
                api_data = profile.api_data or {}
                api_data["youtube"] = {
                    "channel_id": result.get("channel_id", ""),
                    "videos_scraped": result["videos_scraped"],
                    "total_comments": result["total_comments"],
                    "videos": result.get("videos", []),
                }
                profile.api_data = api_data
                profile.scraping_status = "done"
                profile.last_scraped_at = timezone.now()

                # Always update channel thumbnail from the scraped channel
                if result.get("channel_id"):
                    try:
                        from circus.research.youtube import fetch_channel_thumbnail
                        thumb_url = fetch_channel_thumbnail(result["channel_id"])
                        if thumb_url:
                            profile.profile_image_url = thumb_url
                    except Exception:
                        pass  # Non-fatal

                profile.save()
            except Exception as e:
                profile.scraping_status = "failed"
                profile.save(update_fields=["scraping_status"])
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        elif source == "instagram":
            if not profile.instagram_handle:
                return Response(
                    {"error": "Instagram handle required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            device_serial = request.data.get("device_serial")
            ig_handle = _normalize_instagram_handle(profile.instagram_handle)
            if not ig_handle:
                return Response(
                    {"error": "Instagram handle required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Ensure DB task stays in sync with latest YAML before execution.
            from api.sync import import_tasks_from_yaml
            import_tasks_from_yaml(settings.CIRCUS_TASK_DIR)

            # Find the scrape task
            scrape_task = Task.objects.filter(name="scrape_instagram_comments").first()
            if not scrape_task:
                return Response(
                    {"error": "scrape_instagram_comments task not found. Run task sync first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            profile.scraping_status = "scraping"
            profile.save(update_fields=["scraping_status"])

            try:
                from api.services import run_task_on_device
                result_data = run_task_on_device(
                    scrape_task,
                    serial=device_serial,
                    variables={
                        "instagram_handle": ig_handle,
                        "post_count": str(scrape_cfg["ig_posts"]),
                    },
                )

                # Extract comments from extraction_data
                extraction_data = result_data.get("extraction_data", [])
                ig_comments = []
                seen_texts: set[str] = set()
                for item in extraction_data:
                    if not isinstance(item, dict):
                        continue
                    # Handle both "comments" key (from vision)
                    # and "texts" key (default from extract_elements)
                    comment_list = item.get("comments") or item.get("texts") or []
                    for comment_text in comment_list:
                        if isinstance(comment_text, str) and comment_text.strip():
                            normalized = comment_text.strip()
                            if normalized in seen_texts:
                                continue
                            seen_texts.add(normalized)
                            ig_comments.append({
                                "text": normalized,
                                "likes": 0,
                                "source": "instagram",
                            })

                existing = profile.scraped_comments or []
                existing.extend(ig_comments)
                profile.scraped_comments = existing
                profile.scraping_status = "done"
                profile.last_scraped_at = timezone.now()
                profile.save()
            except Exception as e:
                profile.scraping_status = "failed"
                profile.save(update_fields=["scraping_status"])
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(
                {"error": f"Unknown source: {source}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(ArtistProfileSerializer(profile).data)

    @action(detail=True, methods=["post"])
    def clear_comments(self, request, pk=None):
        profile = self.get_object()
        profile.scraped_comments = []
        profile.scraping_status = "idle"
        profile.save(update_fields=["scraped_comments", "scraping_status"])
        return Response(ArtistProfileSerializer(profile).data)

    @action(detail=True, methods=["post"])
    def enrich(self, request, pk=None):
        profile = self.get_object()

        try:
            from circus.research.apis import fetch_all_api_data
            api_data = fetch_all_api_data(profile)
            if api_data:
                existing = profile.api_data or {}
                existing.update(api_data)
                profile.api_data = existing
                profile.save(update_fields=["api_data"])
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ArtistProfileSerializer(profile).data)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.objects.annotate(
            persona_count=Count("personas", distinct=True),
            task_count=Count("tasks", distinct=True),
            schedule_count=Count("schedules", distinct=True),
            active_schedule_count=Count(
                "schedules",
                filter=models.Q(schedules__status="active"),
                distinct=True,
            ),
        ).all()

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        project = self.get_object()
        today = date.today()

        personas = Persona.objects.filter(project=project)
        today_results = TaskResult.objects.filter(project=project, timestamp__date=today)
        today_total = today_results.count()
        today_success = today_results.filter(success=True).count()

        devices_in_use = (
            personas.exclude(assigned_device="")
            .values("assigned_device")
            .distinct()
            .count()
        )

        return Response({
            "persona_count": personas.count(),
            "task_count": Task.objects.filter(project=project).count(),
            "schedules_active": ScheduledTask.objects.filter(project=project, status="active").count(),
            "schedules_paused": ScheduledTask.objects.filter(project=project, status="paused").count(),
            "devices_in_use": devices_in_use,
            "results_today": {
                "total": today_total,
                "successful": today_success,
                "failed": today_total - today_success,
            },
            "queue": {
                "queued": QueuedRun.objects.filter(project=project, status="queued").count(),
                "running": QueuedRun.objects.filter(project=project, status="running").count(),
            },
        })

    @action(detail=True, methods=["post"])
    def spawn_agents(self, request, pk=None):
        project = self.get_object()
        platform = request.data.get("platform", "instagram")

        # Find personas with assigned devices
        personas = Persona.objects.filter(project=project).exclude(assigned_device="")

        if not personas.exists():
            # Auto-match: assign available devices to unassigned personas
            from api.services import list_devices
            available_devices = [
                d["serial"] for d in list_devices()
                if d["status"] == "available"
            ]
            unassigned = Persona.objects.filter(project=project, assigned_device="")
            for persona, serial in zip(unassigned, available_devices):
                persona.assigned_device = serial
                persona.save(update_fields=["assigned_device"])
            personas = Persona.objects.filter(project=project).exclude(assigned_device="")

        if not personas.exists():
            return Response(
                {"error": "No personas with assigned devices and no available devices to auto-assign"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Determine starting port offset
        existing_ports = Agent.objects.filter(project=project).values_list("api_port", flat=True)
        next_port = max(existing_ports, default=8079) + 1

        created = []
        for persona in personas:
            agent, was_created = Agent.objects.get_or_create(
                project=project,
                device_serial=persona.assigned_device,
                defaults={
                    "persona": persona,
                    "platform": platform,
                    "api_port": next_port,
                },
            )
            if was_created:
                next_port += 1
                created.append(agent)

        serializer = AgentSerializer(created, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AgentViewSet(viewsets.ModelViewSet):
    serializer_class = AgentSerializer

    def get_queryset(self):
        qs = Agent.objects.select_related("persona").all()
        return qs.filter(**_project_filter(self.request))

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        agent = self.get_object()
        from api.scheduler import get_scheduler
        manager = get_scheduler().agent_manager
        result = manager.activate(
            agent_id=agent.id,
            platform=agent.platform,
            device_serial=agent.device_serial,
            port=agent.api_port,
        )
        if result.success:
            agent.status = "idle"
            agent.error_message = ""
            agent.save(update_fields=["status", "error_message"])
        else:
            agent.status = "error"
            agent.error_message = result.detail
            agent.save(update_fields=["status", "error_message"])
        return Response({"status": agent.status, "detail": result.detail})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        agent = self.get_object()
        from api.scheduler import get_scheduler
        manager = get_scheduler().agent_manager
        manager.deactivate(agent.id)
        agent.status = "offline"
        agent.current_action = ""
        agent.save(update_fields=["status", "current_action"])
        return Response({"status": "offline"})

    @action(detail=True, methods=["post"])
    def execute_action(self, request, pk=None):
        agent = self.get_object()
        action_name = request.data.get("action")
        target = request.data.get("target", "")
        text = request.data.get("text", "")
        max_comments = request.data.get("max_comments", 50)

        if not action_name:
            return Response(
                {"error": "action is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from api.scheduler import get_scheduler
        manager = get_scheduler().agent_manager
        handle = manager.get(agent.id)
        if not handle:
            return Response(
                {"error": "Agent not activated"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        agent.status = "busy"
        agent.current_action = action_name
        agent.save(update_fields=["status", "current_action"])

        api = handle.platform_api
        try:
            with handle.lock:
                if action_name == "like":
                    result = api.like_post(target)
                elif action_name == "comment":
                    result = api.comment_on_post(target, text)
                elif action_name == "save":
                    result = api.save_post(target)
                elif action_name == "follow":
                    result = api.follow_user(target)
                elif action_name == "scrape_comments":
                    result = api.scrape_comments(target, max_comments=max_comments)
                elif action_name == "scrape_profile":
                    result = api.scrape_profile(target)
                else:
                    result = None

            if result is None:
                agent.status = "idle"
                agent.current_action = ""
                agent.save(update_fields=["status", "current_action"])
                return Response(
                    {"error": f"Unknown action: {action_name}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if result.success:
                agent.actions_today += 1
                agent.total_actions += 1
            agent.status = "idle"
            agent.current_action = ""
            agent.last_activity_at = timezone.now()
            agent.save(update_fields=[
                "status", "current_action", "last_activity_at",
                "actions_today", "total_actions",
            ])
            return Response({
                "success": result.success,
                "detail": result.detail,
                "data": result.data,
            })
        except Exception as e:
            agent.status = "error"
            agent.current_action = ""
            agent.error_message = str(e)
            agent.save(update_fields=["status", "current_action", "error_message"])
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PersonaViewSet(viewsets.ModelViewSet):
    queryset = Persona.objects.prefetch_related("credentials").all()

    def get_serializer_class(self):
        if self.action == "list":
            return PersonaListSerializer
        return PersonaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(**_project_filter(self.request))

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
        target_artist = request.data.get("target_artist", None)
        project_id = request.data.get("project", None)

        # Look up the project's artist profile for enrichment
        artist_profile_data = None
        if project_id:
            try:
                project = Project.objects.get(id=project_id)
                if project.artist_profile and project.artist_profile.status == "completed":
                    artist_profile_data = project.artist_profile.profile_data
                    # Auto-fill target_artist from profile if not explicitly provided
                    if not target_artist and project.artist_profile.artist_name:
                        target_artist = project.artist_profile.artist_name
            except Project.DoesNotExist:
                pass

        from api.services import generate_personas
        circus_personas = generate_personas(
            count, services,
            niche=niche, tone=tone,
            age_min=age_min, age_max=age_max,
            genre=genre, archetype=archetype,
            target_artist=target_artist,
            artist_profile_data=artist_profile_data,
        )

        created = []
        for cp in circus_personas:
            persona = Persona.objects.create(
                id=cp.id,
                project_id=project_id,
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
                target_artist=cp.target_artist,
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

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(**_project_filter(self.request))

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
        variables = request.data.get("variables", None)

        if background:
            run = QueuedRun.objects.create(
                task=task,
                project=task.project,
                device_serial=device_serial or "",
                max_retries=task.retry_count,
            )
            return Response(
                {"queued_run_id": run.id, "status": "queued"},
                status=status.HTTP_202_ACCEPTED,
            )

        from api.services import run_task_on_device
        try:
            result_data = run_task_on_device(task, device_serial, variables=variables)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        # Save to DB
        TaskResult.objects.create(
            project=task.project,
            task_id=result_data["task_id"],
            task_name=task.name,
            device_serial=result_data["device_serial"],
            success=result_data["success"],
            actions_completed=result_data["actions_completed"],
            actions_total=result_data["actions_total"],
            duration=result_data["duration"],
            error=result_data.get("error"),
            screenshot_count=result_data.get("screenshot_count", 0),
            extraction_data=result_data.get("extraction_data", []),
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
                project=task.project,
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
        qs = TaskResult.objects.filter(**_project_filter(self.request))
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
def device_screen(request, serial):
    """Return latest JPEG screenshot for a device."""
    from api.scheduler import get_scheduler
    manager = get_scheduler().screen_manager
    frame = manager.get_frame(serial)
    if frame is None:
        return Response(
            {"error": "No frame available"}, status=status.HTTP_404_NOT_FOUND
        )
    return HttpResponse(frame, content_type="image/jpeg")


@api_view(["GET"])
def device_screen_stream(request, serial):
    """Return MJPEG stream for a device."""
    from api.scheduler import get_scheduler
    manager = get_scheduler().screen_manager
    return StreamingHttpResponse(
        manager.stream(serial),
        content_type="multipart/x-mixed-replace; boundary=frame",
    )


@api_view(["GET"])
def status_overview(request):
    from api.services import list_devices
    devices = list_devices()
    device_counts = {}
    for d in devices:
        s = d["status"]
        device_counts[s] = device_counts.get(s, 0) + 1

    pf = _project_filter(request)
    today = date.today()
    today_results = TaskResult.objects.filter(timestamp__date=today, **pf)
    today_total = today_results.count()
    today_success = today_results.filter(success=True).count()

    return Response({
        "personas": Persona.objects.filter(**pf).count(),
        "devices": {
            "total": len(devices),
            "by_status": device_counts,
        },
        "tasks": Task.objects.filter(**pf).count(),
        "results_today": {
            "total": today_total,
            "successful": today_success,
            "failed": today_total - today_success,
        },
        "schedules": ScheduledTask.objects.filter(status="active", **pf).count(),
        "queue": {
            "queued": QueuedRun.objects.filter(status="queued", **pf).count(),
            "running": QueuedRun.objects.filter(status="running", **pf).count(),
        },
        "warming": {
            "active": ScheduledTask.objects.filter(is_warming=True, status="active", **pf).exists(),
            "active_schedules": ScheduledTask.objects.filter(is_warming=True, status="active", **pf).count(),
        },
    })


# -- Schedule and Queue viewsets --


class ScheduledTaskViewSet(viewsets.ModelViewSet):
    queryset = ScheduledTask.objects.select_related("task", "persona").all()
    serializer_class = ScheduledTaskSerializer

    def get_queryset(self):
        qs = super().get_queryset().filter(**_project_filter(self.request))
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
        qs = QueuedRun.objects.select_related("task", "persona", "schedule").filter(
            **_project_filter(self.request)
        )
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
            project=task.project,
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
                project=persona.project,
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
