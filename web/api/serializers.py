from rest_framework import serializers

from api.models import (
    ArtistProfile, LLMConfig, Persona, Project, QueuedRun,
    ScheduledTask, ServiceCredential, Task, TaskResult,
)


class ArtistProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArtistProfile
        fields = "__all__"
        read_only_fields = [
            "id", "profile_data", "raw_profile_text",
            "status", "error_message", "created_at", "updated_at",
        ]


class ArtistProfileSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for embedding in project responses."""
    class Meta:
        model = ArtistProfile
        fields = ["id", "artist_name", "genre", "platform", "status"]


class ProjectSerializer(serializers.ModelSerializer):
    persona_count = serializers.IntegerField(read_only=True, default=0)
    task_count = serializers.IntegerField(read_only=True, default=0)
    schedule_count = serializers.IntegerField(read_only=True, default=0)
    active_schedule_count = serializers.IntegerField(read_only=True, default=0)
    artist_profile_detail = ArtistProfileSummarySerializer(source="artist_profile", read_only=True)

    class Meta:
        model = Project
        fields = "__all__"


class ServiceCredentialSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCredential
        fields = ["id", "service_name", "username", "password", "email"]
        extra_kwargs = {"id": {"required": False}}


class PersonaSerializer(serializers.ModelSerializer):
    credentials = ServiceCredentialSerializer(many=True, required=False)

    class Meta:
        model = Persona
        fields = "__all__"

    def create(self, validated_data):
        credentials_data = validated_data.pop("credentials", [])
        persona = Persona.objects.create(**validated_data)
        for cred in credentials_data:
            ServiceCredential.objects.create(persona=persona, **cred)
        return persona

    def update(self, instance, validated_data):
        credentials_data = validated_data.pop("credentials", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if credentials_data is not None:
            instance.credentials.all().delete()
            for cred in credentials_data:
                ServiceCredential.objects.create(persona=instance, **cred)

        # Dual-write: export to YAML for CLI compatibility
        from api.sync import export_persona_to_yaml
        export_persona_to_yaml(instance)

        return instance


class PersonaListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""
    services = serializers.SerializerMethodField()

    class Meta:
        model = Persona
        fields = ["id", "name", "age", "username", "gender", "niche", "tone", "genre", "archetype", "services", "assigned_device", "created_at"]

    def get_services(self, obj):
        return list(obj.credentials.values_list("service_name", flat=True))


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"


class TaskResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskResult
        fields = "__all__"


class ScheduledTaskSerializer(serializers.ModelSerializer):
    task_name = serializers.CharField(source="task.name", read_only=True)
    persona_name = serializers.CharField(source="persona.name", read_only=True, default="")

    class Meta:
        model = ScheduledTask
        fields = "__all__"
        read_only_fields = ["id", "created_at", "last_run_at", "next_run_at", "is_warming"]

    def validate(self, data):
        trigger = data.get("trigger_type", getattr(self.instance, "trigger_type", None))
        if trigger == "cron" and not data.get(
            "cron_expression", getattr(self.instance, "cron_expression", "")
        ):
            raise serializers.ValidationError(
                {"cron_expression": "Required for cron trigger type."}
            )
        if trigger == "interval" and not data.get(
            "interval_seconds", getattr(self.instance, "interval_seconds", 0)
        ):
            raise serializers.ValidationError(
                {"interval_seconds": "Required for interval trigger type."}
            )
        if trigger == "once" and not data.get(
            "run_at", getattr(self.instance, "run_at", None)
        ):
            raise serializers.ValidationError(
                {"run_at": "Required for one-time trigger type."}
            )
        return data


class QueuedRunSerializer(serializers.ModelSerializer):
    task_name = serializers.CharField(source="task.name", read_only=True)
    persona_name = serializers.CharField(source="persona.name", read_only=True, default="")
    schedule_id = serializers.CharField(source="schedule.id", read_only=True, default="")

    class Meta:
        model = QueuedRun
        fields = "__all__"
        read_only_fields = [
            "id", "status", "attempt", "queued_at", "started_at",
            "completed_at", "error", "result",
        ]


class LLMConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = LLMConfig
        fields = "__all__"


class ProviderAPIKeySerializer(serializers.Serializer):
    provider = serializers.CharField()
    api_key = serializers.CharField(write_only=True)


class QueuedRunCreateSerializer(serializers.Serializer):
    task_id = serializers.CharField()
    device_serial = serializers.CharField(required=False, default="")
    persona_id = serializers.CharField(required=False, default="")
    priority = serializers.IntegerField(required=False, default=0)


