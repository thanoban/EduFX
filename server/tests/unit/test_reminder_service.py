from datetime import date, timedelta

import pytest

from app.core.store import DemoDataStore
from app.repositories.admin_repository import AdminRepository
from app.services.reminder_service import ReminderService

TODAY = date(2026, 7, 6)  # Monday


def _make_service():
    store = DemoDataStore()
    repo = AdminRepository(store)
    service = ReminderService(repo)
    return service, store


def _create_student(store: DemoDataStore, suffix: str = "student"):
    store.create_student("Admin", f"admin-{suffix}@edufx.demo")
    return store.create_student("Ali", f"ali-{suffix}@edufx.demo")


def test_promised_day_missed_sends_one_reminder():
    service, store = _make_service()
    student = _create_student(store, "promised")
    student.free_days = {TODAY.weekday()}
    student.last_study_date = TODAY - timedelta(days=1)
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["promised_day"] == 1
    assert result["reengagement"] == 0


def test_no_email_when_already_studied_today():
    service, store = _make_service()
    student = _create_student(store, "studied")
    student.free_days = {TODAY.weekday()}
    student.last_study_date = TODAY
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["promised_day"] == 0
    assert result["reengagement"] == 0


def test_reengagement_tier_fires_at_exact_threshold():
    service, store = _make_service()
    student = _create_student(store, "reengagement")
    student.free_days = set()
    student.last_study_date = TODAY - timedelta(days=7)
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["reengagement"] == 1


def test_reengagement_does_not_fire_off_threshold():
    service, store = _make_service()
    student = _create_student(store, "off-threshold")
    student.free_days = set()
    student.last_study_date = TODAY - timedelta(days=8)
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["reengagement"] == 0


def test_opted_out_student_is_skipped():
    service, store = _make_service()
    student = _create_student(store, "opted-out")
    student.free_days = {TODAY.weekday()}
    student.email_reminders_enabled = False
    store.students[student.id] = student

    result = service.run_daily_scan(TODAY)
    assert result["skipped_opted_out"] == 1
    assert result["promised_day"] == 0


def test_failed_email_is_reported(monkeypatch: pytest.MonkeyPatch):
    service, store = _make_service()
    student = _create_student(store, "failed")
    student.free_days = {TODAY.weekday()}
    student.last_study_date = TODAY - timedelta(days=1)
    store.students[student.id] = student

    monkeypatch.setattr("app.services.reminder_service.send_email", lambda *args, **kwargs: False)

    result = service.run_daily_scan(TODAY)
    assert result["promised_day"] == 0
    assert result["failed"] == 1


def test_admin_accounts_do_not_receive_student_reminders():
    service, store = _make_service()
    admin = store.create_student("Admin", "admin-reminder@edufx.demo")
    admin.free_days = {TODAY.weekday()}
    admin.last_study_date = TODAY - timedelta(days=1)
    store.students[admin.id] = admin

    result = service.run_daily_scan(TODAY)
    assert result["skipped_non_student"] == 1
    assert result["promised_day"] == 0
