"""Retrieve relevant content chunks via vector similarity, then lexical search.

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
import re

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


def _lexical_score(query: str, chunk: str) -> float:
    query_terms = set(re.findall(r"[a-z0-9]+", query.lower()))
    if not query_terms:
        return 0.0
    chunk_terms = re.findall(r"[a-z0-9]+", chunk.lower())
    if not chunk_terms:
        return 0.0
    chunk_term_set = set(chunk_terms)
    overlap = len(query_terms & chunk_term_set)
    density = overlap / max(len(query_terms), 1)
    phrase_bonus = 0.25 if query.lower() in chunk.lower() else 0.0
    return density + phrase_bonus


def _rank_lexically(query: str, rows: list[dict], top_k: int) -> list[str]:
    scored: list[tuple[float, str]] = []
    for row in rows:
        chunk_text = str(row.get("chunk_text") or "")
        score = _lexical_score(query, chunk_text)
        if score > 0:
            scored.append((score, chunk_text))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk_text for _, chunk_text in scored[:top_k]]


def retrieve(query: str, subtopic_id: int, client: Client, top_k: int = 5) -> list[str]:
    """Return top-k matching chunk texts for the query, or [] on table failure."""
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

    try:
        # Embed the query as a QUERY (not a DOCUMENT) so it matches how the
        # stored chunks were embedded during ingest. If no embedding provider is
        # configured, fall back to lexical ranking so Azure can run without
        # Google billing or Azure OpenAI.
        query_embedding = embed(query, task_type="RETRIEVAL_QUERY")
    except Exception:
        query_embedding = []
    if not query_embedding:
        return _rank_lexically(query, rows, top_k)

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
