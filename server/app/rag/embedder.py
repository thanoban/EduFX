import httpx

from app.core.config import get_settings


def embed(text: str) -> list[float]:
    """Embed text using Gemini text-embedding-004 with 384-dim output to match pgvector schema."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("gemini_api_key not set — cannot generate embeddings")

    response = httpx.post(
        "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
        params={"key": settings.gemini_api_key},
        json={
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": 384,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()["embedding"]["values"]
