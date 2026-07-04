"""Retrieve relevant content chunks via pgvector similarity search."""
from __future__ import annotations

from supabase import Client

from app.rag.embedder import embed


def retrieve(query: str, subtopic_id: int, client: Client, top_k: int = 5) -> list[str]:
    """Return top-k matching chunk texts for the query, or [] on any failure."""
    try:
        # Embed the query as a QUERY (not a DOCUMENT) so it matches how the
        # stored chunks were embedded during ingest.
        query_embedding = embed(query, task_type="RETRIEVAL_QUERY")
    except Exception:
        return []

    try:
        result = client.rpc(
            "match_content_chunks",
            {
                "query_embedding": query_embedding,
                "match_subtopic_id": subtopic_id,
                "match_count": top_k,
            },
        ).execute()
        return [row["chunk_text"] for row in (result.data or [])]
    except Exception:
        return []
