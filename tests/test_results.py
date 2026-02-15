import json
import os
from datetime import date
from unittest.mock import patch

import pytest

from circus.tasks.results import ResultStore
from circus.tasks.runner import TaskResult


def _make_result(**kwargs) -> TaskResult:
    defaults = {
        "task_id": "abc123",
        "device_serial": "DEV001",
        "success": True,
        "actions_completed": 5,
        "actions_total": 5,
        "duration": 3.14,
        "error": None,
        "screenshots": [],
    }
    defaults.update(kwargs)
    return TaskResult(**defaults)


class TestResultStore:
    def test_save_creates_file(self, tmp_path):
        store = ResultStore(str(tmp_path))
        result = _make_result()
        path = store.save(result)
        assert os.path.exists(path)
        with open(path) as f:
            record = json.loads(f.readline())
        assert record["task_id"] == "abc123"
        assert record["success"] is True
        assert record["duration"] == 3.14

    def test_save_appends_multiple(self, tmp_path):
        store = ResultStore(str(tmp_path))
        store.save(_make_result(task_id="a"))
        store.save(_make_result(task_id="b"))
        store.save(_make_result(task_id="c"))
        records = store.load_today()
        assert len(records) == 3
        assert [r["task_id"] for r in records] == ["a", "b", "c"]

    def test_load_today(self, tmp_path):
        store = ResultStore(str(tmp_path))
        store.save(_make_result())
        records = store.load_today()
        assert len(records) == 1

    def test_load_date_missing(self, tmp_path):
        store = ResultStore(str(tmp_path))
        records = store.load_date("2020-01-01")
        assert records == []

    def test_load_date_specific(self, tmp_path):
        store = ResultStore(str(tmp_path))
        # Write a file for a specific date
        target = "2025-06-15"
        path = os.path.join(str(tmp_path), f"{target}.jsonl")
        with open(path, "w") as f:
            f.write(json.dumps({"task_id": "x", "success": True}) + "\n")
        records = store.load_date(target)
        assert len(records) == 1
        assert records[0]["task_id"] == "x"

    def test_record_fields(self, tmp_path):
        store = ResultStore(str(tmp_path))
        result = _make_result(error="boom", success=False, actions_completed=2)
        store.save(result)
        rec = store.load_today()[0]
        assert rec["error"] == "boom"
        assert rec["success"] is False
        assert rec["actions_completed"] == 2
        assert rec["screenshot_count"] == 0
        assert "timestamp" in rec
