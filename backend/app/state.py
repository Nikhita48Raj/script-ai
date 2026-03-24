from __future__ import annotations

import threading
import time
from typing import Any, Dict, Optional


class InMemoryProjectStore:
    """
    Simple in-memory store for hackathon demos.

    Note: resets on server restart.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._projects: Dict[str, Dict[str, Any]] = {}

    def put(self, project_id: str, project: Dict[str, Any]) -> None:
        with self._lock:
            self._projects[project_id] = project

    def get(self, project_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._projects.get(project_id)

    def delete(self, project_id: str) -> None:
        with self._lock:
            if project_id in self._projects:
                del self._projects[project_id]


STORE = InMemoryProjectStore()

