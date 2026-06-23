from datetime import date

from supabase import Client

from app.models.domain import Question, QuestionAnswer, QuizAttempt, SessionSummary, StudentProgress
from app.repositories.supabase_base import SupabaseMapper


class SupabaseResultsRepository:
    def __init__(self, client: Client) -> None:
        self.mapper = SupabaseMapper(client)
        self.client = client

    def get_session(self, session_id: int) -> SessionSummary:
        rows = self.client.table("session_summary").select("*").eq("id", session_id).limit(1).execute().data
        return self.mapper.session_from_row(self.mapper.ensure_one(rows, "Session not found"))

    def get_question(self, question_id: int) -> Question:
        rows = self.client.table("questions").select("*").eq("id", question_id).limit(1).execute().data
        return self.mapper.question_from_row(self.mapper.ensure_one(rows, "Question not found"))

    def add_attempt(self, attempt: QuizAttempt) -> QuizAttempt:
        rows = self.client.table("quiz_attempts").insert(
            {
                "student_id": attempt.student_id,
                "session_id": attempt.session_id,
                "question_id": attempt.question_id,
                "subtopic_id": attempt.subtopic_id,
                "student_answer": attempt.student_answer,
                "correct_answer": attempt.correct_answer,
                "is_correct": attempt.is_correct,
                "explanation": attempt.explanation,
            }
        ).execute().data
        return self.mapper.attempt_from_row(self.mapper.ensure_one(rows, "Quiz attempt not saved", status_code=500))

    def get_attempts(self, session_id: int) -> list[QuizAttempt]:
        rows = self.client.table("quiz_attempts").select("*").eq("session_id", session_id).order("id").execute().data or []
        return [self.mapper.attempt_from_row(row) for row in rows]

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

    def save_progress(self, progress: StudentProgress) -> None:
        progress.last_studied_date = date.today()
        self.client.table("student_progress").update(
            {
                "current_level": progress.current_level,
                "last_studied_date": progress.last_studied_date.isoformat(),
                "last_quiz_score": progress.last_quiz_score,
                "total_sessions": progress.total_sessions,
            }
        ).eq("id", progress.id).execute()

    def save_session(self, session: SessionSummary) -> None:
        self.client.table("session_summary").update(
            {
                "quiz_score": session.quiz_score,
                "focus_score": session.focus_score,
                "phone_percent": session.phone_percent,
                "drowsy_percent": session.drowsy_percent,
                "away_percent": session.away_percent,
                "talking_percent": session.talking_percent,
                "absent_percent": session.absent_percent,
                "webcam_enabled": session.webcam_enabled,
                "total_questions": session.total_questions,
                "correct_answers": session.correct_answers,
            }
        ).eq("id", session.id).execute()

    def get_question_answers(self, session_id: int) -> list[QuestionAnswer]:
        return self.mapper.question_answers(self.get_attempts(session_id))
