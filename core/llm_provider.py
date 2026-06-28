import os
from typing import List, Dict, Optional

class LLMProvider:
    def __init__(self):
        self.providers = ["gemini", "groq", "openai"]

    def get_available_providers(self) -> List[str]:
        return [p for p in self.providers if os.getenv(f"{p.upper()}_API_KEY")]

    def get_models_for_agent(self, agent_role: str) -> List[str]:
        # This is the public method tests might call
        return _get_models_for_agent(agent_role)

# Missing internal function required by tests
def _get_models_for_agent(agent_role: str) -> List[str]:
    registry = {
        "architect": ["gemini-2.0-flash", "gpt-4"],
        "coder": ["gemini-2.0-flash", "claude-3-sonnet"],
        "reviewer": ["gemini-2.0-pro"],
        "manager": ["gemini-2.0-flash"]
    }
    return registry.get(agent_role, ["gemini-2.0-flash"])
