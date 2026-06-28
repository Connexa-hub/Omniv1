import unittest
import os
import shutil
import json
from pathlib import Path
from core.memory import CompanyMemory
from core.llm_provider import LLMProvider, _get_models_for_agent
from core.artifact_manager import ArtifactManager

class TestCompanyMemory(unittest.TestCase):
    def setUp(self):
        self.test_dir = "/tmp/test_memory"
        self.memory = CompanyMemory(self.test_dir)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_save_bug(self):
        # This was the failing test case
        bug_entry = {
            "id": "BUG-123",
            "tags": {"critical", "ui", "fix-needed"} # Set type
        }
        self.memory.save_bug("123", bug_entry)
        
        path = Path(self.test_dir) / "bug_123.json"
        self.assertTrue(path.exists())
        data = json.loads(path.read_text())
        self.assertIsInstance(data["tags"], list)
        self.assertIn("critical", data["tags"])

    def test_save_project(self):
        # This was also failing
        project_record = {
            "name": "Project Omni",
            "stack": {"react", "express", "typescript"} # Set type
        }
        self.memory.save_project("omni", project_record)
        
        path = Path(self.test_dir) / "project_omni.json"
        self.assertTrue(path.exists())
        data = json.loads(path.read_text())
        self.assertIsInstance(data["stack"], list)

class TestLLMProvider(unittest.TestCase):
    def test_get_models_for_agent(self):
        # Testing the previously missing import/function
        models = _get_models_for_agent("architect")
        self.assertIn("gemini-2.0-flash", models)

    def test_get_models_for_unknown_agent(self):
        models = _get_models_for_agent("unknown")
        self.assertEqual(models, ["gemini-2.0-flash"])

class TestArtifactManager(unittest.TestCase):
    def setUp(self):
        self.test_dir = "/tmp/test_workspace"
        self.manager = ArtifactManager(self.test_dir)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_write_and_read(self):
        self.manager.write_artifact("test.txt", "hello")
        self.assertEqual(self.manager.read_artifact("test.txt"), "hello")

if __name__ == "__main__":
    unittest.main()
