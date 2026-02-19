"""Agent manager — holds active platform API instances per agent."""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field

from .base import ActionResult, PlatformAPI
from .instagram import InstagramPlatformAPI

logger = logging.getLogger(__name__)

PLATFORM_CLASSES: dict[str, type[PlatformAPI]] = {
    "instagram": InstagramPlatformAPI,
}


@dataclass
class AgentHandle:
    agent_id: str
    platform_api: PlatformAPI
    lock: threading.Lock = field(default_factory=threading.Lock)


class AgentManager:
    """Singleton-style manager for active agent handles."""

    def __init__(self):
        self._handles: dict[str, AgentHandle] = {}
        self._lock = threading.Lock()

    def activate(self, agent_id: str, platform: str, device_serial: str, port: int = 8080) -> ActionResult:
        """Create a platform API instance and connect it to a device."""
        cls = PLATFORM_CLASSES.get(platform)
        if not cls:
            return ActionResult(success=False, detail=f"Unsupported platform: {platform}")

        # Deactivate existing handle if any
        if agent_id in self._handles:
            self.deactivate(agent_id)

        api = cls()
        result = api.connect(device_serial, port=port)
        if result.success:
            with self._lock:
                self._handles[agent_id] = AgentHandle(agent_id=agent_id, platform_api=api)
            logger.info(f"Agent {agent_id} activated on {device_serial}")
        return result

    def deactivate(self, agent_id: str) -> ActionResult:
        """Disconnect and remove an agent handle."""
        with self._lock:
            handle = self._handles.pop(agent_id, None)
        if not handle:
            return ActionResult(success=True, detail="Agent not active")
        result = handle.platform_api.disconnect()
        logger.info(f"Agent {agent_id} deactivated")
        return result

    def get(self, agent_id: str) -> AgentHandle | None:
        """Get an active agent handle."""
        return self._handles.get(agent_id)

    def deactivate_all(self) -> None:
        """Disconnect all active agents."""
        with self._lock:
            agent_ids = list(self._handles.keys())
        for agent_id in agent_ids:
            self.deactivate(agent_id)
        logger.info("All agents deactivated")
