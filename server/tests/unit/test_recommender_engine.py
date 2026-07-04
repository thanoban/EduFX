from datetime import date

from app.core.store import DemoDataStore
from app.ml.recommender_engine import RecommenderEngine, ScoredCandidate
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
