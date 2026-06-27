from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from itertools import count

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


def _option_set(correct: str) -> tuple[str, str, str, str]:
    distractors = {
        "A": ("B", "C", "D"),
        "B": ("A", "C", "D"),
        "C": ("A", "B", "D"),
        "D": ("A", "B", "C"),
    }
    return (correct, *distractors[correct])


def _make_question(question_id: int, subtopic_id: int, stage: str, index: int, title: str, correct: str) -> Question:
    answer_letters = _option_set(correct)
    # Group questions under a few repeating concepts per subtopic so concept-level
    # mastery (weak vs mastered) is meaningful in demo/test mode.
    concept = f"{title.lower()} concept {((index - 1) % 3) + 1}"
    return Question(
        id=question_id,
        subtopic_id=subtopic_id,
        question_text=f"{title}: concept check {index} for the {stage} stage.",
        option_a=f"{title} explanation option {answer_letters[0]}",
        option_b=f"{title} explanation option {answer_letters[1]}",
        option_c=f"{title} explanation option {answer_letters[2]}",
        option_d=f"{title} explanation option {answer_letters[3]}",
        correct_answer=correct,
        difficulty="easy" if index <= 5 else "medium" if index <= 10 else "hard",
        source="manual",
        stage=stage,
        student_id=None,
        is_diagnostic=stage == "diagnostic",
        concept=concept,
    )


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
        notes = {
            "beginner": "Start with visible trends, simple examples, and exam-safe summaries.",
            "intermediate": "Connect the trend to ionisation energy, lattice effects, and reaction patterns.",
            "advanced": "Compare anomalies, explain mechanisms, and justify observations with balanced reasoning.",
        }
        for subtopic in self.subtopics.values():
            for level, sentence in notes.items():
                content_id = next(self.counters["content"])
                self.content_records[content_id] = Content(
                    id=content_id,
                    subtopic_id=subtopic.id,
                    level=level,
                    body=(
                        f"# {subtopic.title}\n\n"
                        f"## {level.title()} pathway\n\n"
                        f"{sentence}\n\n"
                        f"- Group: {subtopic.group_name}\n"
                        f"- Study focus: {subtopic.title.lower()}\n"
                        f"- Practice lens: adapt concepts to S-block chemistry examples."
                    ),
                )

    def _seed_manual_questions(self) -> None:
        answer_cycle = ("A", "B", "C", "D")
        for subtopic in self.subtopics.values():
            for index in range(1, 5):
                question_id = next(self.counters["question"])
                self.questions[question_id] = _make_question(
                    question_id,
                    subtopic.id,
                    "diagnostic",
                    index,
                    subtopic.title,
                    answer_cycle[(index - 1) % len(answer_cycle)],
                )
            for index in range(1, 16):
                question_id = next(self.counters["question"])
                self.questions[question_id] = _make_question(
                    question_id,
                    subtopic.id,
                    "first",
                    index,
                    subtopic.title,
                    answer_cycle[(subtopic.id + index - 1) % len(answer_cycle)],
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
        student = Student(id=student_id, name=name, email=email, diagnostic_completed=False)
        self.students[student_id] = student
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
