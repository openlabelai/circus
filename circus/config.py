from dataclasses import dataclass, field
import os


@dataclass
class Config:
    adb_path: str = field(
        default_factory=lambda: os.getenv("CIRCUS_ADB_PATH", "adb")
    )
    task_dir: str = field(
        default_factory=lambda: os.getenv("CIRCUS_TASK_DIR", "./tasks")
    )
    screenshot_dir: str = field(
        default_factory=lambda: os.getenv("CIRCUS_SCREENSHOT_DIR", "./screenshots")
    )
    persona_dir: str = field(
        default_factory=lambda: os.getenv("CIRCUS_PERSONA_DIR", "./personas")
    )
    results_dir: str = field(
        default_factory=lambda: os.getenv("CIRCUS_RESULTS_DIR", "./results")
    )
    default_timeout: float = 30.0
    action_delay: float = 0.5
