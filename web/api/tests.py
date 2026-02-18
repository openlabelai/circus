from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from api.models import ArtistProfile, Task


class ArtistProfileFetchCommentsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_instagram_fetch_comments_syncs_tasks_and_normalizes_handle(self):
        profile = ArtistProfile.objects.create(
            artist_name="Test Artist",
            instagram_handle=" @openlabel.ai ",
        )
        Task.objects.create(
            name="scrape_instagram_comments",
            actions=[{"action": "sleep", "duration": 0.01}],
        )

        with (
            patch("api.sync.import_tasks_from_yaml") as mock_sync,
            patch("api.services.run_task_on_device") as mock_run,
        ):
            mock_run.return_value = {
                "task_id": "abc12345",
                "device_serial": "TEST001",
                "success": True,
                "actions_completed": 1,
                "actions_total": 1,
                "duration": 1.0,
                "error": None,
                "screenshot_count": 0,
                "extraction_data": [],
            }

            res = self.client.post(
                f"/api/artist-profiles/{profile.id}/fetch_comments/",
                {"source": "instagram", "intensity": "mid"},
                format="json",
            )

        self.assertEqual(res.status_code, 200)
        mock_sync.assert_called_once()
        self.assertTrue(mock_run.called)
        call_kwargs = mock_run.call_args.kwargs
        self.assertEqual(call_kwargs["variables"]["instagram_handle"], "openlabel.ai")
        self.assertEqual(call_kwargs["variables"]["post_count"], "3")
