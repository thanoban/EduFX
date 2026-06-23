from supabase import Client

from app.models.domain import Question, Student, Subtopic
from app.repositories.supabase_base import SupabaseMapper


class SupabaseDiagnosticRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def get_diagnostic_questions(self) -> list[Question]:
        rows = (
            self.client.table("questions")
            .select("*")
            .eq("stage", "diagnostic")
            .order("id")
            .execute()
            .data
        ) or []
        return [self.mapper.question_from_row(row) for row in rows]

    def get_student(self, student_id: int) -> Student | None:
        rows = self.client.table("students").select("*").eq("id", student_id).limit(1).execute().data or []
        return self.mapper.student_from_row(rows[0]) if rows else None

    def get_subtopic(self, subtopic_id: int) -> Subtopic:
        rows = self.client.table("subtopics").select("*").eq("id", subtopic_id).limit(1).execute().data
        return self.mapper.subtopic_from_row(self.mapper.ensure_one(rows, "Subtopic not found"))

    def save_student_level(self, student_id: int, subtopic_id: int, level: str, score: int) -> None:
        self.mapper.ensure_progress_records(student_id)
        self.client.table("student_progress").upsert(
            {
                "student_id": student_id,
                "subtopic_id": subtopic_id,
                "current_level": level,
                "last_quiz_score": score,
            },
            on_conflict="student_id,subtopic_id",
        ).execute()

    def complete_diagnostic(self, student_id: int) -> None:
        self.client.table("students").update({"diagnostic_completed": True}).eq("id", student_id).execute()
