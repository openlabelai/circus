from django.conf import settings
from django.core.management.base import BaseCommand

from api.sync import import_personas_from_yaml, import_results_from_jsonl, import_tasks_from_yaml


class Command(BaseCommand):
    help = "Import existing personas, tasks, and results from file storage into the database."

    def handle(self, *args, **options):
        self.stdout.write("Importing personas...")
        p_count = import_personas_from_yaml(settings.CIRCUS_PERSONA_DIR)
        self.stdout.write(self.style.SUCCESS(f"  Imported {p_count} persona(s)"))

        self.stdout.write("Importing tasks...")
        t_count = import_tasks_from_yaml(settings.CIRCUS_TASK_DIR)
        self.stdout.write(self.style.SUCCESS(f"  Imported {t_count} task(s)"))

        self.stdout.write("Importing results...")
        r_count = import_results_from_jsonl(settings.CIRCUS_RESULTS_DIR)
        self.stdout.write(self.style.SUCCESS(f"  Imported {r_count} result(s)"))

        self.stdout.write(self.style.SUCCESS("Done."))
