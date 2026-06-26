from pathlib import Path
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Tests must never inherit local live credentials from .env. Keep them fast,
# repeatable, and isolated from the developer's Supabase/Vertex projects.
os.environ["DATA_BACKEND"] = "memory"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["GOOGLE_CLOUD_PROJECT"] = ""

from app.main import app


def create_student(client: TestClient, suffix: str = "default") -> int:
    response = client.post(
        "/auth/google",
        headers={"Authorization": f"Bearer demo:Test User:test-{suffix}@edufx.demo"},
    )
    assert response.status_code == 200
    return response.json()["data"]["student_id"]
