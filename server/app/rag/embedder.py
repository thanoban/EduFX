"""Embed text via Google Gen AI — Gemini API key first, Vertex AI as fallback."""


def _embed_with_client(client, text: str, task_type: str, settings) -> list[float]:
    from google.genai import types

    response = client.models.embed_content(
        model=settings.embedding_model,
        contents=[text],
        config=types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=settings.embedding_dimensions,
        ),
    )
    return list(response.embeddings[0].values)


def embed(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Embed a single string.

    Use the default ``RETRIEVAL_DOCUMENT`` when storing chunks (ingest), and
    ``RETRIEVAL_QUERY`` when embedding a search query at retrieval time. Mixing
    the two task types degrades similarity scores, so callers must pass the one
    that matches their side of the search.

    Tries the free Gemini API key first (same model, same output dimensions,
    no Vertex billing dependency), then falls back to Vertex AI so this starts
    working again automatically once billing is restored — never a hard
    dependency on either provider.
    """
    from google import genai

    from app.core.config import get_settings

    settings = get_settings()

    if settings.gemini_api_key:
        try:
            client = genai.Client(api_key=settings.gemini_api_key)
            return _embed_with_client(client, text, task_type, settings)
        except Exception:
            pass

    if not settings.google_cloud_project:
        return []

    client = genai.Client(
        vertexai=True,
        project=settings.google_cloud_project,
        location=settings.google_cloud_location,
    )
    return _embed_with_client(client, text, task_type, settings)
