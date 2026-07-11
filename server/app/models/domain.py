from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime


@dataclass
class Student:
    id: int
    name: str
    email: str
    diagnostic_completed: bool
    role: str = "student"
    # Availability: which weekdays (0=Mon..6=Sun) the student is usually free,
    # and how long a typical session is — caps how many subtopics the
    # scheduler assigns per day (see core.rules.DURATION_TO_CAP) so a fully
    # free day still doesn't dump the whole syllabus in one sitting.
    free_days: set[int] = field(default_factory=set)
    session_length: str = "medium"  # "short" | "medium" | "long"
    # Per-day free time: weekday (0=Mon..6=Sun) -> that day's session-length
    # bucket. Lets the agent size each day to how much time the student actually
    # has on that specific day, like a real teacher. Keys are the free days;
    # `session_length` above is the fallback for any free day not listed here.
    day_session_length: dict[int, str] = field(default_factory=dict)
    # Set by the post-session "when are you next free?" check-in; lets the
    # reminder job flag a promised day even if it falls outside free_days.
    next_expected_date: date | None = None
    email_reminders_enabled: bool = True
    # Duolingo-style streak, updated whenever a session is finalized.
    current_streak: int = 0
    longest_streak: int = 0
    last_study_date: date | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class Subtopic:
    id: int
    group_name: str
    title: str
    order_index: int


@dataclass
class Content:
    id: int
    subtopic_id: int
    level: str
    body: str


@dataclass
class Question:
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
    is_diagnostic: bool
    concept: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class StudentProgress:
    id: int
    student_id: int
    subtopic_id: int
    current_level: str
    last_studied_date: date | None
    last_quiz_score: int
    total_sessions: int


@dataclass
class SessionSummary:
    id: int
    student_id: int
    subtopic_id: int
    session_date: date
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
    created_at: datetime
    sleeping_percent: int = 0
    other_voice_percent: int = 0
    object_percent: int = 0
    tab_switch_percent: int = 0


@dataclass
class BehaviourLog:
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
    # Second-generation proctoring signals (browser-side detectors). Defaulted
    # so older snapshots and clients that don't send them still deserialize:
    #   sleeping        - sustained eye-closure / head-drop (distinct from a blink-level `drowsy`)
    #   other_voice     - speech heard while the student's mouth is still (someone else talking)
    #   object_detected - a book / notes / second device found in frame by the object detector
    sleeping: bool = False
    other_voice: bool = False
    object_detected: bool = False
    # Deterministic integrity signal: the quiz tab was hidden or the window
    # unfocused at some point since the previous snapshot (exact browser event,
    # not CV inference).
    tab_hidden: bool = False


@dataclass
class QuizAttempt:
    id: int
    student_id: int
    session_id: int
    question_id: int
    subtopic_id: int
    student_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str | None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class QuestionAnswer:
    question: Question
    attempt: QuizAttempt
