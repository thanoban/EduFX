from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


def create_student(client: TestClient, suffix: str = "default") -> int:
    response = client.post(
        "/auth/google",
        headers={"Authorization": f"Bearer demo:Test User:test-{suffix}@edufx.demo"},
    )
    assert response.status_code == 200
    return response.json()["data"]["student_id"]
