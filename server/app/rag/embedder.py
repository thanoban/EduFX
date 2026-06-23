"""Embed text via Vertex AI text-embedding-004 (384-dim output to match pgvector schema)."""


def embed(text: str) -> list[float]:
    from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel

    model = TextEmbeddingModel.from_pretrained("text-embedding-004")
    inputs = [TextEmbeddingInput(text, "RETRIEVAL_DOCUMENT")]
    embeddings = model.get_embeddings(inputs, output_dimensionality=384)
    return list(embeddings[0].values)
