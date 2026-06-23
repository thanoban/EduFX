from datetime import date

from supabase import Client

from app.models.domain import Question, SessionSummary, StudentProgress
from app.repositories.supabase_base import SupabaseMapper


class SupabaseQuizRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def get_progress(self, student_id: int, subtopic_id: int) -> StudentProgress:
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
        return self.mapper.progress_from_row(self.mapper.ensure_one(rows, "Progress not found"))

    def get_manual_questions(self, subtopic_id: int) -> list[Question]:
        rows = (
            self.client.table("questions")
            .select("*")
            .eq("subtopic_id", subtopic_id)
            .eq("stage", "first")
            .order("id")
            .execute()
            .data
        ) or []
        return [self.mapper.question_from_row(row) for row in rows]

    def create_personalized_questions(self, student_id: int, subtopic_id: int, level: str) -> list[Question]:
        manual = self.get_manual_questions(subtopic_id)
        attempt_rows = (
            self.client.table("quiz_attempts")
            .select("*")
            .eq("student_id", student_id)
            .eq("subtopic_id", subtopic_id)
            .eq("is_correct", False)
            .order("created_at", desc=True)
            .execute()
            .data
        ) or []
        wrong_ids = [int(row["question_id"]) for row in attempt_rows]
        prioritized: list[Question] = []
        focused = [question for question in manual if question.id in wrong_ids]
        remaining = [question for question in manual if question.id not in wrong_ids]
        difficulty_map = {"beginner": "easy", "intermediate": "medium", "advanced": "hard"}
        level_target = difficulty_map[level]
        level_matched = [question for question in manual if question.difficulty == level_target]
        untouched = [question for question in remaining if question.id not in wrong_ids]

        def add_batch(batch: list[Question], limit: int) -> None:
            for question in batch:
                if question not in prioritized:
                    prioritized.append(question)
                if len(prioritized) >= limit:
                    break

        add_batch(focused, 6)
        add_batch(remaining, 10)
        add_batch(level_matched, 13)
        add_batch(list(reversed(untouched or manual)), 15)
        add_batch(manual, 15)
        picked = prioritized[:15]

        insert_rows = [
            {
                "subtopic_id": question.subtopic_id,
                "question_text": question.question_text,
                "option_a": question.option_a,
                "option_b": question.option_b,
                "option_c": question.option_c,
                "option_d": question.option_d,
                "correct_answer": question.correct_answer,
                "difficulty": question.difficulty,
                "source": "live-gen",
                "stage": "personalized",
                "student_id": student_id,
                "is_diagnostic": False,
            }
            for question in picked
        ]
        rows = self.client.table("questions").insert(insert_rows).execute().data or []
        return [self.mapper.question_from_row(row) for row in rows]

    def create_session(self, student_id: int, subtopic_id: int) -> SessionSummary:
        rows = self.client.table("session_summary").insert(
            {
                "student_id": student_id,
                "subtopic_id": subtopic_id,
                "session_date": date.today().isoformat(),
            }
        ).execute().data
        return self.mapper.session_from_row(self.mapper.ensure_one(rows, "Session could not be created", status_code=500))

    def get_subtopic_title(self, subtopic_id: int) -> str:
        rows = self.client.table("subtopics").select("title").eq("id", subtopic_id).limit(1).execute().data
        return str(self.mapper.ensure_one(rows, "Subtopic not found")["title"])

    def get_generated_questions(self, student_id: int, subtopic_id: int) -> list[Question]:
        rows = (
            self.client.table("questions")
            .select("*")
            .eq("student_id", student_id)
            .eq("subtopic_id", subtopic_id)
            .eq("stage", "personalized")
            .order("created_at", desc=True)
            .limit(15)
            .execute()
            .data
        ) or []
        return [self.mapper.question_from_row(row) for row in rows]
