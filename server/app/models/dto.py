from __future__ import annotations

from datetime import date, datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")

LevelLiteral = Literal["beginner", "intermediate", "advanced"]


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    message: str
    data: T | None


class StudentProfileDTO(BaseModel):
    student_id: int
    name: str
    email: str
    diagnostic_completed: bool


class DiagnosticQuestionDTO(BaseModel):
    id: int
    subtopic_id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str


class DiagnosticAnswerDTO(BaseModel):
    question_id: int
    subtopic_id: int
    student_answer: str


class DiagnosticSubmitRequest(BaseModel):
    student_id: int
    answers: list[DiagnosticAnswerDTO]


class DiagnosticResultDTO(BaseModel):
    subtopic_id: int
    subtopic_title: str
    score_percent: int
    assigned_level: LevelLiteral


class StudyPlanItemDTO(BaseModel):
    subtopic_id: int
    subtopic_title: str
    group_name: str
    current_level: LevelLiteral
    is_overdue: bool
    last_quiz_score: int
    last_studied_date: date | None
    type: Literal["weak", "strong"]


class ContentDTO(BaseModel):
    id: int
    subtopic_id: int
    body: str
    level: LevelLiteral
    subtopic_title: str
    group_name: str


class QuizQuestionDTO(BaseModel):
    id: int
    subtopic_id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    difficulty: str
    source: str
    stage: str
    student_id: int | None
    concept: str | None = None


class QuizPayloadDTO(BaseModel):
    session_id: int
    subtopic_id: int
    subtopic_title: str
    stage: str
    total_questions: int
    questions: list[QuizQuestionDTO]


class GenerateQuizRequest(BaseModel):
    student_id: int
    subtopic_id: int


class BehaviourSnapshotRequest(BaseModel):
    student_id: int
    session_id: int
    face_detected: bool
    looking_away: bool
    phone_detected: bool
    drowsy: bool
    multiple_persons: bool
    talking: bool
    absent: bool
    focus_score: int


class BehaviourSummaryRequest(BaseModel):
    student_id: int
    session_id: int
    subtopic_id: int
    webcam_enabled: bool
    phone_percent: int
    drowsy_percent: int
    away_percent: int
    talking_percent: int
    absent_percent: int
    focus_score: int


class QuizAnswerDTO(BaseModel):
    question_id: int
    student_answer: str


class QuizSubmitRequest(BaseModel):
    student_id: int
    session_id: int
    subtopic_id: int
    webcam_enabled: bool
    answers: list[QuizAnswerDTO]


class QuizResultDTO(BaseModel):
    session_id: int
    total_questions: int
    correct_answers: int
    quiz_score: int
    previous_level: LevelLiteral
    new_level: LevelLiteral
    level_changed: bool
    wrong_count: int


class ExplanationDTO(BaseModel):
    attempt_id: int
    explanation: str


class QuestionWithAttemptDTO(BaseModel):
    id: int
    question_id: int
    student_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str | None
    question: QuizQuestionDTO


class SessionResultsDTO(BaseModel):
    id: int
    student_id: int
    subtopic_id: int
    quiz_score: int
    focus_score: int | None
    phone_percent: int
    drowsy_percent: int
    away_percent: int
    talking_percent: int
    absent_percent: int
    webcam_enabled: bool
    total_questions: int
    correct_answers: int
    attempts: list[QuestionWithAttemptDTO]


class ProgressHistoryItemDTO(BaseModel):
    id: int
    session_date: date
    quiz_score: int
    focus_score: int | None
    created_at: datetime


class SubtopicLiteDTO(BaseModel):
    id: int
    title: str
    group_name: str


class ProgressRecordDTO(BaseModel):
    id: int
    subtopic_id: int
    current_level: LevelLiteral
    last_studied_date: date | None
    last_quiz_score: int
    total_sessions: int
    subtopics: SubtopicLiteDTO
    session_history: list[ProgressHistoryItemDTO] = []


class BehaviourSnapshotDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    session_id: int
    timestamp: datetime
    face_detected: bool
    looking_away: bool
    phone_detected: bool
    drowsy: bool
    multiple_persons: bool
    talking: bool
    absent: bool
    focus_score: int


class BehaviourSessionDTO(BaseModel):
    student_id: int
    session_id: int
    subtopic_id: int
    webcam_enabled: bool
    phone_percent: int
    drowsy_percent: int
    away_percent: int
    talking_percent: int
    absent_percent: int
    focus_score: int | None
    snapshots: list[BehaviourSnapshotDTO]


class BehaviourHistoryItemDTO(BaseModel):
    id: int
    student_id: int
    subtopic_id: int
    session_date: date
    quiz_score: int | None
    focus_score: int | None
    phone_percent: int
    drowsy_percent: int
    away_percent: int
    talking_percent: int
    absent_percent: int
    webcam_enabled: bool
    total_questions: int
    correct_answers: int
    created_at: datetime
    subtopics: SubtopicLiteDTO | None

