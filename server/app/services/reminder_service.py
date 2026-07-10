"""Daily reminder scan — Duolingo-style, friendly not punitive.

Run once a day (see routes/internal.py + .github/workflows/reminders.yml).
Stateless by design: no "reminder already sent" record is stored, so the check
just re-derives "does this student need a nudge today" from their current
free_days / next_expected_date / last_study_date each run. That's safe as long
as the job itself only fires once a day (the GitHub Actions cron schedule),
which is the deployment this is built for.
"""
from __future__ import annotations

from datetime import date

from app.core.email import send_email
from app.models.domain import Student
from app.repositories.admin_repository import AdminRepository
from app.repositories.contracts import AdminRepositoryContract

# Escalating re-engagement tiers for students who've gone quiet. Capped at
# three emails, then EduFX stops nudging automatically — no infinite spam.
_REENGAGEMENT_TIERS = (
    (3, "We miss you at EduFX", "It's been a few days — pick up right where you left off whenever you're ready."),
    (7, "Your streak is waiting", "A full week's gone by. No pressure — a single 15-minute session gets you back on track."),
    (30, "Whenever you're ready", "It's been a while! Your progress is still saved. Come back any time — EduFX will be here."),
)


def _promised_today(student: Student, today: date) -> bool:
    return today.weekday() in student.free_days or student.next_expected_date == today


def _studied_today(student: Student, today: date) -> bool:
    return student.last_study_date == today


def _days_since_last_study(student: Student, today: date) -> int | None:
    if student.last_study_date is None:
        return None
    return (today - student.last_study_date).days


class ReminderService:
    def __init__(self, repository: AdminRepositoryContract | AdminRepository) -> None:
        self.repository = repository

    def run_daily_scan(self, today: date | None = None) -> dict[str, int]:
        today = today or date.today()
        counts = {
            "promised_day": 0,
            "reengagement": 0,
            "failed": 0,
            "skipped_opted_out": 0,
            "skipped_non_student": 0,
        }

        for student in self.repository.list_students():
            if student.role != "student":
                counts["skipped_non_student"] += 1
                continue

            if not student.email_reminders_enabled:
                counts["skipped_opted_out"] += 1
                continue

            if _promised_today(student, today) and not _studied_today(student, today):
                if send_email(
                    student.email,
                    "Ready for today's session?",
                    f"Hi {student.name}, you said you'd be free to study today. "
                    "Your plan is queued and waiting whenever you are.",
                ):
                    counts["promised_day"] += 1
                else:
                    counts["failed"] += 1
                continue  # one email per student per run

            days_missed = _days_since_last_study(student, today)
            if days_missed is None:
                continue
            for threshold, subject, message in _REENGAGEMENT_TIERS:
                if days_missed == threshold:
                    if send_email(student.email, subject, f"Hi {student.name}, {message}"):
                        counts["reengagement"] += 1
                    else:
                        counts["failed"] += 1
                    break

        return counts
