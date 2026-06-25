from app.core.store import DemoDataStore
from app.tools.seed_supabase import _content_rows, _question_rows


def test_seed_content_rows_remap_subtopic_id():
    content = next(iter(DemoDataStore().content_records.values()))
    row = _content_rows(content, live_subtopic_id=99)
    assert row["subtopic_id"] == 99
    assert row["level"] in {"beginner", "intermediate", "advanced"}
    assert row["body"]


def test_seed_question_rows_keep_contract_fields():
    question = next(iter(DemoDataStore().questions.values()))
    row = _question_rows(question, live_subtopic_id=42)
    assert row["subtopic_id"] == 42
    assert row["question_text"]
    assert row["correct_answer"] in {"A", "B", "C", "D"}
    assert row["stage"] in {"diagnostic", "first"}
