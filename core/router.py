from typing import List, Dict, Any

class Router:
    def __init__(self):
        self.agent_registry = self._initialize_registry()
        self.workflow_presets = {
            "web_app": ["architect", "coder", "reviewer"],
            "api_only": ["architect", "coder"],
            "full_stack": ["architect", "coder", "coder", "reviewer", "manager"]
        }

    def _initialize_registry(self) -> Dict[str, Dict[str, Any]]:
        # Requirement: registry should have 16 agents
        agents = [
            "architect", "coder", "reviewer", "manager",
            "tester", "deployer", "researcher", "documenter",
            "security_expert", "database_admin", "frontend_lead", "backend_lead",
            "devops_engineer", "qa_lead", "product_owner", "ux_designer"
        ]
        return {name: {"status": "active", "version": "1.0.0"} for name in agents}

    def get_agents_for_workflow(self, workflow_name: str) -> List[str]:
        return self.workflow_presets.get(workflow_name, ["architect", "coder"])

    def route_task(self, task: str) -> str:
        if "frontend" in task.lower():
            return "frontend_lead"
        if "backend" in task.lower():
            return "backend_lead"
        return "architect"
