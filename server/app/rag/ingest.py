"""
One-time ingest script: reads data/notes/*.csv → chunks text → embeds → stores in Supabase.

Usage:
    cd EduFX_MVC/server
    python -m app.rag.ingest

CSV format expected:
    subtopic_id,body
    1,"Your full notes for this topic..."
    2,"Notes for the next topic..."
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path


def chunk_text(text: str, size: int = 250, overlap: int = 30) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + size])
        chunks.append(chunk)
        i += size - overlap
    return chunks


def ingest_csv(csv_path: Path, client) -> int:
    from app.rag.embedder import embed

    total = 0
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            subtopic_id = int(row["subtopic_id"])
            body = row.get("body", "").strip()
            if not body:
                continue
            chunks = chunk_text(body)
            rows_to_insert: list[dict] = []
            for chunk in chunks:
                try:
                    embedding = embed(chunk)
                except Exception as exc:
                    print(f"  [skip] embedding failed for subtopic {subtopic_id}: {exc}")
                    continue
                rows_to_insert.append(
                    {
                        "subtopic_id": subtopic_id,
                        "source": csv_path.name,
                        "chunk_text": chunk,
                        "embedding": embedding,
                    }
                )
            if rows_to_insert:
                client.table("content_chunks").insert(rows_to_insert).execute()
                total += len(rows_to_insert)
                print(f"  subtopic_id={subtopic_id}: {len(rows_to_insert)} chunks stored")
    return total


def main() -> None:
    from app.core.clients import build_external_clients
    from app.core.config import get_settings

    settings = get_settings()
    clients = build_external_clients(settings)

    if clients.supabase is None:
        print("ERROR: Supabase client not configured. Set SUPABASE_URL and SUPABASE_KEY in .env")
        sys.exit(1)

    if not settings.google_cloud_project:
        print("ERROR: GOOGLE_CLOUD_PROJECT not set. Cannot initialize Vertex AI embeddings.")
        print("Run: gcloud auth application-default login")
        sys.exit(1)

    notes_dir = Path(__file__).resolve().parents[4] / "data" / "notes"
    csv_files = sorted(notes_dir.glob("*.csv"))
    if not csv_files:
        print(f"No CSV files found in {notes_dir}")
        print("Create data/notes/s_block_notes.csv with columns: subtopic_id,body")
        sys.exit(0)

    total = 0
    for csv_file in csv_files:
        print(f"\nIngesting {csv_file.name}...")
        total += ingest_csv(csv_file, clients.supabase)

    print(f"\nDone — {total} chunks embedded and stored in content_chunks.")


if __name__ == "__main__":
    main()
