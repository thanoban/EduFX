from supabase import Client

from app.models.domain import SessionSummary, Student, StudentProgress, Subtopic
from app.repositories.supabase_base import SupabaseMapper


class SupabaseAdminRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def list_students(self) -> list[Student]:
        rows = self.client.table("students").select("*").execute().data or []
        return [self.mapper.student_from_row(row) for row in rows]

    def list_subtopics(self) -> list[Subtopic]:
        return self.mapper.list_subtopics()

    def get_student_progress_all(self, student_id: int) -> list[StudentProgress]:
        self.mapper.ensure_progress_records(student_id)
        rows = self.client.table("student_progress").select("*").eq("student_id", student_id).execute().data or []
        return [self.mapper.progress_from_row(row) for row in rows]

    def get_student_sessions(self, student_id: int) -> list[SessionSummary]:
        rows = (
            self.client.table("session_summary")
            .select("*")
            .eq("student_id", student_id)
            .order("created_at", desc=True)
            .execute()
            .data
        ) or []
        return [self.mapper.session_from_row(row) for row in rows]

    def set_student_role(self, student_id: int, role: str) -> Student:
        rows = self.client.table("students").update({"role": role}).eq("id", student_id).execute().data
        row = self.mapper.ensure_one(rows, "Student not found", status_code=404)
        return self.mapper.student_from_row(row)

    def get_student_weak_attempts(self, student_id: int, recent_limit: int = 200) -> list[dict]:
        """Same shape/query as SupabaseQuizRepository.get_weak_attempts, but across
        every subtopic the student has attempted (no subtopic_id filter) — admin
        needs whole-history weak concepts, not just one subtopic's."""
        rows = (
            self.client.table("quiz_attempts")
            .select("is_correct, created_at, questions(concept, question_text, correct_answer)")
            .eq("student_id", student_id)
            .order("created_at", desc=True)
            .limit(recent_limit)
            .execute()
            .data
        ) or []
        attempts: list[dict] = []
        for row in rows:
            question = row.get("questions") or {}
            attempts.append(
                {
                    "concept": question.get("concept"),
                    "is_correct": bool(row.get("is_correct")),
                    "question_text": question.get("question_text"),
                    "correct_answer": question.get("correct_answer"),
                }
            )
        return attempts
