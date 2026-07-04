from datetime import date, timedelta

from app.core.store import DemoDataStore
from app.repositories.admin_repository import AdminRepository
from app.services.reminder_service import ReminderService

TODAY = date(2026, 7, 6)  # Monday


def _make_service():
    store = DemoDataStore()
    repo = AdminRepository(store)
    service = ReminderService(repo)
    return service, store


def test_promised_day_missed_sends_one_reminder():
    service, store = _make_service()
    student = store.create_student("Ali", "ali@edufx.demo")
    student.free_days = {TODAY.weekday()}
    student.last_study_date = TODAY - timedelta(days=1)
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["promised_day"] == 1
    assert result["reengagement"] == 0


def test_no_email_when_already_studied_today():
    service, store = _make_service()
    student = store.create_student("Ali", "ali@edufx.demo")
    student.free_days = {TODAY.weekday()}
    student.last_study_date = TODAY
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["promised_day"] == 0
    assert result["reengagement"] == 0


def test_reengagement_tier_fires_at_exact_threshold():
    service, store = _make_service()
    student = store.create_student("Ali", "ali@edufx.demo")
    student.free_days = set()
    student.last_study_date = TODAY - timedelta(days=7)
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["reengagement"] == 1


def test_reengagement_does_not_fire_off_threshold():
    service, store = _make_service()
    student = store.create_student("Ali", "ali@edufx.demo")
    student.free_days = set()
    student.last_study_date = TODAY - timedelta(days=8)
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["reengagement"] == 0


def test_opted_out_student_is_skipped():
    service, store = _make_service()
    student = store.create_student("Ali", "ali@edufx.demo")
    student.free_days = {TODAY.weekday()}
    student.email_reminders_enabled = False
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["skipped_opted_out"] == 1
    assert result["promised_day"] == 0
