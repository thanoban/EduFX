"""RAG retrieval via Supabase pgvector RPC. Returns empty list in demo/memory mode."""
from __future__ import annotations

from supabase import Client


class RagRepository:
    def __init__(self, client: Client | None) -> None:
        self._client = client

    def retrieve(self, query: str, subtopic_id: int, top_k: int = 5) -> list[str]:
        if self._client is None:
            return []
        from app.rag.retriever import retrieve
        return retrieve(query, subtopic_id, self._client, top_k=top_k)
