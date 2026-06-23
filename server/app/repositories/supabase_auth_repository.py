from supabase import Client

from app.models.domain import Student
from app.repositories.supabase_base import SupabaseMapper


class SupabaseAuthRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def find_student_by_email(self, email: str) -> Student | None:
        rows = self.client.table("students").select("*").eq("email", email).limit(1).execute().data or []
        return self.mapper.student_from_row(rows[0]) if rows else None

    def create_student(self, name: str, email: str) -> Student:
        rows = self.client.table("students").insert({"name": name, "email": email}).execute().data
        row = self.mapper.ensure_one(rows, "Student could not be created", status_code=500)
        student = self.mapper.student_from_row(row)
        self.mapper.ensure_progress_records(student.id)
        return student

    def get_student(self, student_id: int) -> Student | None:
        rows = self.client.table("students").select("*").eq("id", student_id).limit(1).execute().data or []
        return self.mapper.student_from_row(rows[0]) if rows else None
