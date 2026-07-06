from datetime import UTC, datetime

from app.agents import quiz_review, teacher_graph
from app.agents.dossier import build_student_dossier, dossier_to_prompt_context
from app.core.store import DemoDataStore
from app.ml.recommender_engine import RecommenderEngine
from app.models.domain import Question, QuizAttempt
from app.repositories.progress_repository import ProgressRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository
from app.services import ai_service


def _make_repos():
    store = DemoDataStore()
    student = store.create_student("Ali", "ali@edufx.demo")
    store.ensure_progress_records(student.id)
    return store, student, {
        "results_repository": ResultsRepository(store),
        "progress_repository": ProgressRepository(store),
        "scheduler_repository": SchedulerRepository(store),
        "quiz_repository": QuizRepository(store),
        "recommender_engine": RecommenderEngine(
            SchedulerRepository(store), ProgressRepository(store), ResultsRepository(store)
        ),
    }


def _q(qid, correct="A"):
    return Question(
        id=qid, subtopic_id=1, question_text=f"Q{qid}?", option_a="a", option_b="b",
        option_c="c", option_d="d", correct_answer=correct, difficulty="easy",
        source="gemini-ai", stage="personalized", student_id=1, is_diagnostic=False,
    )


# --- dossier -------------------------------------------------------------

def test_dossier_is_deterministic_and_read_only():
    store, student, repos = _make_repos()
    d1 = build_student_dossier(student.id, **repos)
    d2 = build_student_dossier(student.id, **repos)
    assert d1 is not None
    assert len(d1.subtopics) == 10
    # Same inputs -> identical rendered context (no randomness, no mutation).
    assert dossier_to_prompt_context(d1) == dossier_to_prompt_context(d2)


def test_dossier_none_for_unknown_student():
    _, _, repos = _make_repos()
    assert build_student_dossier(9999, **repos) is None


# --- teacher graph -------------------------------------------------------

def test_teacher_graph_grounding_strips_invented_percentage(monkeypatch):
    def fake(prompt, temperature=0.3, max_tokens=400):
        if "Classify the student" in prompt:
            return "analyst"
        if "figures NOT present" in prompt:
            # correction still leaves an invented figure -> hard strip must fire
            return "You are doing great and scored 99% overall."
        if "answer their question" in prompt.lower() or "progress report" in prompt.lower():
            return "Nice work. You scored 99% on flame tests. Keep going on solubility."
        return "specialist note"

    monkeypatch.setattr(ai_service, "generate_text", fake)
    teacher_graph._TEACHER_GRAPH = None  # rebuild against the patched fn

    out = teacher_graph.get_teacher_graph().invoke(
        {"context": "avg quiz score 60%. Solubility level beginner.", "mode": "chat",
         "question": "how am I doing?", "history": ""}
    )
    assert "99%" not in out["answer"]


def test_teacher_graph_report_runs_and_synthesises(monkeypatch):
    monkeypatch.setattr(ai_service, "generate_text", lambda prompt, **kw: "Grounded teacher text with no numbers.")
    teacher_graph._TEACHER_GRAPH = None

    out = teacher_graph.get_teacher_graph().invoke(
        {"context": "some context", "mode": "report", "question": "", "history": ""}
    )
    assert out["answer"].strip()


# --- quiz self-check -----------------------------------------------------

def test_quiz_selfcheck_drops_wrong_answer_question(monkeypatch):
    monkeypatch.setattr(
        ai_service,
        "generate_text",
        lambda prompt, **kw: '[{"index":0,"valid":true},{"index":1,"valid":true},'
        '{"index":2,"valid":false,"reason":"marked answer wrong"},'
        '{"index":3,"valid":true},{"index":4,"valid":true}]',
    )
    questions = [_q(i) for i in range(5)]
    out = quiz_review.review_quiz_questions(questions, content_body="notes", subtopic_title="X")
    assert len(out) == 4
    assert all(q.question_text != "Q2?" for q in out)


def test_quiz_selfcheck_backfills_with_regenerate(monkeypatch):
    monkeypatch.setattr(
        ai_service,
        "generate_text",
        lambda prompt, **kw: '[{"index":0,"valid":true},{"index":1,"valid":true},'
        '{"index":2,"valid":false},{"index":3,"valid":true},{"index":4,"valid":true}]',
    )
    questions = [_q(i) for i in range(5)]
    out = quiz_review.review_quiz_questions(
        questions, content_body="notes", subtopic_title="X", regenerate=lambda n: [_q(100 + i) for i in range(n)]
    )
    assert len(out) == 5


def test_quiz_selfcheck_fails_open_on_unparseable_verdict(monkeypatch):
    # Reviewer returns garbage -> keep all questions rather than nuke the quiz.
    monkeypatch.setattr(ai_service, "generate_text", lambda prompt, **kw: "not json at all")
    questions = [_q(i) for i in range(5)]
    out = quiz_review.review_quiz_questions(questions, content_body="notes", subtopic_title="X")
    assert len(out) == 5
