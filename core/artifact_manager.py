import json
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional

class ArtifactManager:
    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir)
        self.workspace_dir.mkdir(parents=True, exist_ok=True)

    def write_artifact(self, name: str, content: Any):
        path = self.workspace_dir / name
        if isinstance(content, (dict, list)):
            path.write_text(json.dumps(content, indent=2))
        else:
            path.write_text(str(content))

    def write_code_file(self, path_str: str, content: str):
        full_path = self.workspace_dir / path_str.lstrip("/")
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content)

    def read_artifact(self, name: str) -> Optional[str]:
        path = self.workspace_dir / name
        if not path.exists():
            return None
        return path.read_text()

    def exists(self, name: str) -> bool:
        return (self.workspace_dir / name).exists()

    def list_artifacts(self) -> List[str]:
        return [p.name for p in self.workspace_dir.iterdir() if p.is_file()]

    def zip_project(self, output_name: str):
        zip_path = self.workspace_dir.parent / output_name
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for file in self.workspace_dir.rglob('*'):
                if file.is_file():
                    zipf.write(file, file.relative_to(self.workspace_dir))
        return zip_path

    def get_metadata(self, name: str) -> Dict[str, Any]:
        path = self.workspace_dir / name
        return {
            "name": name,
            "size": path.stat().st_size if path.exists() else 0,
            "modified": path.stat().st_mtime if path.exists() else 0
        }

    def get_context_for_agent(self, agent_id: str) -> str:
        return f"Context for {agent_id}"

    def list_all_projects(self) -> List[str]:
        return [self.workspace_dir.name]
