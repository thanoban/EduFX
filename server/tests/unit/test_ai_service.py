import json

from app.core.config import get_settings
from app.services import ai_service


def _reset_settings() -> None:
    get_settings.cache_clear()


def _fail(name):
    def _raise(*args, **kwargs):
        raise AssertionError(f"{name} should not be called")

    return _raise


def test_gemini_generate_config_disables_thinking():
    """Regression test: Gemini 2.5 spends part of max_output_tokens on invisible
    "thinking" tokens by default, which silently truncated large JSON quiz
    responses mid-string before this was disabled. See _gemini_generate_config.
    """
    config = ai_service._gemini_generate_config(temperature=0.4, max_tokens=4096)
    assert config.thinking_config.thinking_budget == 0


def test_generate_quiz_uses_finetuned_first_when_configured(monkeypatch):
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

    monkeypatch.setattr(ai_service, "_call_finetuned", lambda *a, **k: json.dumps(expected))
    monkeypatch.setattr(ai_service, "_call_gemini_api_key", _fail("gemini"))
    monkeypatch.setattr(ai_service, "_call_groq", _fail("groq"))
    monkeypatch.setattr(ai_service, "_call_vertex", _fail("vertex"))

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


def test_generate_quiz_falls_back_to_gemini_key_when_finetuned_fails(monkeypatch):
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

    def fail_finetuned(*args, **kwargs):
        raise RuntimeError("EC2 box unreachable")

    monkeypatch.setattr(ai_service, "_call_finetuned", fail_finetuned)
    monkeypatch.setattr(ai_service, "_call_gemini_api_key", lambda *a, **k: json.dumps(expected))
    monkeypatch.setattr(ai_service, "_call_groq", _fail("groq"))
    monkeypatch.setattr(ai_service, "_call_vertex", _fail("vertex"))

    result = ai_service.generate_quiz_questions(
        vertex_model="gemini",
        subtopic_title="Group 2",
        group_name="group2",
        level="intermediate",
        content_body="notes",
        count=1,
    )

    assert result == expected


def test_generate_quiz_falls_back_to_groq_when_gemini_key_fails(monkeypatch):
    expected = [
        {
            "question_text": "Groq fallback?",
            "option_a": "A",
            "option_b": "B",
            "option_c": "C",
            "option_d": "D",
            "correct_answer": "C",
            "difficulty": "hard",
        }
    ]

    monkeypatch.setattr(ai_service, "_call_finetuned", lambda *a, **k: "")
    monkeypatch.setattr(ai_service, "_call_gemini_api_key", lambda *a, **k: "")
    monkeypatch.setattr(ai_service, "_call_groq", lambda *a, **k: json.dumps(expected))
    monkeypatch.setattr(ai_service, "_call_vertex", _fail("vertex"))

    result = ai_service.generate_quiz_questions(
        vertex_model="gemini",
        subtopic_title="Group 1",
        group_name="group1",
        level="advanced",
        content_body="notes",
        count=1,
    )

    assert result == expected


def test_generate_quiz_falls_back_to_vertex_as_last_resort(monkeypatch):
    expected = [
        {
            "question_text": "Last resort?",
            "option_a": "A",
            "option_b": "B",
            "option_c": "C",
            "option_d": "D",
            "correct_answer": "D",
            "difficulty": "easy",
        }
    ]

    monkeypatch.setattr(ai_service, "_call_finetuned", lambda *a, **k: "")
    monkeypatch.setattr(ai_service, "_call_gemini_api_key", lambda *a, **k: "")
    monkeypatch.setattr(ai_service, "_call_groq", lambda *a, **k: "")
    monkeypatch.setattr(ai_service, "_call_vertex", lambda *a, **k: json.dumps(expected))

    result = ai_service.generate_quiz_questions(
        vertex_model="gemini",
        subtopic_title="Group 2",
        group_name="group2",
        level="beginner",
        content_body="notes",
        count=1,
    )

    assert result == expected


def test_generate_explanation_tries_gemini_key_before_vertex(monkeypatch):
    monkeypatch.setattr(ai_service, "_call_gemini_api_key", lambda *a, **k: "Because X reacts with Y.")
    monkeypatch.setattr(ai_service, "_call_groq", _fail("groq"))
    monkeypatch.setattr(ai_service, "_call_vertex", _fail("vertex"))

    result = ai_service.generate_explanation(
        vertex_model="gemini",
        level="beginner",
        question_text="Q?",
        option_a="A",
        option_b="B",
        option_c="C",
        option_d="D",
        student_answer="A",
        correct_answer="B",
    )

    assert result == "Because X reacts with Y."


def test_generate_explanation_falls_back_to_groq_then_vertex(monkeypatch):
    monkeypatch.setattr(ai_service, "_call_gemini_api_key", lambda *a, **k: "")
    monkeypatch.setattr(ai_service, "_call_groq", lambda *a, **k: "")
    monkeypatch.setattr(ai_service, "_call_vertex", lambda *a, **k: "Vertex explanation.")

    result = ai_service.generate_explanation(
        vertex_model="gemini",
        level="beginner",
        question_text="Q?",
        option_a="A",
        option_b="B",
        option_c="C",
        option_d="D",
        student_answer="A",
        correct_answer="B",
    )

    assert result == "Vertex explanation."


def test_generate_explanation_returns_none_when_all_providers_fail(monkeypatch):
    monkeypatch.setattr(ai_service, "_call_gemini_api_key", lambda *a, **k: "")
    monkeypatch.setattr(ai_service, "_call_groq", lambda *a, **k: "")
    monkeypatch.setattr(ai_service, "_call_vertex", lambda *a, **k: "")

    result = ai_service.generate_explanation(
        vertex_model="gemini",
        level="beginner",
        question_text="Q?",
        option_a="A",
        option_b="B",
        option_c="C",
        option_d="D",
        student_answer="A",
        correct_answer="B",
    )

    assert result is None
