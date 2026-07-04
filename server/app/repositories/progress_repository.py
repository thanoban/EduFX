from app.core.store import DemoDataStore
from app.models.domain import SessionSummary, StudentProgress, Subtopic


class ProgressRepository:
    def __init__(self, store: DemoDataStore) -> None:
        self.store = store

    def get_progress_records(self, student_id: int) -> list[StudentProgress]:
        self.store.ensure_progress_records(student_id)
        return [record for record in self.store.student_progress.values() if record.student_id == student_id]

    def list_subtopics(self) -> list[Subtopic]:
        return sorted(self.store.subtopics.values(), key=lambda item: item.order_index)

    def get_student_session_history(self, student_id: int) -> list[SessionSummary]:
        sessions = [
            session
            for session in self.store.session_summaries.values()
            if session.student_id == student_id
        ]
        return sorted(sessions, key=lambda item: item.created_at, reverse=True)

    def get_subtopic(self, subtopic_id: int):
        return self.store.subtopics[subtopic_id]

    def get_session_history(self, student_id: int, subtopic_id: int) -> list[SessionSummary]:
        sessions = [
            session
            for session in self.store.session_summaries.values()
            if session.student_id == student_id and session.subtopic_id == subtopic_id
        ]
        return sorted(sessions, key=lambda item: item.created_at, reverse=True)
