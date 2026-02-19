"""Abstract base class for platform APIs."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ActionResult:
    success: bool
    detail: str = ""
    data: dict | list | None = None


class PlatformAPI(ABC):
    """Interface for platform-specific API drivers."""

    @abstractmethod
    def connect(self, device_serial: str, port: int = 8080) -> ActionResult:
        """Connect to a device and start the platform API server."""

    @abstractmethod
    def disconnect(self) -> ActionResult:
        """Disconnect from the device."""

    @abstractmethod
    def is_connected(self) -> bool:
        """Check if the API is connected and responsive."""

    @abstractmethod
    def like_post(self, media_id: str) -> ActionResult:
        """Like a post by media ID."""

    @abstractmethod
    def comment_on_post(self, media_id: str, text: str) -> ActionResult:
        """Comment on a post."""

    @abstractmethod
    def save_post(self, media_id: str) -> ActionResult:
        """Save/bookmark a post."""

    @abstractmethod
    def follow_user(self, user_id: str) -> ActionResult:
        """Follow a user."""

    @abstractmethod
    def scrape_comments(self, media_id: str, max_comments: int = 50) -> ActionResult:
        """Scrape comments from a post."""

    @abstractmethod
    def scrape_profile(self, username: str) -> ActionResult:
        """Scrape a user's profile info."""
