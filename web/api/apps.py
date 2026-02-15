import os
import sys

from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        # Auto-start scheduler if enabled and not running migrations
        if os.environ.get('CIRCUS_SCHEDULER') == '1':
            # Skip during migrate, makemigrations, or other management commands
            is_manage = any(
                cmd in sys.argv
                for cmd in ['migrate', 'makemigrations', 'collectstatic', 'shell']
            )
            if not is_manage:
                from api.scheduler import get_scheduler
                scheduler = get_scheduler()
                scheduler.start()
