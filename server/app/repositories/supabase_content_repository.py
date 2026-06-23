from supabase import Client

from app.core.errors import EduFXError
from app.models.domain import Content, Subtopic
from app.repositories.supabase_base import SupabaseMapper


class SupabaseContentRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def list_subtopics(self) -> list[Subtopic]:
        return self.mapper.list_subtopics()

    def get_student_level(self, student_id: int, subtopic_id: int) -> str:
        self.mapper.ensure_progress_records(student_id)
        rows = (
            self.client.table("student_progress")
            .select("*")
            .eq("student_id", student_id)
            .eq("subtopic_id", subtopic_id)
            .limit(1)
            .execute()
            .data
        )
        return self.mapper.progress_from_row(self.mapper.ensure_one(rows, "Progress not found")).current_level

    def get_content(self, subtopic_id: int, level: str) -> Content:
        rows = (
            self.client.table("content")
            .select("*")
            .eq("subtopic_id", subtopic_id)
            .eq("level", level)
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            raise EduFXError("Content not found", status_code=404)
        return self.mapper.content_from_row(rows[0])

    def get_subtopic(self, subtopic_id: int) -> Subtopic:
        rows = self.client.table("subtopics").select("*").eq("id", subtopic_id).limit(1).execute().data
        return self.mapper.subtopic_from_row(self.mapper.ensure_one(rows, "Subtopic not found"))
