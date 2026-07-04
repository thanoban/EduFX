from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from itertools import count

from app.core.curriculum_data import SUBTOPIC_NOTES, SUBTOPIC_QUESTIONS
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


SUBTOPIC_DEFINITIONS = [
    ("group1", "Group Trends"),
    ("group1", "Reactions of Group 1 Elements"),
    ("group1", "Thermal Stability of Salts"),
    ("group1", "Solubility of Group 1 Salts"),
    ("group1", "Flame Test"),
    ("group2", "Group Trends"),
    ("group2", "Reactions of Group 2 Elements"),
    ("group2", "Thermal Stability of Salts"),
    ("group2", "Solubility of Group 2 Salts"),
    ("group2", "Flame Test"),
]


@dataclass
class DemoDataStore:
    students: dict[int, Student] = field(default_factory=dict)
    subtopics: dict[int, Subtopic] = field(default_factory=dict)
    content_records: dict[int, Content] = field(default_factory=dict)
    questions: dict[int, Question] = field(default_factory=dict)
    student_progress: dict[tuple[int, int], StudentProgress] = field(default_factory=dict)
    session_summaries: dict[int, SessionSummary] = field(default_factory=dict)
    behaviour_logs: dict[int, list[BehaviourLog]] = field(default_factory=dict)
    quiz_attempts: dict[int, list[QuizAttempt]] = field(default_factory=dict)
    generated_questions_by_student: dict[tuple[int, int], list[int]] = field(default_factory=dict)
    counters: dict[str, count] = field(
        default_factory=lambda: {
            "student": count(1),
            "content": count(1),
            "question": count(1),
            "session": count(1),
            "behaviour": count(1),
            "attempt": count(1),
            "progress": count(1),
        }
    )

    def __post_init__(self) -> None:
        self._seed_subtopics()
        self._seed_content()
        self._seed_manual_questions()

    def _seed_subtopics(self) -> None:
        for index, (group_name, title) in enumerate(SUBTOPIC_DEFINITIONS, start=1):
            self.subtopics[index] = Subtopic(
                id=index,
                group_name=group_name,
                title=title,
                order_index=index,
            )

    def _seed_content(self) -> None:
        for subtopic in self.subtopics.values():
            levels = SUBTOPIC_NOTES.get(subtopic.id, {})
            for level in ("beginner", "intermediate", "advanced"):
                body = levels.get(level)
                if not body:
                    continue
                content_id = next(self.counters["content"])
                self.content_records[content_id] = Content(
                    id=content_id,
                    subtopic_id=subtopic.id,
                    level=level,
                    body=body,
                )

    def _seed_manual_questions(self) -> None:
        for subtopic in self.subtopics.values():
            stages = SUBTOPIC_QUESTIONS.get(subtopic.id, {})
            for stage in ("diagnostic", "first"):
                for seed in stages.get(stage, []):
                    question_id = next(self.counters["question"])
                    self.questions[question_id] = Question(
                        id=question_id,
                        subtopic_id=subtopic.id,
                        question_text=seed["question_text"],
                        option_a=seed["option_a"],
                        option_b=seed["option_b"],
                        option_c=seed["option_c"],
                        option_d=seed["option_d"],
                        correct_answer=seed["correct_answer"],
                        difficulty=seed["difficulty"],
                        source="manual",
                        stage=stage,
                        student_id=None,
                        is_diagnostic=stage == "diagnostic",
                        concept=seed["concept"],
                    )

    def clone_question(self, question: Question, student_id: int, stage: str) -> Question:
        question_id = next(self.counters["question"])
        clone = deepcopy(question)
        clone.id = question_id
        clone.student_id = student_id
        clone.stage = stage
        clone.source = "live-gen"
        self.questions[question_id] = clone
        return clone

    def create_student(self, name: str, email: str) -> Student:
        student_id = next(self.counters["student"])
        # The very first student created in a fresh demo store is the admin —
        # mirrors bootstrapping the first row via SQL against the real database,
        # without needing an env var for local/dev use.
        role = "admin" if student_id == 1 else "student"
        student = Student(id=student_id, name=name, email=email, diagnostic_completed=False, role=role)
        self.students[student_id] = student
        return student

    def set_student_role(self, student_id: int, role: str) -> Student:
        student = self.students[student_id]
        student.role = role
        return student

    def ensure_progress_records(self, student_id: int) -> None:
        for subtopic in self.subtopics.values():
            key = (student_id, subtopic.id)
            if key not in self.student_progress:
                self.student_progress[key] = StudentProgress(
                    id=next(self.counters["progress"]),
                    student_id=student_id,
                    subtopic_id=subtopic.id,
                    current_level="beginner",
                    last_studied_date=None,
                    last_quiz_score=0,
                    total_sessions=0,
                )

    def create_session(self, student_id: int, subtopic_id: int) -> SessionSummary:
        session_id = next(self.counters["session"])
        summary = SessionSummary(
            id=session_id,
            student_id=student_id,
            subtopic_id=subtopic_id,
            session_date=date.today(),
            quiz_score=0,
            focus_score=None,
            phone_percent=0,
            drowsy_percent=0,
            away_percent=0,
            talking_percent=0,
            absent_percent=0,
            webcam_enabled=False,
            total_questions=0,
            correct_answers=0,
            created_at=datetime.now(UTC),
        )
        self.session_summaries[session_id] = summary
        return summary

    def add_behaviour_log(self, session_id: int, log: BehaviourLog) -> BehaviourLog:
        log.id = next(self.counters["behaviour"])
        self.behaviour_logs.setdefault(session_id, []).append(log)
        return log

    def add_quiz_attempt(self, session_id: int, attempt: QuizAttempt) -> QuizAttempt:
        attempt.id = next(self.counters["attempt"])
        self.quiz_attempts.setdefault(session_id, []).append(attempt)
        return attempt

    def get_question_answers(self, session_id: int) -> list[QuestionAnswer]:
        attempts = self.quiz_attempts.get(session_id, [])
        answers: list[QuestionAnswer] = []
        for attempt in attempts:
            question = self.questions[attempt.question_id]
            answers.append(QuestionAnswer(question=question, attempt=attempt))
        return answers


demo_store = DemoDataStore()
