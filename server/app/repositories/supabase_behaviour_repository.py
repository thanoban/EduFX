from datetime import UTC, datetime

from supabase import Client

from app.models.domain import BehaviourLog, SessionSummary, Subtopic
from app.repositories.supabase_base import SupabaseMapper


class SupabaseBehaviourRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def add_snapshot(self, log: BehaviourLog) -> BehaviourLog:
        rows = self.client.table("behaviour_logs").insert(
            {
                "student_id": log.student_id,
                "session_id": log.session_id,
                "timestamp": log.timestamp.isoformat(),
                "face_detected": log.face_detected,
                "looking_away": log.looking_away,
                "phone_detected": log.phone_detected,
                "drowsy": log.drowsy,
                "multiple_persons": log.multiple_persons,
                "talking": log.talking,
                "absent": log.absent,
                "focus_score": log.focus_score,
            }
        ).execute().data
        return self.mapper.behaviour_log_from_row(self.mapper.ensure_one(rows, "Snapshot not saved", status_code=500))

    def get_session(self, session_id: int) -> SessionSummary:
        rows = self.client.table("session_summary").select("*").eq("id", session_id).limit(1).execute().data
        return self.mapper.session_from_row(self.mapper.ensure_one(rows, "Session not found"))

    def save_session(self, session: SessionSummary) -> None:
        self.client.table("session_summary").update(
            {
                "focus_score": session.focus_score,
                "phone_percent": session.phone_percent,
                "drowsy_percent": session.drowsy_percent,
                "away_percent": session.away_percent,
                "talking_percent": session.talking_percent,
                "absent_percent": session.absent_percent,
                "webcam_enabled": session.webcam_enabled,
            }
        ).eq("id", session.id).execute()

    def list_snapshots(self, session_id: int) -> list[BehaviourLog]:
        rows = self.client.table("behaviour_logs").select("*").eq("session_id", session_id).order("timestamp").execute().data or []
        return [self.mapper.behaviour_log_from_row(row) for row in rows]

    def list_student_sessions(self, student_id: int) -> list[SessionSummary]:
        rows = (
            self.client.table("session_summary")
            .select("*")
            .eq("student_id", student_id)
            .order("created_at", desc=True)
            .execute()
            .data
        ) or []
        return [self.mapper.session_from_row(row) for row in rows]

    def get_subtopic(self, subtopic_id: int) -> Subtopic | None:
        rows = self.client.table("subtopics").select("*").eq("id", subtopic_id).limit(1).execute().data or []
        return self.mapper.subtopic_from_row(rows[0]) if rows else None

    def now(self) -> datetime:
        return datetime.now(UTC)
