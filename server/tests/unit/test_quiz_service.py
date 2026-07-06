from app.core.config import get_settings
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


def _reset_settings() -> None:
    get_settings.cache_clear()


def test_personalized_quiz_skips_vertex_only_generation(monkeypatch):
    monkeypatch.delenv("FINETUNED_MODEL_URL", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    _reset_settings()

    service, store, student = _make_service()
    progress = store.student_progress[(student.id, 1)]
    progress.total_sessions = 1
    progress.current_level = "intermediate"

    payload = service.get_quiz(student.id, 1)

    assert payload.stage == "personalized"
    assert len(payload.questions) == 15
    assert all(question.source == "live-gen" for question in payload.questions)
    _reset_settings()

