from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from supabase import Client

from app.core.errors import EduFXError
from app.models.domain import (
    BehaviourLog,
    Content,
    Question,
    QuestionAnswer,
    QuizAttempt,
    SessionSummary,
    Student,
    StudentProgress,
    Subtopic,
)


def _parse_date(value: str | date | None) -> date | None:
    if value is None or isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(str(value)[:10])


def _parse_datetime(value: str | datetime | None) -> datetime:
    if isinstance(value, datetime):
        return value
    if value is None:
        return datetime.now(UTC)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


@dataclass
class SupabaseMapper:
    client: Client

    def ensure_one(self, data: list[dict[str, Any]] | None, message: str, status_code: int = 404) -> dict[str, Any]:
        if not data:
            raise EduFXError(message, status_code=status_code)
        return data[0]

    def list_subtopics(self) -> list[Subtopic]:
        rows = (
            self.client.table("subtopics")
            .select("*")
            .order("order_index")
            .execute()
            .data
        )
        return [self.subtopic_from_row(row) for row in rows or []]

    def ensure_progress_records(self, student_id: int) -> None:
        subtopics = self.list_subtopics()
        existing = (
            self.client.table("student_progress")
            .select("subtopic_id")
            .eq("student_id", student_id)
            .execute()
            .data
        ) or []
        existing_ids = {int(row["subtopic_id"]) for row in existing}
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

    @staticmethod
    def student_from_row(row: dict[str, Any]) -> Student:
        return Student(
            id=int(row["id"]),
            name=str(row["name"]),
            email=str(row["email"]),
            diagnostic_completed=bool(row.get("diagnostic_completed", False)),
            created_at=_parse_datetime(row.get("created_at")),
        )

    @staticmethod
    def subtopic_from_row(row: dict[str, Any]) -> Subtopic:
        return Subtopic(
            id=int(row["id"]),
            group_name=str(row["group_name"]),
            title=str(row["title"]),
            order_index=int(row["order_index"]),
        )

    @staticmethod
    def content_from_row(row: dict[str, Any]) -> Content:
        return Content(
            id=int(row["id"]),
            subtopic_id=int(row["subtopic_id"]),
            level=str(row["level"]),
            body=str(row["body"]),
        )

    @staticmethod
    def question_from_row(row: dict[str, Any]) -> Question:
        return Question(
            id=int(row["id"]),
            subtopic_id=int(row["subtopic_id"]),
            question_text=str(row["question_text"]),
            option_a=str(row["option_a"]),
            option_b=str(row["option_b"]),
            option_c=str(row["option_c"]),
            option_d=str(row["option_d"]),
            correct_answer=str(row["correct_answer"]),
            difficulty=str(row["difficulty"]),
            source=str(row["source"]),
            stage=str(row["stage"]),
            student_id=int(row["student_id"]) if row.get("student_id") is not None else None,
            is_diagnostic=bool(row.get("is_diagnostic", False)),
            created_at=_parse_datetime(row.get("created_at")),
        )

    @staticmethod
    def progress_from_row(row: dict[str, Any]) -> StudentProgress:
        return StudentProgress(
            id=int(row["id"]),
            student_id=int(row["student_id"]),
            subtopic_id=int(row["subtopic_id"]),
            current_level=str(row["current_level"]),
            last_studied_date=_parse_date(row.get("last_studied_date")),
            last_quiz_score=int(row.get("last_quiz_score") or 0),
            total_sessions=int(row.get("total_sessions") or 0),
        )

    @staticmethod
    def session_from_row(row: dict[str, Any]) -> SessionSummary:
        return SessionSummary(
            id=int(row["id"]),
            student_id=int(row["student_id"]),
            subtopic_id=int(row["subtopic_id"]),
            session_date=_parse_date(row.get("session_date")) or date.today(),
            quiz_score=int(row.get("quiz_score") or 0),
            focus_score=int(row["focus_score"]) if row.get("focus_score") is not None else None,
            phone_percent=int(row.get("phone_percent") or 0),
            drowsy_percent=int(row.get("drowsy_percent") or 0),
            away_percent=int(row.get("away_percent") or 0),
            talking_percent=int(row.get("talking_percent") or 0),
            absent_percent=int(row.get("absent_percent") or 0),
            webcam_enabled=bool(row.get("webcam_enabled", False)),
            total_questions=int(row.get("total_questions") or 0),
            correct_answers=int(row.get("correct_answers") or 0),
            created_at=_parse_datetime(row.get("created_at")),
        )

    @staticmethod
    def behaviour_log_from_row(row: dict[str, Any]) -> BehaviourLog:
        return BehaviourLog(
            id=int(row["id"]),
            student_id=int(row["student_id"]),
            session_id=int(row["session_id"]),
            timestamp=_parse_datetime(row.get("timestamp")),
            face_detected=bool(row.get("face_detected", True)),
            looking_away=bool(row.get("looking_away", False)),
            phone_detected=bool(row.get("phone_detected", False)),
            drowsy=bool(row.get("drowsy", False)),
            multiple_persons=bool(row.get("multiple_persons", False)),
            talking=bool(row.get("talking", False)),
            absent=bool(row.get("absent", False)),
            focus_score=int(row.get("focus_score") or 0),
        )

    @staticmethod
    def attempt_from_row(row: dict[str, Any]) -> QuizAttempt:
        return QuizAttempt(
            id=int(row["id"]),
            student_id=int(row["student_id"]),
            session_id=int(row["session_id"]),
            question_id=int(row["question_id"]),
            subtopic_id=int(row["subtopic_id"]),
            student_answer=str(row["student_answer"]),
            correct_answer=str(row["correct_answer"]),
            is_correct=bool(row["is_correct"]),
            explanation=str(row["explanation"]) if row.get("explanation") is not None else None,
            created_at=_parse_datetime(row.get("created_at")),
        )

    def question_answers(self, attempts: list[QuizAttempt]) -> list[QuestionAnswer]:
        answers: list[QuestionAnswer] = []
        for attempt in attempts:
            question_rows = (
                self.client.table("questions")
                .select("*")
                .eq("id", attempt.question_id)
                .limit(1)
                .execute()
                .data
            )
            question = self.question_from_row(self.ensure_one(question_rows, "Question not found"))
            answers.append(QuestionAnswer(question=question, attempt=attempt))
        return answers
