"""
Export Task B fine-tuning data (JSONL) from Supabase quiz_attempts.

Run from the server/ directory:
    python notebooks/export_training_data.py --out data/finetune/task_b.jsonl

Reads quiz_attempts rows where is_correct = false and explanation is not null,
then formats them as instruction-tuning pairs for Gemini fine-tuning.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _build_instruction(row: dict) -> str:
    q = row.get("questions") or {}
    return (
        f"A student at {row.get('level', 'intermediate')} level answered the following "
        f"A-level chemistry question incorrectly.\n\n"
        f"Question: {q.get('question_text', '')}\n"
        f"A) {q.get('option_a', '')}  B) {q.get('option_b', '')}  "
        f"C) {q.get('option_c', '')}  D) {q.get('option_d', '')}\n\n"
        f"Student answered: {row.get('student_answer', '')}\n"
        f"Correct answer: {row.get('correct_answer', '')}\n\n"
        f"Write a concise 3-sentence explanation of why the student's choice is wrong "
        f"and what the correct reasoning is."
    )


def export(out_path: Path, limit: int) -> None:
    from dotenv import load_dotenv
    from supabase import create_client

    load_dotenv()
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    rows = (
        client.table("quiz_attempts")
        .select("*, questions(question_text, option_a, option_b, option_c, option_d)")
        .eq("is_correct", False)
        .not_.is_("explanation", "null")
        .limit(limit)
        .execute()
        .data
    ) or []

    out_path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with out_path.open("w", encoding="utf-8") as fh:
        for row in rows:
            if not (row.get("explanation") and row.get("questions")):
                continue
            record = {
                "messages": [
                    {"role": "system", "content": "You are an expert A-level Chemistry tutor."},
                    {"role": "user", "content": _build_instruction(row)},
                    {"role": "model", "content": row["explanation"].strip()},
                ]
            }
            fh.write(json.dumps(record) + "\n")
            written += 1

    print(f"Exported {written} training examples → {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export Task B fine-tuning JSONL from Supabase")
    parser.add_argument("--out", default="data/finetune/task_b.jsonl", help="Output JSONL path")
    parser.add_argument("--limit", type=int, default=500, help="Max rows to fetch")
    args = parser.parse_args()
    export(Path(args.out), args.limit)


if __name__ == "__main__":
    main()
