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

    # Character profile
    niche = models.CharField(max_length=100, blank=True, default="")
    tone = models.CharField(max_length=100, blank=True, default="")
    background_story = models.TextField(blank=True, default="")
    content_style = models.TextField(blank=True, default="")

    # Music fan profile
    genre = models.CharField(max_length=100, blank=True, default="")
    archetype = models.CharField(max_length=50, blank=True, default="")
    favorite_artists = models.JSONField(default=list, blank=True)
    music_discovery_style = models.CharField(max_length=100, blank=True, default="")
    comment_style = models.JSONField(default=dict, blank=True)
    bio_template = models.CharField(max_length=200, blank=True, default="")
    username_style = models.CharField(max_length=50, blank=True, default="")
    engagement_pattern = models.JSONField(default=dict, blank=True)
    content_behavior = models.JSONField(default=dict, blank=True)
    profile_aesthetic = models.CharField(max_length=50, blank=True, default="")
    artist_knowledge_depth = models.CharField(max_length=20, blank=True, default="")

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
    extraction_data = models.JSONField(default=list)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        status = "OK" if self.success else "FAIL"
        return f"{self.task_id}@{self.device_serial} [{status}]"


class LLMConfig(models.Model):
    PURPOSE_CHOICES = [
        ("persona_enrichment", "Persona Enrichment"),
        ("vision", "Vision & Recovery"),
        ("comment_generation", "Comment Generation"),
        ("content_generation", "Content Generation"),
    ]
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES, unique=True)
    provider = models.CharField(max_length=50, blank=True, default="")
    model = models.CharField(max_length=100, blank=True, default="")
    max_tokens = models.IntegerField(default=300)
    enabled = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.purpose} → {self.provider}/{self.model}"


class ProviderAPIKey(models.Model):
    provider = models.CharField(max_length=50, unique=True)
    api_key = models.CharField(max_length=500)

    def __str__(self):
        return self.provider


class ScheduledTask(models.Model):
    """A schedule that triggers task runs (cron, interval, or one-shot)."""

    TRIGGER_CHOICES = [
        ("cron", "Cron"),
        ("interval", "Interval"),
        ("once", "One-time"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("paused", "Paused"),
        ("expired", "Expired"),
    ]

    id = models.CharField(max_length=8, primary_key=True, default=_short_uuid)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="schedules")
    persona = models.ForeignKey(
        Persona,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedules",
    )
    device_serial = models.CharField(max_length=200, blank=True, default="")

    trigger_type = models.CharField(max_length=10, choices=TRIGGER_CHOICES)
    cron_expression = models.CharField(max_length=200, blank=True, default="")
    interval_seconds = models.IntegerField(default=0)
    run_at = models.DateTimeField(null=True, blank=True)

    respect_active_hours = models.BooleanField(default=True)
    is_warming = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")

    created_at = models.DateTimeField(auto_now_add=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.task.name} ({self.trigger_type})"


class QueuedRun(models.Model):
    """An individual task run instance with lifecycle tracking."""

    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("skipped", "Skipped"),
        ("cancelled", "Cancelled"),
    ]

    id = models.CharField(max_length=8, primary_key=True, default=_short_uuid)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="queued_runs")
    schedule = models.ForeignKey(
        ScheduledTask,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="runs",
    )
    persona = models.ForeignKey(
        Persona,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    device_serial = models.CharField(max_length=200, blank=True, default="")

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="queued")
    priority = models.IntegerField(default=0)
    attempt = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=0)

    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True, default="")

    result = models.ForeignKey(
        TaskResult, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ["-priority", "queued_at"]

    def __str__(self):
        return f"{self.task.name} [{self.status}]"
