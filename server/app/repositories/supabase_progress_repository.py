from supabase import Client

from app.models.domain import SessionSummary, StudentProgress, Subtopic
from app.repositories.supabase_base import SupabaseMapper


class SupabaseProgressRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def get_progress_records(self, student_id: int) -> list[StudentProgress]:
        subtopics = self.mapper.list_subtopics()
        rows = self.client.table("student_progress").select("*").eq("student_id", student_id).execute().data or []
        existing_ids = {int(row["subtopic_id"]) for row in rows}
        missing = [
            {
                "student_id": student_id,
                "subtopic_id": subtopic.id,
                "current_level": "beginner",
                "last_quiz_score": 0,
                "total_sessions": 0,
            }
            for subtopic in subtopics
            if subtopic.id not in existing_ids
        ]
        if missing:
            self.client.table("student_progress").upsert(
                missing,
                on_conflict="student_id,subtopic_id",
            ).execute()
            rows = self.client.table("student_progress").select("*").eq("student_id", student_id).execute().data or []
        return [self.mapper.progress_from_row(row) for row in rows]

    def list_subtopics(self) -> list[Subtopic]:
        return self.mapper.list_subtopics()

    def get_student_session_history(self, student_id: int) -> list[SessionSummary]:
        rows = (
            self.client.table("session_summary")
            .select("*")
            .eq("student_id", student_id)
            .order("created_at", desc=True)
            .execute()
            .data
        ) or []
        return [self.mapper.session_from_row(row) for row in rows]

    def get_subtopic(self, subtopic_id: int) -> Subtopic:
        rows = self.client.table("subtopics").select("*").eq("id", subtopic_id).limit(1).execute().data
        return self.mapper.subtopic_from_row(self.mapper.ensure_one(rows, "Subtopic not found"))

    def get_session_history(self, student_id: int, subtopic_id: int) -> list[SessionSummary]:
        rows = (
            self.client.table("session_summary")
            .select("*")
            .eq("student_id", student_id)
            .eq("subtopic_id", subtopic_id)
            .order("created_at", desc=True)
            .execute()
            .data
        ) or []
        return [self.mapper.session_from_row(row) for row in rows]
