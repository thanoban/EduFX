"""Embed text via Google Gen AI — Vertex AI first (billing confirmed working),
Gemini API key as the free fallback."""


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

    Tries Vertex AI first (same model, verified working directly), then falls
    back to the free Gemini API key — never a hard dependency on either
    provider.
    """
    from google import genai

    from app.core.config import get_settings

    settings = get_settings()

    if settings.google_cloud_project:
        try:
            client = genai.Client(
                vertexai=True,
                project=settings.google_cloud_project,
                location=settings.google_cloud_location,
            )
            return _embed_with_client(client, text, task_type, settings)
        except Exception:
            pass

    if not settings.gemini_api_key:
        return []

    client = genai.Client(api_key=settings.gemini_api_key)
    return _embed_with_client(client, text, task_type, settings)
