"""Instagram platform API backed by instagrab."""
from __future__ import annotations

import logging

from .base import ActionResult, PlatformAPI

logger = logging.getLogger(__name__)


class InstagramPlatformAPI(PlatformAPI):
    """Wraps instagrab's HttpDriver and extractors for Instagram automation."""

    def __init__(self):
        self._driver = None
        self._extractor = None
        self._device_serial: str | None = None

    def connect(self, device_serial: str, port: int = 8080) -> ActionResult:
        try:
            from instagrab.driver import HttpDriver
            from instagrab.extractor import HybridExtractor

            self._driver = HttpDriver(device_serial, port=port)
            self._driver.start()
            self._extractor = HybridExtractor(self._driver)
            self._device_serial = device_serial
            logger.info(f"Instagram API connected to {device_serial}:{port}")
            return ActionResult(success=True, detail=f"Connected to {device_serial}")
        except ImportError:
            return ActionResult(success=False, detail="instagrab not installed")
        except Exception as e:
            logger.error(f"Failed to connect Instagram API: {e}")
            return ActionResult(success=False, detail=str(e))

    def disconnect(self) -> ActionResult:
        try:
            if self._driver:
                self._driver.stop()
                self._driver = None
                self._extractor = None
            self._device_serial = None
            return ActionResult(success=True, detail="Disconnected")
        except Exception as e:
            return ActionResult(success=False, detail=str(e))

    def is_connected(self) -> bool:
        if not self._driver:
            return False
        try:
            return self._driver.is_alive()
        except Exception:
            return False

    def like_post(self, media_id: str) -> ActionResult:
        return ActionResult(success=False, detail="Not yet implemented")

    def comment_on_post(self, media_id: str, text: str) -> ActionResult:
        return ActionResult(success=False, detail="Not yet implemented")

    def save_post(self, media_id: str) -> ActionResult:
        return ActionResult(success=False, detail="Not yet implemented")

    def follow_user(self, user_id: str) -> ActionResult:
        return ActionResult(success=False, detail="Not yet implemented")

    def scrape_comments(self, media_id: str, max_comments: int = 50) -> ActionResult:
        if not self._extractor:
            return ActionResult(success=False, detail="Not connected")
        try:
            from instagrab.comments import CommentScraper

            scraper = CommentScraper(self._driver, self._extractor)
            comments = scraper.scrape(media_id, max_comments=max_comments)
            return ActionResult(
                success=True,
                detail=f"Scraped {len(comments)} comments",
                data=comments,
            )
        except ImportError:
            return ActionResult(success=False, detail="instagrab CommentScraper not available")
        except Exception as e:
            return ActionResult(success=False, detail=str(e))

    def scrape_profile(self, username: str) -> ActionResult:
        if not self._extractor:
            return ActionResult(success=False, detail="Not connected")
        try:
            profile = self._extractor.extract_profile(username)
            return ActionResult(success=True, data=profile)
        except Exception as e:
            return ActionResult(success=False, detail=str(e))
