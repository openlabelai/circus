from rest_framework import serializers

from api.models import Persona, ServiceCredential, Task, TaskResult


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
        fields = ["id", "name", "age", "username", "gender", "services", "assigned_device", "created_at"]

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
