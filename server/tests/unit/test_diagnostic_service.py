from app.models.domain import Question, Student, Subtopic
from app.services.diagnostic_service import DiagnosticService


_SUBTOPIC_COUNT = 10
_QUESTIONS_PER_SUBTOPIC = 4


class _FakeDiagnosticRepository:
    """Minimal fake conforming to DiagnosticRepositoryContract — 10 subtopics
    with 4 diagnostic questions each, matching the production curriculum shape
    that DiagnosticService.submit() asserts (`len(results) != 10`)."""

    def __init__(self) -> None:
        self.student = Student(id=1, name="Ali", email="ali@example.com", diagnostic_completed=False)
        self.subtopics = {
            subtopic_id: Subtopic(id=subtopic_id, group_name=f"group{subtopic_id}", title=f"Subtopic {subtopic_id}", order_index=subtopic_id)
            for subtopic_id in range(1, _SUBTOPIC_COUNT + 1)
        }
        self.questions = [
            Question(
                id=(subtopic_id - 1) * _QUESTIONS_PER_SUBTOPIC + offset,
                subtopic_id=subtopic_id,
                question_text=f"Subtopic {subtopic_id} Q{offset}",
                option_a="A",
                option_b="B",
                option_c="C",
                option_d="D",
                correct_answer="A",
                difficulty="easy",
                source="seed",
                stage="diagnostic",
                student_id=None,
                is_diagnostic=True,
            )
            for subtopic_id in range(1, _SUBTOPIC_COUNT + 1)
            for offset in range(1, _QUESTIONS_PER_SUBTOPIC + 1)
        ]
        self.saved_levels: dict[int, tuple[str, int]] = {}
        self.completed = False

    def get_diagnostic_questions(self) -> list[Question]:
        return list(self.questions)

    def get_student(self, student_id: int) -> Student | None:
        return self.student if student_id == self.student.id else None

    def get_subtopic(self, subtopic_id: int) -> Subtopic:
        return self.subtopics[subtopic_id]

    def save_student_level(self, student_id: int, subtopic_id: int, level: str, score: int) -> None:
        self.saved_levels[subtopic_id] = (level, score)

    def complete_diagnostic(self, student_id: int) -> None:
        self.completed = True


def _all_correct_answers(repo: _FakeDiagnosticRepository) -> list[dict]:
    return [
        {"question_id": question.id, "subtopic_id": question.subtopic_id, "student_answer": "A"}
        for question in repo.questions
    ]


def test_submit_uses_quiz_score_when_no_self_assessment():
    repo = _FakeDiagnosticRepository()
    service = DiagnosticService(repo)

    results = service.submit(1, _all_correct_answers(repo))

    assert results[0].score_percent == 100
    assert results[0].assigned_level == "advanced"
    assert repo.saved_levels[1] == ("advanced", 100)
    assert repo.completed is True


def test_submit_trusts_weak_self_assessment_over_a_perfect_score():
    # Student scores 100% but rates themself "weak" on this subtopic — the
    # self-report should win and place them as beginner regardless.
    repo = _FakeDiagnosticRepository()
    service = DiagnosticService(repo)

    results = service.submit(
        1,
        _all_correct_answers(repo),
        self_assessments=[{"subtopic_id": 1, "rating": "weak"}],
    )

    assert results[0].score_percent == 100
    assert results[0].assigned_level == "beginner"
    assert repo.saved_levels[1] == ("beginner", 100)


def test_submit_verifies_confident_self_assessment_against_quiz_score():
    # Student rates themself "confident" but actually scores poorly — the quiz
    # result should still be what determines the level, not the self-report.
    repo = _FakeDiagnosticRepository()
    service = DiagnosticService(repo)
    answers = [
        {"question_id": question.id, "subtopic_id": question.subtopic_id, "student_answer": "B"}
        for question in repo.questions
    ]

    results = service.submit(1, answers, self_assessments=[{"subtopic_id": 1, "rating": "confident"}])

    assert results[0].score_percent == 0
    assert results[0].assigned_level == "beginner"
