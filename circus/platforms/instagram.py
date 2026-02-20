"""Instagram platform API backed by instagrab."""
from __future__ import annotations

import logging
from dataclasses import asdict

from .base import ActionResult, PlatformAPI

logger = logging.getLogger(__name__)


class InstagramPlatformAPI(PlatformAPI):
    """Wraps instagrab's HttpDriver, PostInteractor, and extractors."""

    def __init__(self):
        self._driver = None
        self._settings = None
        self._interactor = None
        self._extractor = None
        self._device_serial: str | None = None

    def connect(self, device_serial: str, port: int = 8080) -> ActionResult:
        try:
            from instagrab.config import Settings
            from instagrab.device.http_driver import HttpDriver
            from instagrab.extraction.hybrid import HybridExtractor
            from instagrab.instagram.interactions import PostInteractor

            self._settings = Settings(
                device_serial=device_serial,
                apk_port=port,
            )
            self._driver = HttpDriver(port=port)
            self._driver.connect(device_serial)
            self._extractor = HybridExtractor(self._driver, self._settings)
            self._interactor = PostInteractor(self._driver, self._settings)
            self._device_serial = device_serial
            logger.info("Instagram API connected to %s:%d", device_serial, port)
            return ActionResult(success=True, detail=f"Connected to {device_serial}")
        except ImportError:
            return ActionResult(success=False, detail="instagrab not installed")
        except Exception as e:
            logger.error("Failed to connect Instagram API: %s", e)
            return ActionResult(success=False, detail=str(e))

    def disconnect(self) -> ActionResult:
        try:
            self._driver = None
            self._extractor = None
            self._interactor = None
            self._settings = None
            self._device_serial = None
            return ActionResult(success=True, detail="Disconnected")
        except Exception as e:
            return ActionResult(success=False, detail=str(e))

    def is_connected(self) -> bool:
        if not self._driver:
            return False
        try:
            import requests
            resp = requests.get(
                f"http://127.0.0.1:{self._driver._port}/health",
                timeout=2.0,
            )
            return resp.ok
        except Exception:
            return False

    def like_post(self, media_id: str) -> ActionResult:
        if not self._interactor:
            return ActionResult(success=False, detail="Not connected")
        try:
            result = self._interactor.like_post(media_id)
            return ActionResult(
                success=result.success,
                detail=result.detail,
                data={"verified": result.verified, "shortcode": result.shortcode},
            )
        except Exception as e:
            logger.error("like_post failed: %s", e)
            return ActionResult(success=False, detail=str(e))

    def comment_on_post(self, media_id: str, text: str) -> ActionResult:
        if not self._interactor:
            return ActionResult(success=False, detail="Not connected")
        try:
            result = self._interactor.comment_on_post(media_id, text)
            return ActionResult(
                success=result.success,
                detail=result.detail,
                data={"verified": result.verified, "shortcode": result.shortcode},
            )
        except Exception as e:
            logger.error("comment_on_post failed: %s", e)
            return ActionResult(success=False, detail=str(e))

    def save_post(self, media_id: str) -> ActionResult:
        if not self._interactor:
            return ActionResult(success=False, detail="Not connected")
        try:
            result = self._interactor.save_post(media_id)
            return ActionResult(
                success=result.success,
                detail=result.detail,
                data={"verified": result.verified, "shortcode": result.shortcode},
            )
        except Exception as e:
            logger.error("save_post failed: %s", e)
            return ActionResult(success=False, detail=str(e))

    def follow_user(self, user_id: str) -> ActionResult:
        # Instagrab doesn't have a follow implementation yet
        return ActionResult(success=False, detail="follow_user not yet implemented in instagrab")

    def scrape_comments(self, media_id: str, max_comments: int = 50) -> ActionResult:
        if not self._driver or not self._extractor:
            return ActionResult(success=False, detail="Not connected")
        try:
            from instagrab.instagram.comments import CommentScraper

            scraper = CommentScraper(self._driver, self._extractor, self._settings)
            comments = scraper.scrape_comments(media_id, max_comments=max_comments)
            return ActionResult(
                success=True,
                detail=f"Scraped {len(comments)} comments",
                data=[
                    {"username": c.username, "text": c.text, "likes": c.likes,
                     "timestamp": c.timestamp, "confidence": c.confidence}
                    for c in comments
                ],
            )
        except ImportError:
            return ActionResult(success=False, detail="instagrab CommentScraper not available")
        except Exception as e:
            logger.error("scrape_comments failed: %s", e)
            return ActionResult(success=False, detail=str(e))

    def scrape_profile(self, username: str) -> ActionResult:
        if not self._driver or not self._extractor:
            return ActionResult(success=False, detail="Not connected")
        try:
            from instagrab.instagram.profiles import ProfileScraper

            scraper = ProfileScraper(self._driver, self._extractor, self._settings)
            profile = scraper.scrape_profile(username)
            return ActionResult(
                success=True,
                detail=f"Scraped profile @{username}",
                data={
                    "username": profile.username,
                    "full_name": profile.full_name,
                    "bio": profile.bio,
                    "follower_count": profile.follower_count,
                    "following_count": profile.following_count,
                    "post_count": profile.post_count,
                    "is_private": profile.is_private,
                    "is_verified": profile.is_verified,
                },
            )
        except ImportError:
            return ActionResult(success=False, detail="instagrab ProfileScraper not available")
        except Exception as e:
            logger.error("scrape_profile failed: %s", e)
            return ActionResult(success=False, detail=str(e))
