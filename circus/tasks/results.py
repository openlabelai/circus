import json
import os
from datetime import date

from circus.tasks.runner import TaskResult


class ResultStore:
    def __init__(self, results_dir: str) -> None:
        self.results_dir = results_dir

    def _path_for_date(self, date_str: str) -> str:
        return os.path.join(self.results_dir, f"{date_str}.jsonl")

    def _to_record(self, result: TaskResult) -> dict:
        from datetime import datetime, timezone

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "task_id": result.task_id,
            "device_serial": result.device_serial,
            "success": result.success,
            "actions_completed": result.actions_completed,
            "actions_total": result.actions_total,
            "duration": round(result.duration, 2),
            "error": result.error,
            "screenshot_count": len(result.screenshots),
        }

    def save(self, result: TaskResult) -> str:
        """Append a result as a JSON line. Returns the file path."""
        today = date.today().isoformat()
        path = self._path_for_date(today)
        os.makedirs(self.results_dir, exist_ok=True)
        record = self._to_record(result)
        with open(path, "a") as f:
            f.write(json.dumps(record) + "\n")
        return path

    def load_today(self) -> list[dict]:
        return self.load_date(date.today().isoformat())

    def load_date(self, date_str: str) -> list[dict]:
        path = self._path_for_date(date_str)
        if not os.path.exists(path):
            return []
        results = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    results.append(json.loads(line))
        return results
