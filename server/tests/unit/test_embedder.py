from app.core.config import get_settings
from app.rag import embedder


def _reset_settings() -> None:
    get_settings.cache_clear()


class _FakeEmbedding:
    def __init__(self, values):
        self.values = values


class _FakeResponse:
    def __init__(self, values):
        self.embeddings = [_FakeEmbedding(values)]


class _FakeModels:
    def __init__(self, values):
        self._values = values

    def embed_content(self, **kwargs):
        return _FakeResponse(self._values)


class _FakeClient:
    def __init__(self, values):
        self.models = _FakeModels(values)


def test_embed_uses_vertex_when_project_configured(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    _reset_settings()

    import google.genai as real_genai

    def fake_client(**kwargs):
        assert kwargs.get("vertexai") is True
        return _FakeClient([0.1, 0.2, 0.3])

    monkeypatch.setattr(real_genai, "Client", fake_client)

    result = embedder.embed("hello world")
    assert result == [0.1, 0.2, 0.3]
    _reset_settings()


def test_embed_falls_back_to_gemini_api_key_when_vertex_call_fails(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    _reset_settings()

    import google.genai as real_genai

    def fake_client(**kwargs):
        if kwargs.get("vertexai"):
            raise RuntimeError("vertex call rejected")
        assert kwargs.get("api_key") == "test-key"
        return _FakeClient([0.9, 0.8])

    monkeypatch.setattr(real_genai, "Client", fake_client)

    result = embedder.embed("hello world")
    assert result == [0.9, 0.8]
    _reset_settings()


def test_embed_returns_empty_when_nothing_configured(monkeypatch):
    # Blank rather than delete: the real .env on disk sets GOOGLE_CLOUD_PROJECT,
    # and pydantic-settings falls back to reading the file when the OS env var
    # is merely absent, so delenv alone wouldn't actually unset it here.
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "")
    _reset_settings()

    result = embedder.embed("hello world")
    assert result == []
    _reset_settings()
