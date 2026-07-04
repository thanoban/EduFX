from datetime import date

from app.core.errors import EduFXError
from app.core.rules import resolve_next_free_choice
from app.models.dto import StudentProfileDTO
from app.repositories.auth_repository import AuthRepository
from app.repositories.contracts import AuthRepositoryContract


class SettingsService:
    """Availability, reminder preferences, and the post-session check-in.

    Reuses AuthRepositoryContract (get_student/save_student) rather than a new
    repository class — the same student read/write pair auth already needs.
    """

    def __init__(self, repository: AuthRepositoryContract | AuthRepository) -> None:
        self.repository = repository

    def _get_student_or_404(self, student_id: int):
        student = self.repository.get_student(student_id)
        if student is None:
            raise EduFXError("Student not found", status_code=404)
        return student

    def update_availability(
        self,
        student_id: int,
        free_days: list[int],
        session_length: str,
        email_reminders_enabled: bool,
    ) -> StudentProfileDTO:
        student = self._get_student_or_404(student_id)
        student.free_days = {day for day in free_days if 0 <= day <= 6}
        student.session_length = session_length
        student.email_reminders_enabled = email_reminders_enabled
        self.repository.save_student(student)
        return StudentProfileDTO.from_student(student)

    def check_in_next_free(self, student_id: int, choice: str) -> StudentProfileDTO:
        student = self._get_student_or_404(student_id)
        student.next_expected_date = resolve_next_free_choice(choice, date.today())
        self.repository.save_student(student)
        return StudentProfileDTO.from_student(student)
