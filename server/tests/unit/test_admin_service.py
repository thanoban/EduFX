from datetime import UTC, date, datetime

from app.core.store import DemoDataStore
from app.models.domain import SessionSummary
from app.repositories.admin_repository import AdminRepository
from app.services.admin_service import AdminService


def _make_service():
    store = DemoDataStore()
    return store, AdminService(AdminRepository(store))


def test_list_students_summary_covers_every_student_with_zero_activity():
    store, service = _make_service()
    store.create_student("Alice", "alice@example.com")
    store.create_student("Bob", "bob@example.com")

    summaries = service.list_students_summary()

    assert len(summaries) == 2
    names = {s.name for s in summaries}
    assert names == {"Alice", "Bob"}
    for summary in summaries:
        assert summary.subtopics_mastered == 0
        assert summary.total_sessions == 0
        assert summary.avg_focus_score is None
        assert summary.last_active_date is None


def test_list_students_summary_aggregates_sessions_and_mastery():
    store, service = _make_service()
    student = store.create_student("Casey", "casey@example.com")
    store.ensure_progress_records(student.id)

    # Mark two subtopics as "advanced" (mastered) directly on the store.
    for key, progress in store.student_progress.items():
        if key[0] == student.id and key[1] in (1, 2):
            progress.current_level = "advanced"

    session_id = next(store.counters["session"])
    store.session_summaries[session_id] = SessionSummary(
        id=session_id,
        student_id=student.id,
        subtopic_id=1,
        session_date=date(2026, 1, 5),
        quiz_score=80,
        focus_score=90,
        phone_percent=0,
        drowsy_percent=0,
        away_percent=0,
        talking_percent=0,
        absent_percent=0,
        webcam_enabled=True,
        total_questions=15,
        correct_answers=12,
        created_at=datetime(2026, 1, 5, tzinfo=UTC),
    )

    summaries = service.list_students_summary()
    casey = next(s for s in summaries if s.student_id == student.id)

    assert casey.subtopics_mastered == 2
    assert casey.total_sessions == 1
    assert casey.avg_focus_score == 90
    assert casey.last_active_date == date(2026, 1, 5)


def test_get_student_detail_returns_progress_and_sessions():
    store, service = _make_service()
    student = store.create_student("Dana", "dana@example.com")

    detail = service.get_student_detail(student.id)

    assert detail.student_id == student.id
    assert detail.name == "Dana"
    assert len(detail.progress) == 10  # one row per seeded subtopic
    assert detail.session_history == []
    assert detail.weak_concepts == []


def test_get_student_detail_raises_for_missing_student():
    _, service = _make_service()

    try:
        service.get_student_detail(999999)
        assert False, "expected EduFXError"
    except Exception as error:
        assert "not found" in str(error).lower()


def test_set_student_role_promotes_and_demotes():
    store, service = _make_service()
    # The first student created in a fresh store is auto-admin (dev bootstrap
    # convenience), so Alice starts as "admin" and Bob starts as "student".
    store.create_student("Alice", "alice@example.com")
    bob = store.create_student("Bob", "bob@example.com")

    promoted = service.set_student_role(bob.id, "admin")
    assert promoted.role == "admin"

    demoted = service.set_student_role(bob.id, "student")
    assert demoted.role == "student"


def test_set_student_role_raises_for_missing_student():
    _, service = _make_service()

    try:
        service.set_student_role(999999, "admin")
        assert False, "expected EduFXError"
    except Exception as error:
        assert "not found" in str(error).lower()


def test_get_student_detail_surfaces_weak_concepts_from_quiz_history():
    store, service = _make_service()
    student = store.create_student("Evan", "evan@example.com")

    # Two wrong attempts on the same concept, never corrected -> should surface as weak.
    from app.models.domain import Question, QuizAttempt

    question_id = next(store.counters["question"])
    store.questions[question_id] = Question(
        id=question_id,
        subtopic_id=1,
        question_text="Sample?",
        option_a="A",
        option_b="B",
        option_c="C",
        option_d="D",
        correct_answer="A",
        difficulty="easy",
        source="manual",
        stage="first",
        student_id=None,
        is_diagnostic=False,
        concept="test-weak-concept",
    )
    session_id = next(store.counters["session"])
    for i in range(2):
        attempt_id = next(store.counters["attempt"])
        attempt = QuizAttempt(
            id=attempt_id,
            student_id=student.id,
            session_id=session_id,
            question_id=question_id,
            subtopic_id=1,
            student_answer="B",
            correct_answer="A",
            is_correct=False,
            explanation=None,
            created_at=datetime(2026, 1, i + 1, tzinfo=UTC),
        )
        store.quiz_attempts.setdefault(session_id, []).append(attempt)

    detail = service.get_student_detail(student.id)

    assert len(detail.weak_concepts) == 1
    assert detail.weak_concepts[0].concept == "test-weak-concept"
    assert detail.weak_concepts[0].accuracy == 0.0
