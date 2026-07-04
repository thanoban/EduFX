from datetime import date

from app.core.store import DemoDataStore
from app.repositories.progress_repository import ProgressRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository
from app.services.scheduler_service import SchedulerService


def _make_service():
    store = DemoDataStore()
    scheduler_repo = SchedulerRepository(store)
    progress_repo = ProgressRepository(store)
    results_repo = ResultsRepository(store)
    service = SchedulerService(scheduler_repo, progress_repo, results_repo)
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
