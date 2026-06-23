from datetime import UTC, datetime

from app.core.errors import EduFXError
from app.core.store import DemoDataStore
from app.models.domain import BehaviourLog, SessionSummary


class BehaviourRepository:
    def __init__(self, store: DemoDataStore) -> None:
        self.store = store

    def add_snapshot(self, log: BehaviourLog) -> BehaviourLog:
        return self.store.add_behaviour_log(log.session_id, log)

    def get_session(self, session_id: int) -> SessionSummary:
        if session_id not in self.store.session_summaries:
            raise EduFXError("Session not found", status_code=404)
        return self.store.session_summaries[session_id]

    def save_session(self, session: SessionSummary) -> None:
        self.store.session_summaries[session.id] = session

    def list_snapshots(self, session_id: int) -> list[BehaviourLog]:
        return self.store.behaviour_logs.get(session_id, [])

    def list_student_sessions(self, student_id: int) -> list[SessionSummary]:
        sessions = [session for session in self.store.session_summaries.values() if session.student_id == student_id]
        return sorted(sessions, key=lambda item: item.created_at, reverse=True)

    def now(self) -> datetime:
        return datetime.now(UTC)
