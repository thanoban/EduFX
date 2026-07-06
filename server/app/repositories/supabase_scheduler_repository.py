from supabase import Client

from app.models.domain import StudentProgress, Subtopic
from app.repositories.supabase_base import SupabaseMapper


class SupabaseSchedulerRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def get_student_progress(self, student_id: int) -> list[StudentProgress]:
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

    def get_subtopic(self, subtopic_id: int) -> Subtopic:
        rows = self.client.table("subtopics").select("*").eq("id", subtopic_id).limit(1).execute().data
        return self.mapper.subtopic_from_row(self.mapper.ensure_one(rows, "Subtopic not found"))
