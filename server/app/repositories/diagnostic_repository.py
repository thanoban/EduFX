from app.core.store import DemoDataStore
from app.models.domain import Question, Student, Subtopic


class DiagnosticRepository:
    def __init__(self, store: DemoDataStore) -> None:
        self.store = store

    def get_diagnostic_questions(self) -> list[Question]:
        return [question for question in self.store.questions.values() if question.stage == "diagnostic"]

    def get_student(self, student_id: int) -> Student | None:
        return self.store.students.get(student_id)

    def get_subtopic(self, subtopic_id: int) -> Subtopic:
        return self.store.subtopics[subtopic_id]

    def save_student_level(self, student_id: int, subtopic_id: int, level: str, score: int) -> None:
        record = self.store.student_progress[(student_id, subtopic_id)]
        record.current_level = level
        record.last_quiz_score = score

    def complete_diagnostic(self, student_id: int) -> None:
        student = self.store.students[student_id]
        student.diagnostic_completed = True
