from datetime import date

from app.core.store import DemoDataStore
from app.ml.recommender_engine import RecommenderEngine, ScoredCandidate
from app.models.domain import QuizAttempt
from app.repositories.progress_repository import ProgressRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository


def _make_engine():
    store = DemoDataStore()
    scheduler_repo = SchedulerRepository(store)
    progress_repo = ProgressRepository(store)
    results_repo = ResultsRepository(store)
    engine = RecommenderEngine(scheduler_repo, progress_repo, results_repo)
    student = store.create_student("Test", "test@edufx.local")
    store.ensure_progress_records(student.id)
    return engine, store, student


def test_rank_candidates_returns_full_uncapped_ranked_list():
    engine, store, student = _make_engine()
    candidates = engine.rank_candidates(student.id, date.today())

    # Every non-cooldown subtopic is ranked (uncapped) — far more than a daily
    # plan would ever serve, which is the whole point of the model/agent split.
    assert len(candidates) > 4
    assert all(isinstance(item, ScoredCandidate) for item in candidates)


def test_rank_candidates_is_sorted_best_first():
    engine, store, student = _make_engine()
    candidates = engine.rank_candidates(student.id, date.today())
    scores = [item.score for item in candidates]
    assert scores == sorted(scores, reverse=True)


def test_rank_candidates_falls_back_to_rules_when_no_model():
    engine, store, student = _make_engine()
    # Force the model-unavailable path: with no predictor the engine must still
    # produce a ranked list from the rule-based fallback.
    engine.predictor = None
    candidates = engine.rank_candidates(student.id, date.today())
    assert len(candidates) > 0
    assert all(item.bucket in {"weak", "strong"} for item in candidates)


def test_rank_candidates_bulk_loads_session_attempts():
    engine, store, student = _make_engine()

    class _Predictor:
        def predict_mastery(self, history):
            return {skill: 0.45 for skill in range(10)}

        def predict_p_correct(self, history):
            return {skill: 0.55 for skill in range(10)}

    question_by_subtopic = {}
    for question in store.questions.values():
        if question.stage == "first" and question.subtopic_id not in question_by_subtopic:
            question_by_subtopic[question.subtopic_id] = question

    for subtopic_id in (1, 2, 3):
        session = store.create_session(student.id, subtopic_id)
        question = question_by_subtopic[subtopic_id]
        store.student_progress[(student.id, subtopic_id)].total_sessions = 1
        store.add_quiz_attempt(
            session.id,
            QuizAttempt(
                id=0,
                student_id=student.id,
                session_id=session.id,
                question_id=question.id,
                subtopic_id=subtopic_id,
                student_answer=question.correct_answer,
                correct_answer=question.correct_answer,
                is_correct=True,
                explanation=None,
            ),
        )

    calls = {"bulk": 0, "single": 0}
    original_bulk = engine.results_repository.get_attempts_for_sessions

    def _bulk(session_ids):
        calls["bulk"] += 1
        return original_bulk(session_ids)

    def _single(_session_id):
        calls["single"] += 1
        raise AssertionError("rank_candidates should use the bulk attempt loader")

    engine.predictor = _Predictor()
    engine.results_repository.get_attempts_for_sessions = _bulk
    engine.results_repository.get_attempts = _single

    candidates = engine.rank_candidates(student.id, date.today())

    assert candidates
    assert calls == {"bulk": 1, "single": 0}
