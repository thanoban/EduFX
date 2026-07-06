"""Retrieve relevant content chunks via pgvector similarity search.

Ranking is done client-side rather than through the `match_content_chunks`
Postgres RPC. Two problems were found with the RPC path:

1. PostgREST can't bind a raw JSON number array to pgvector's `vector`
   parameter type — it silently returns 200 + [] with no error. This is fixable
   by sending pgvector's own text format ("[0.1,0.2,...]") instead of a list.
2. Even with that fix, the RPC intermittently returns [] for a real,
   non-degenerate query embedding while the identical vector, run as a literal
   in a direct SQL query, returns correctly ranked matches every time —
   confirmed deterministic per-vector and unrelated to precision, string
   length, subtopic id, or connection pooling. Root cause undetermined (looks
   like a PostgREST/Supabase gateway-level inconsistency); measured ~50% empty
   rate across all 10 subtopics even after fix #1.

Given content_chunks is small (tens of rows per subtopic, not millions), a
server-side ANN index isn't needed anyway. A plain table SELECT was 100%
reliable in every test run during this investigation, so ranking is done here
in Python instead of depending on the flaky RPC.
"""
from __future__ import annotations

import math

from supabase import Client

from app.rag.embedder import embed


def _parse_embedding(raw: str) -> list[float]:
    return [float(value) for value in raw.strip("[]").split(",")]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def retrieve(query: str, subtopic_id: int, client: Client, top_k: int = 5) -> list[str]:
    """Return top-k matching chunk texts for the query, or [] on any failure."""
    try:
        # Embed the query as a QUERY (not a DOCUMENT) so it matches how the
        # stored chunks were embedded during ingest.
        query_embedding = embed(query, task_type="RETRIEVAL_QUERY")
    except Exception:
        return []

    try:
        result = (
            client.table("content_chunks")
            .select("chunk_text,embedding")
            .eq("subtopic_id", subtopic_id)
            .execute()
        )
        rows = result.data or []
    except Exception:
        return []

    scored: list[tuple[float, str]] = []
    for row in rows:
        embedding = row.get("embedding")
        if not embedding:
            continue
        try:
            chunk_embedding = _parse_embedding(embedding) if isinstance(embedding, str) else list(embedding)
            similarity = _cosine_similarity(query_embedding, chunk_embedding)
        except Exception:
            continue
        scored.append((similarity, row["chunk_text"]))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk_text for _, chunk_text in scored[:top_k]]
