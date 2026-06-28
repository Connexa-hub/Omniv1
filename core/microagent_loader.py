from typing import List, Dict, Optional

class MicroagentLoader:
    def __init__(self):
        self.microagents = [
            {"id": "auth-guard", "trigger": "authentication", "context": "Guidance for secure auth flows."},
            {"id": "db-optimizer", "trigger": "database query", "context": "Guidance for efficient SQL indexing."},
            {"id": "ui-motion", "trigger": "animation", "context": "Guidance for fluid motion/react transitions."}
        ]

    def get_context(self, task_description: str) -> Optional[str]:
        for agent in self.microagents:
            if agent["trigger"] in task_description.lower():
                return agent["context"]
        return None
