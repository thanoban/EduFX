from app.core.store import DemoDataStore
from app.repositories.content_repository import ContentRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.results_repository import ResultsRepository
from app.services.quiz_service import QuizService


def _make_service():
    store = DemoDataStore()
    quiz_repo = QuizRepository(store)
    content_repo = ContentRepository(store)
    results_repo = ResultsRepository(store)
    service = QuizService(
        quiz_repo,
        content_repo,
        results_repo,
        rag_repository=None,
        vertex_model="gemini-2.5-flash",
    )
    student = store.create_student("Test", "quiz-service@edufx.local")
    store.ensure_progress_records(student.id)
    return service, store, student


def test_get_quiz_uses_fast_personalized_builder(monkeypatch):
    service, store, student = _make_service()
    progress = store.student_progress[(student.id, 1)]
    progress.total_sessions = 1
    progress.current_level = "intermediate"

    def fail_ai_generation(*args, **kwargs):
        raise AssertionError("get_quiz should not call AI generation")

    monkeypatch.setattr(service, "_generate_ai_questions", fail_ai_generation)

    payload = service.get_quiz(student.id, 1)

    assert payload.stage == "personalized"
    assert len(payload.questions) == 15
    assert all(question.source == "live-gen" for question in payload.questions)


def test_generate_quiz_keeps_ai_personalization_path(monkeypatch):
    service, store, student = _make_service()
    progress = store.student_progress[(student.id, 1)]
    progress.total_sessions = 1
    progress.current_level = "advanced"

    fake_ai_questions = service.repository.get_manual_questions(1)[:15]
    monkeypatch.setattr(service, "_generate_ai_questions", lambda *args, **kwargs: fake_ai_questions)

    payload = service.generate_quiz(student.id, 1)

    assert payload.stage == "personalized"
    assert len(payload.questions) == 15
    assert all(question.id == expected.id for question, expected in zip(payload.questions, fake_ai_questions))
