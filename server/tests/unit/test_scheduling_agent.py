from datetime import date, timedelta

from app.core.store import DemoDataStore
from app.ml.recommender_engine import RecommenderEngine
from app.repositories.progress_repository import ProgressRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository
from app.services.scheduling_agent import SchedulingAgent


def _make_service():
    store = DemoDataStore()
    scheduler_repo = SchedulerRepository(store)
    progress_repo = ProgressRepository(store)
    results_repo = ResultsRepository(store)
    engine = RecommenderEngine(scheduler_repo, progress_repo, results_repo)
    service = SchedulingAgent(engine, results_repo)
    student = store.create_student("Test", "test@edufx.local")
    store.ensure_progress_records(student.id)
    return service, store, student


def test_unconfigured_student_gets_unchanged_fallback_size():
    service, store, student = _make_service()
    # No free_days set -> historical top-3 behaviour, regardless of today.
    plan = service.get_todays_plan(student.id)
    assert len(plan) <= 3


def test_plan_is_empty_on_a_non_free_unpromised_day():
    service, store, student = _make_service()
    student.free_days = {0, 1, 2, 3, 4}  # Mon-Fri
    student.session_length = "long"
    student.next_expected_date = None
    store.students[student.id] = student

    # get_todays_plan uses date.today() internally, so exercise _resolve_cap
    # directly with a deterministic "today" instead of monkeypatching date.today().
    saturday = date(2026, 7, 4)  # a Saturday, not in free_days
    cap = service._resolve_cap(student, saturday)
    assert cap == 0


def test_cap_matches_session_length_on_a_free_day():
    service, store, student = _make_service()
    student.free_days = {0, 1, 2, 3, 4}  # Mon-Fri
    student.session_length = "short"
    store.students[student.id] = student

    monday = date(2026, 7, 6)
    assert service._resolve_cap(student, monday) == 1

    student.session_length = "long"
    assert service._resolve_cap(student, monday) == 4


def test_per_day_length_overrides_default_session_length():
    service, store, student = _make_service()
    student.free_days = {0, 2}  # Mon, Wed
    student.session_length = "medium"  # fallback default
    student.day_session_length = {0: "long", 2: "short"}  # Mon=1hr+, Wed=15min
    store.students[student.id] = student

    monday = date(2026, 7, 6)
    wednesday = date(2026, 7, 8)
    assert service._resolve_cap(student, monday) == 4  # long
    assert service._resolve_cap(student, wednesday) == 1  # short


def test_per_day_falls_back_to_default_for_unmapped_free_day():
    service, store, student = _make_service()
    student.free_days = {0, 2}
    student.session_length = "medium"
    student.day_session_length = {0: "long"}  # Wed has no per-day value
    store.students[student.id] = student

    wednesday = date(2026, 7, 8)
    assert service._resolve_cap(student, wednesday) == 2  # medium default


def test_promised_day_overrides_non_free_weekday():
    service, store, student = _make_service()
    student.free_days = {0, 1, 2, 3, 4}
    student.session_length = "medium"
    saturday = date(2026, 7, 4)
    student.next_expected_date = saturday
    store.students[student.id] = student

    assert service._resolve_cap(student, saturday) == 2


def test_get_todays_plan_respects_cap_end_to_end():
    service, store, student = _make_service()
    student.free_days = set(range(7))  # free every day
    student.session_length = "medium"
    store.students[student.id] = student

    plan = service.get_todays_plan(student.id)
    assert len(plan) <= 2


def test_register_study_session_starts_and_persists_streak():
    service, store, student = _make_service()
    assert student.current_streak == 0

    service.register_study_session(student.id)
    saved = store.students[student.id]
    assert saved.current_streak == 1
    assert saved.longest_streak == 1
    assert saved.last_study_date == date.today()


def test_register_study_session_continues_streak_from_yesterday():
    service, store, student = _make_service()
    student.last_study_date = date.today() - timedelta(days=1)
    student.current_streak = 4
    student.longest_streak = 4
    store.students[student.id] = student

    service.register_study_session(student.id)
    saved = store.students[student.id]
    assert saved.current_streak == 5
    assert saved.longest_streak == 5


def test_register_study_session_twice_same_day_is_idempotent():
    service, store, student = _make_service()
    service.register_study_session(student.id)
    service.register_study_session(student.id)
    assert store.students[student.id].current_streak == 1
