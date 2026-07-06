from datetime import date

from app.core.errors import EduFXError
from app.core.store import DemoDataStore
from app.models.domain import Question, QuizAttempt, SessionSummary, Student, StudentProgress


class ResultsRepository:
    def __init__(self, store: DemoDataStore) -> None:
        self.store = store

    def get_session(self, session_id: int) -> SessionSummary:
        if session_id not in self.store.session_summaries:
            raise EduFXError("Session not found", status_code=404)
        return self.store.session_summaries[session_id]

    def get_question(self, question_id: int) -> Question:
        return self.store.questions[question_id]

    def add_attempt(self, attempt: QuizAttempt) -> QuizAttempt:
        return self.store.add_quiz_attempt(attempt.session_id, attempt)

    def get_attempts(self, session_id: int) -> list[QuizAttempt]:
        return self.store.quiz_attempts.get(session_id, [])

    def get_attempts_for_sessions(self, session_ids: list[int]) -> dict[int, list[QuizAttempt]]:
        return {session_id: self.store.quiz_attempts.get(session_id, []) for session_id in session_ids}

    def get_progress(self, student_id: int, subtopic_id: int) -> StudentProgress:
        self.store.ensure_progress_records(student_id)
        return self.store.student_progress[(student_id, subtopic_id)]

    def save_progress(self, progress: StudentProgress) -> None:
        progress.last_studied_date = date.today()
        self.store.student_progress[(progress.student_id, progress.subtopic_id)] = progress

    def save_session(self, session: SessionSummary) -> None:
        self.store.session_summaries[session.id] = session

    def get_question_answers(self, session_id: int):
        return self.store.get_question_answers(session_id)

    def get_student(self, student_id: int) -> Student | None:
        return self.store.students.get(student_id)

    def save_student(self, student: Student) -> None:
        self.store.students[student.id] = student
