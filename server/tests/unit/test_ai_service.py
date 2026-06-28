import json

from app.core.config import get_settings
from app.services import ai_service


def _reset_settings() -> None:
    get_settings.cache_clear()


def test_generate_quiz_uses_finetuned_endpoint_when_configured(monkeypatch):
    monkeypatch.setenv("FINETUNED_MODEL_URL", "http://model.local:8080")
    monkeypatch.setenv("FINETUNED_MODEL_NAME", "edufx")
    _reset_settings()

    expected = [
        {
            "question_text": "Question?",
            "option_a": "A",
            "option_b": "B",
            "option_c": "C",
            "option_d": "D",
            "correct_answer": "A",
            "difficulty": "easy",
        }
    ]

    def fake_finetuned(prompt, temperature, max_tokens):
        return json.dumps(expected)

    def fail_vertex(*args, **kwargs):
        raise AssertionError("Vertex should not be called when the fine-tuned endpoint returns JSON")

    monkeypatch.setattr(ai_service, "_call_finetuned", fake_finetuned)
    monkeypatch.setattr(ai_service, "_call_vertex", fail_vertex)

    result = ai_service.generate_quiz_questions(
        vertex_model="gemini",
        subtopic_title="Group 1",
        group_name="group1",
        level="beginner",
        content_body="notes",
        count=1,
    )

    assert result == expected
    _reset_settings()


def test_generate_quiz_falls_back_to_vertex_when_finetuned_endpoint_fails(monkeypatch):
    monkeypatch.setenv("FINETUNED_MODEL_URL", "http://model.local:8080")
    _reset_settings()

    expected = [
        {
            "question_text": "Fallback?",
            "option_a": "A",
            "option_b": "B",
            "option_c": "C",
            "option_d": "D",
            "correct_answer": "B",
            "difficulty": "medium",
        }
    ]

    def fail_finetuned(prompt, temperature, max_tokens):
        raise RuntimeError("model offline")

    def fake_vertex(model_name, prompt, temperature, max_tokens):
        return json.dumps(expected)

    monkeypatch.setattr(ai_service, "_call_finetuned", fail_finetuned)
    monkeypatch.setattr(ai_service, "_call_vertex", fake_vertex)

    result = ai_service.generate_quiz_questions(
        vertex_model="gemini",
        subtopic_title="Group 2",
        group_name="group2",
        level="intermediate",
        content_body="notes",
        count=1,
    )

    assert result == expected
    _reset_settings()
