from app.core.store import DemoDataStore
from app.models.domain import Student


class AuthRepository:
    def __init__(self, store: DemoDataStore) -> None:
        self.store = store

    def find_student_by_email(self, email: str) -> Student | None:
        return next((student for student in self.store.students.values() if student.email == email), None)

    def create_student(self, name: str, email: str) -> Student:
        student = self.store.create_student(name, email)
        self.store.ensure_progress_records(student.id)
        return student

    def get_student(self, student_id: int) -> Student | None:
        return self.store.students.get(student_id)

