import json
from pathlib import Path
from typing import Any, Dict, List, Set, Union

class CompanyMemory:
    def __init__(self, memory_dir: str):
        self.memory_dir = Path(memory_dir)
        self.memory_dir.mkdir(parents=True, exist_ok=True)

    def _serialize(self, obj: Any) -> Any:
        if isinstance(obj, set):
            return list(obj)
        if isinstance(obj, dict):
            return {k: self._serialize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._serialize(i) for i in obj]
        return obj

    def save_project(self, project_id: str, record: Dict[str, Any]):
        path = self.memory_dir / f"project_{project_id}.json"
        # Fix: Ensure sets are serializable
        serialized_record = self._serialize(record)
        path.write_text(json.dumps(serialized_record, indent=2))

    def save_bug(self, bug_id: str, entry: Dict[str, Any]):
        path = self.memory_dir / f"bug_{bug_id}.json"
        # Fix: Ensure sets are serializable
        serialized_entry = self._serialize(entry)
        path.write_text(json.dumps(serialized_entry, indent=2))

    def save_lesson(self, lesson_id: str, content: str):
        path = self.memory_dir / f"lesson_{lesson_id}.json"
        path.write_text(json.dumps({"content": content}, indent=2))

    def get_stats(self):
        return {"total_files": len(list(self.memory_dir.glob("*.json")))}

    def get_relevant_context(self, query: str):
        return []

    def extract_keywords(self, text: str) -> Set[str]:
        return set(text.lower().split())
