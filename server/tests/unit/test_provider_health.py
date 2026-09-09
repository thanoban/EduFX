from fastapi.testclient import TestClient

from app.main import app


def test_provider_health_does_not_expose_credentials():
    response = TestClient(app).get("/health/providers")

    assert response.status_code == 200
    payload = response.json()
    assert payload["text_provider_order"] == ["vertex", "gemini", "groq"]
    assert payload["groq_configured"] is False
    assert payload["vertex_enabled"] is False
    assert payload["embedding_provider"] == "none"
    assert "api_key" not in payload
