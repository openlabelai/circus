"""Management command to run the Circus scheduler in the foreground."""
import signal
import time

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Start the Circus task scheduler (runs in foreground, Ctrl+C to stop)"

    def handle(self, *args, **options):
        from api.scheduler import get_scheduler

        scheduler = get_scheduler()
        scheduler.start()
        self.stdout.write(self.style.SUCCESS("Circus scheduler running. Press Ctrl+C to stop."))

        # Handle graceful shutdown
        def _shutdown(signum, frame):
            self.stdout.write("\nShutting down scheduler...")
            scheduler.shutdown()
            raise SystemExit(0)

        signal.signal(signal.SIGINT, _shutdown)
        signal.signal(signal.SIGTERM, _shutdown)

        try:
            while True:
                time.sleep(1)
        except SystemExit:
            pass
