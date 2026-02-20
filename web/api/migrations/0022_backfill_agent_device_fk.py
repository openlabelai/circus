"""Backfill Agent.device FK from Agent.device_serial for existing agents."""

from django.db import migrations


def backfill_agent_device(apps, schema_editor):
    Agent = apps.get_model("api", "Agent")
    Device = apps.get_model("api", "Device")

    for agent in Agent.objects.exclude(device_serial="").filter(device__isnull=True):
        try:
            device = Device.objects.get(serial=agent.device_serial)
            agent.device = device
            agent.save(update_fields=["device"])
        except Device.DoesNotExist:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0021_device_agent_device_proxy_agent_proxy"),
    ]

    operations = [
        migrations.RunPython(backfill_agent_device, migrations.RunPython.noop),
    ]
