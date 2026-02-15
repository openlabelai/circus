from datetime import date

from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from api.models import Persona, ServiceCredential, Task, TaskResult
from api.serializers import (
    PersonaListSerializer,
    PersonaSerializer,
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

        from api.services import generate_personas
        circus_personas = generate_personas(count, services)

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
    })
