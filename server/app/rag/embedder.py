"""Embed text via Google Gen AI on Vertex AI."""


def embed(text: str) -> list[float]:
    from google import genai
    from google.genai import types

    from app.core.config import get_settings

    settings = get_settings()
    if not settings.google_cloud_project:
        return []

    client = genai.Client(
        vertexai=True,
        project=settings.google_cloud_project,
        location=settings.google_cloud_location,
    )
    response = client.models.embed_content(
        model=settings.embedding_model,
        contents=[text],
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=settings.embedding_dimensions,
        ),
    )
    return list(response.embeddings[0].values)
