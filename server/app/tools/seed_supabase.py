"""Seed the live Supabase database with the baseline EduFX curriculum.

Run from the server directory:
    python -m app.tools.seed_supabase --dry-run
    python -m app.tools.seed_supabase
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings
from app.core.store import DemoDataStore, SUBTOPIC_DEFINITIONS
from app.models.domain import Content, Question


@dataclass(slots=True)
class SeedSummary:
    subtopics_created: int = 0
    subtopics_updated: int = 0
    content_created: int = 0
    diagnostic_questions_created: int = 0
    first_questions_created: int = 0


def _execute_insert(client: Any, table: str, rows: list[dict[str, Any]], dry_run: bool) -> int:
    if not rows:
        return 0
    if not dry_run:
        client.table(table).insert(rows).execute()
    return len(rows)


def _fetch_subtopics(client: Any) -> list[dict[str, Any]]:
    return client.table("subtopics").select("*").order("order_index").execute().data or []


def ensure_subtopics(client: Any, dry_run: bool) -> tuple[dict[int, int], SeedSummary]:
    summary = SeedSummary()
    rows_by_order = {int(row["order_index"]): row for row in _fetch_subtopics(client)}

    for order_index, (group_name, title) in enumerate(SUBTOPIC_DEFINITIONS, start=1):
        existing = rows_by_order.get(order_index)
        if existing is None:
            summary.subtopics_created += _execute_insert(
                client,
                "subtopics",
                [{"group_name": group_name, "title": title, "order_index": order_index}],
                dry_run,
            )
            continue

        patch: dict[str, Any] = {}
        if existing.get("group_name") != group_name:
            patch["group_name"] = group_name
        if existing.get("title") != title:
            patch["title"] = title
        if patch:
            summary.subtopics_updated += 1
            if not dry_run:
                client.table("subtopics").update(patch).eq("id", existing["id"]).execute()

    if dry_run:
        # In dry-run mode existing rows are all we can safely map.
        rows = _fetch_subtopics(client)
    else:
        rows = _fetch_subtopics(client)

    subtopic_ids_by_order = {
        int(row["order_index"]): int(row["id"])
        for row in rows
        if 1 <= int(row["order_index"]) <= len(SUBTOPIC_DEFINITIONS)
    }
    return subtopic_ids_by_order, summary


def _content_rows(content: Content, live_subtopic_id: int) -> dict[str, Any]:
    return {
        "subtopic_id": live_subtopic_id,
        "level": content.level,
        "body": content.body,
    }


def ensure_content(client: Any, subtopic_ids_by_order: dict[int, int], dry_run: bool) -> int:
    demo = DemoDataStore()
    existing_rows = client.table("content").select("subtopic_id,level").execute().data or []
    existing = {(int(row["subtopic_id"]), str(row["level"])) for row in existing_rows}

    rows_to_insert: list[dict[str, Any]] = []
    for content in demo.content_records.values():
        live_subtopic_id = subtopic_ids_by_order.get(content.subtopic_id)
        if live_subtopic_id is None:
            continue
        key = (live_subtopic_id, content.level)
        if key not in existing:
            rows_to_insert.append(_content_rows(content, live_subtopic_id))
            existing.add(key)

    return _execute_insert(client, "content", rows_to_insert, dry_run)


def _question_rows(question: Question, live_subtopic_id: int) -> dict[str, Any]:
    return {
        "subtopic_id": live_subtopic_id,
        "question_text": question.question_text,
        "option_a": question.option_a,
        "option_b": question.option_b,
        "option_c": question.option_c,
        "option_d": question.option_d,
        "correct_answer": question.correct_answer,
        "difficulty": question.difficulty,
        "source": question.source,
        "stage": question.stage,
        "student_id": question.student_id,
        "is_diagnostic": question.is_diagnostic,
    }


def ensure_questions(client: Any, subtopic_ids_by_order: dict[int, int], dry_run: bool) -> tuple[int, int]:
    demo = DemoDataStore()
    existing_rows = (
        client.table("questions")
        .select("subtopic_id,stage,question_text")
        .in_("stage", ["diagnostic", "first"])
        .execute()
        .data
        or []
    )
    existing_counts: dict[tuple[int, str], int] = {}
    existing = {
        (int(row["subtopic_id"]), str(row["stage"]), str(row["question_text"]))
        for row in existing_rows
    }
    for row in existing_rows:
        key = (int(row["subtopic_id"]), str(row["stage"]))
        existing_counts[key] = existing_counts.get(key, 0) + 1

    rows_to_insert: list[dict[str, Any]] = []
    diagnostic_count = 0
    first_count = 0
    stage_targets = {"diagnostic": 4, "first": 15}

    for question in demo.questions.values():
        live_subtopic_id = subtopic_ids_by_order.get(question.subtopic_id)
        if live_subtopic_id is None or question.stage not in {"diagnostic", "first"}:
            continue
        stage_key = (live_subtopic_id, question.stage)
        if existing_counts.get(stage_key, 0) >= stage_targets[question.stage]:
            continue
        key = (live_subtopic_id, question.stage, question.question_text)
        if key in existing:
            continue
        rows_to_insert.append(_question_rows(question, live_subtopic_id))
        existing.add(key)
        existing_counts[stage_key] = existing_counts.get(stage_key, 0) + 1
        if question.stage == "diagnostic":
            diagnostic_count += 1
        else:
            first_count += 1

    _execute_insert(client, "questions", rows_to_insert, dry_run)
    return diagnostic_count, first_count


def seed(client: Any, dry_run: bool = False) -> SeedSummary:
    subtopic_ids_by_order, summary = ensure_subtopics(client, dry_run)
    summary.content_created = ensure_content(client, subtopic_ids_by_order, dry_run)
    diagnostic_count, first_count = ensure_questions(client, subtopic_ids_by_order, dry_run)
    summary.diagnostic_questions_created = diagnostic_count
    summary.first_questions_created = first_count
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Supabase with EduFX baseline curriculum data")
    parser.add_argument("--dry-run", action="store_true", help="Summarize missing rows without writing")
    args = parser.parse_args()

    settings = get_settings()
    supabase_key = settings.supabase_service_role_key or settings.supabase_key
    if not settings.supabase_url or not supabase_key:
        raise SystemExit("ERROR: Supabase client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")

    from supabase import create_client

    summary = seed(create_client(settings.supabase_url, supabase_key), dry_run=args.dry_run)
    mode = "Dry run complete" if args.dry_run else "Seed complete"
    print(mode)
    print(f"  subtopics_created={summary.subtopics_created}")
    print(f"  subtopics_updated={summary.subtopics_updated}")
    print(f"  content_created={summary.content_created}")
    print(f"  diagnostic_questions_created={summary.diagnostic_questions_created}")
    print(f"  first_questions_created={summary.first_questions_created}")


if __name__ == "__main__":
    main()
