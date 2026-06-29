import httpx
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
        try:
            rows = self.client.table("students").insert({"name": name, "email": email}).execute().data
            row = self.mapper.ensure_one(rows, "Student could not be created", status_code=500)
            student = self.mapper.student_from_row(row)
        except httpx.HTTPStatusError as error:
            if error.response.status_code != 409:
                raise

            # Duplicate first-login requests can race on the unique email
            # constraint. Treat that as a successful "someone else created it
            # first" outcome and continue with the existing student record.
            existing_student = self.find_student_by_email(email)
            if existing_student is None:
                raise
            student = existing_student

        self.mapper.ensure_progress_records(student.id)
        return student

    def get_student(self, student_id: int) -> Student | None:
        rows = self.client.table("students").select("*").eq("id", student_id).limit(1).execute().data or []
        return self.mapper.student_from_row(rows[0]) if rows else None
