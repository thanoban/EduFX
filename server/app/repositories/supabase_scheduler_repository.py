from supabase import Client

from app.models.domain import StudentProgress, Subtopic
from app.repositories.supabase_base import SupabaseMapper


class SupabaseSchedulerRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def get_student_progress(self, student_id: int) -> list[StudentProgress]:
        self.mapper.ensure_progress_records(student_id)
        rows = self.client.table("student_progress").select("*").eq("student_id", student_id).execute().data or []
        return [self.mapper.progress_from_row(row) for row in rows]

    def get_subtopic(self, subtopic_id: int) -> Subtopic:
        rows = self.client.table("subtopics").select("*").eq("id", subtopic_id).limit(1).execute().data
        return self.mapper.subtopic_from_row(self.mapper.ensure_one(rows, "Subtopic not found"))
