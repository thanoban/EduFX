from __future__ import annotations

from typing import Protocol

from app.models.dto import (
    BehaviourHistoryItemDTO,
    BehaviourSessionDTO,
    ContentDTO,
    DiagnosticQuestionDTO,
    DiagnosticResultDTO,
    ProgressRecordDTO,
    QuizPayloadDTO,
    QuizResultDTO,
    StudyPlanItemDTO,
    StudentProfileDTO,
)


class AuthServiceContract(Protocol):
    def login_with_google(self, token: str) -> StudentProfileDTO: ...
    def check_diagnostic(self, student_id: int) -> StudentProfileDTO: ...


class DiagnosticServiceContract(Protocol):
    def get_questions(self) -> list[DiagnosticQuestionDTO]: ...
    def submit(self, student_id: int, answers: list[dict[str, str | int]]) -> list[DiagnosticResultDTO]: ...


class SchedulerServiceContract(Protocol):
    def get_todays_plan(self, student_id: int) -> list[StudyPlanItemDTO]: ...


class ContentServiceContract(Protocol):
    def list_subtopics(self): ...
    def get_content(self, subtopic_id: int, student_id: int) -> ContentDTO: ...


class QuizServiceContract(Protocol):
    def get_quiz(self, student_id: int, subtopic_id: int) -> QuizPayloadDTO: ...
    def generate_quiz(self, student_id: int, subtopic_id: int) -> QuizPayloadDTO: ...


class ResultsServiceContract(Protocol):
    def submit_quiz(
        self,
        student_id: int,
        session_id: int,
        subtopic_id: int,
        webcam_enabled: bool,
        answers: list[dict[str, str | int]],
    ) -> QuizResultDTO: ...
    def get_session_results(self, session_id: int, student_id: int): ...


class ExplanationServiceContract(Protocol):
    def get_explanations(self, session_id: int, student_id: int) -> list[dict[str, str | int]]: ...


class ProgressServiceContract(Protocol):
    def get_progress(self, student_id: int) -> list[ProgressRecordDTO]: ...
    def get_subtopic_progress(self, student_id: int, subtopic_id: int) -> ProgressRecordDTO: ...


class BehaviourServiceContract(Protocol):
    def save_snapshot(self, payload: dict) -> dict: ...
    def save_summary(self, payload: dict) -> dict: ...
    def get_session(self, session_id: int) -> BehaviourSessionDTO: ...
    def get_student_history(self, student_id: int) -> list[BehaviourHistoryItemDTO]: ...
