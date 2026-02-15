import uuid

from django.db import models


def _short_uuid():
    return uuid.uuid4().hex[:8]


class Persona(models.Model):
    id = models.CharField(max_length=8, primary_key=True, default=_short_uuid)
    name = models.CharField(max_length=200, blank=True, default="")
    age = models.IntegerField(default=25)
    gender = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    username = models.CharField(max_length=200, blank=True, default="")
    bio = models.TextField(blank=True, default="")
    interests = models.JSONField(default=list)

    # Behavioral profile (flattened)
    engagement_style = models.CharField(max_length=20, default="passive")
    session_duration_min = models.IntegerField(default=5)
    session_duration_max = models.IntegerField(default=30)
    posting_frequency = models.CharField(max_length=20, default="daily")
    active_hours_start = models.IntegerField(default=9)
    active_hours_end = models.IntegerField(default=22)
    scroll_speed = models.CharField(max_length=20, default="medium")

    # Device assignment
    assigned_device = models.CharField(max_length=200, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.id} - {self.name}"


class ServiceCredential(models.Model):
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name="credentials")
    service_name = models.CharField(max_length=100)
    username = models.CharField(max_length=200, blank=True, default="")
    password = models.CharField(max_length=200, blank=True, default="")
    email = models.EmailField(blank=True, default="")

    class Meta:
        unique_together = ("persona", "service_name")
        ordering = ["service_name"]

    def __str__(self):
        return f"{self.persona_id}:{self.service_name}"


class Task(models.Model):
    id = models.CharField(max_length=8, primary_key=True, default=_short_uuid)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    target_package = models.CharField(max_length=300, blank=True, default="")
    timeout = models.FloatField(default=300.0)
    retry_count = models.IntegerField(default=0)
    actions = models.JSONField(default=list)
    source_file = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class TaskResult(models.Model):
    task_id = models.CharField(max_length=8)
    task_name = models.CharField(max_length=200, blank=True, default="")
    device_serial = models.CharField(max_length=200)
    success = models.BooleanField()
    actions_completed = models.IntegerField()
    actions_total = models.IntegerField()
    duration = models.FloatField()
    error = models.TextField(blank=True, null=True)
    screenshot_count = models.IntegerField(default=0)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        status = "OK" if self.success else "FAIL"
        return f"{self.task_id}@{self.device_serial} [{status}]"
