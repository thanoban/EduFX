from app.core.store import DemoDataStore
from app.models.domain import SessionSummary, Student, StudentProgress, Subtopic


class AdminRepository:
    def __init__(self, store: DemoDataStore) -> None:
        self.store = store

    def list_students(self) -> list[Student]:
        return list(self.store.students.values())

    def list_subtopics(self) -> list[Subtopic]:
        return sorted(self.store.subtopics.values(), key=lambda item: item.order_index)

    def get_student_progress_all(self, student_id: int) -> list[StudentProgress]:
        self.store.ensure_progress_records(student_id)
        return [record for record in self.store.student_progress.values() if record.student_id == student_id]

    def get_student_sessions(self, student_id: int) -> list[SessionSummary]:
        sessions = [
            session for session in self.store.session_summaries.values() if session.student_id == student_id
        ]
        return sorted(sessions, key=lambda item: item.created_at, reverse=True)

    def set_student_role(self, student_id: int, role: str) -> Student:
        return self.store.set_student_role(student_id, role)

    def get_student_weak_attempts(self, student_id: int, recent_limit: int = 200) -> list[dict]:
        """Same shape as QuizRepository.get_weak_attempts, but across every subtopic
        the student has attempted — admin needs whole-history weak concepts, not
        just one subtopic's."""
        attempts: list[dict] = []
        for session_attempts in self.store.quiz_attempts.values():
            for attempt in session_attempts:
                if attempt.student_id != student_id:
                    continue
                question = self.store.questions.get(attempt.question_id)
                attempts.append(
                    {
                        "concept": question.concept if question else None,
                        "is_correct": attempt.is_correct,
                        "question_text": question.question_text if question else None,
                        "correct_answer": attempt.correct_answer,
                        "created_at": attempt.created_at,
                    }
                )
        attempts.sort(key=lambda item: item["created_at"], reverse=True)
        return [{k: v for k, v in item.items() if k != "created_at"} for item in attempts[:recent_limit]]
