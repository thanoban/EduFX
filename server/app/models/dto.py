from __future__ import annotations

from datetime import date, datetime
from typing import Any, Generic, Literal, TypeVar

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
    is_admin: bool = False
    free_days: list[int] = []
    session_length: Literal["short", "medium", "long"] = "medium"
    day_session_length: dict[int, Literal["short", "medium", "long"]] = {}
    next_expected_date: date | None = None
    email_reminders_enabled: bool = True
    current_streak: int = 0
    longest_streak: int = 0
    last_study_date: date | None = None

    @classmethod
    def from_student(cls, student: Any) -> "StudentProfileDTO":
        """Single mapping point from the Student domain model, so every caller
        (login, check, settings save) stays in sync when fields are added."""
        return cls(
            student_id=student.id,
            name=student.name,
            email=student.email,
            diagnostic_completed=student.diagnostic_completed,
            is_admin=student.role == "admin",
            free_days=sorted(student.free_days),
            session_length=student.session_length,
            day_session_length=dict(student.day_session_length),
            next_expected_date=student.next_expected_date,
            email_reminders_enabled=student.email_reminders_enabled,
            current_streak=student.current_streak,
            longest_streak=student.longest_streak,
            last_study_date=student.last_study_date,
        )


class UpdateAvailabilityRequest(BaseModel):
    free_days: list[int]
    session_length: Literal["short", "medium", "long"]
    # Per-day override map (weekday -> bucket). When non-empty it's the source of
    # truth for which days are free; free_days/session_length above stay for
    # backward compatibility with older clients that only send a single length.
    day_session_length: dict[int, Literal["short", "medium", "long"]] = {}
    email_reminders_enabled: bool = True


NextFreeChoice = Literal["tomorrow", "in_2_days", "this_weekend", "not_sure"]


class NextFreeCheckInRequest(BaseModel):
    choice: NextFreeChoice


class TeacherChatMessageDTO(BaseModel):
    role: Literal["student", "teacher"]
    content: str


class TeacherChatRequest(BaseModel):
    message: str
    # Prior turns, oldest-first; the server rebuilds the fresh data dossier each
    # turn so history only needs the conversation text, not any student data.
    history: list[TeacherChatMessageDTO] = []


class TeacherReplyDTO(BaseModel):
    reply: str


class TeacherReportDTO(BaseModel):
    report: str


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


class DiagnosticSelfAssessmentDTO(BaseModel):
    subtopic_id: int
    # "weak" is trusted outright (see DiagnosticService.submit): a student who
    # says they're weak gets beginner regardless of a lucky quiz score.
    # "confident" is verified against the quiz score instead of taken at face
    # value, since overconfidence risks placing them in content too hard.
    rating: Literal["weak", "confident"]


class DiagnosticSubmitRequest(BaseModel):
    student_id: int
    answers: list[DiagnosticAnswerDTO]
    # Optional per-subtopic self-rating collected once before the diagnostic
    # quiz. Missing/omitted subtopics fall back to the quiz score alone.
    self_assessments: list[DiagnosticSelfAssessmentDTO] = []


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
    # New proctoring flags; defaulted so older clients stay compatible.
    sleeping: bool = False
    other_voice: bool = False
    object_detected: bool = False
    tab_hidden: bool = False


class BehaviourSummaryRequest(BaseModel):
    student_id: int
    session_id: int
    subtopic_id: int
    webcam_enabled: bool
    # Percentages and focus are advisory only — the server recomputes them from
    # the stored snapshots so it stays the source of truth.
    phone_percent: int = 0
    drowsy_percent: int = 0
    away_percent: int = 0
    talking_percent: int = 0
    absent_percent: int = 0
    focus_score: int | None = None


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
    sleeping: bool = False
    other_voice: bool = False
    object_detected: bool = False
    tab_hidden: bool = False


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
    sleeping_percent: int = 0
    other_voice_percent: int = 0
    object_percent: int = 0
    tab_switch_percent: int = 0
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
    sleeping_percent: int = 0
    other_voice_percent: int = 0
    object_percent: int = 0
    tab_switch_percent: int = 0
    webcam_enabled: bool
    total_questions: int
    correct_answers: int
    created_at: datetime
    subtopics: SubtopicLiteDTO | None


class AdminStudentSummaryDTO(BaseModel):
    student_id: int
    name: str
    email: str
    role: Literal["student", "admin"]
    diagnostic_completed: bool
    subtopics_mastered: int
    avg_focus_score: int | None
    total_sessions: int
    last_active_date: date | None


class AdminWeakConceptDTO(BaseModel):
    concept: str
    attempts: int
    correct: int
    accuracy: float
    sample_question: str | None


class AdminSessionHistoryItemDTO(BaseModel):
    session_id: int
    subtopic_id: int
    subtopic_title: str
    session_date: date
    quiz_score: int
    focus_score: int | None


class AdminStudentDetailDTO(BaseModel):
    student_id: int
    name: str
    email: str
    role: Literal["student", "admin"]
    diagnostic_completed: bool
    progress: list[ProgressRecordDTO]
    session_history: list[AdminSessionHistoryItemDTO]
    weak_concepts: list[AdminWeakConceptDTO]


class SetStudentRoleRequest(BaseModel):
    role: Literal["student", "admin"]
