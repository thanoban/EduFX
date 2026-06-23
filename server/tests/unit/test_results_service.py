from app.core.store import DemoDataStore
from app.repositories.behaviour_repository import BehaviourRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.results_repository import ResultsRepository
from app.services.results_service import ResultsService


def _make_service():
    store = DemoDataStore()
    results_repo = ResultsRepository(store)
    quiz_repo = QuizRepository(store)
    behaviour_repo = BehaviourRepository(store)
    service = ResultsService(results_repo, quiz_repo, behaviour_repo)
    student = store.create_student("Test", "test@edufx.local")
    store.ensure_progress_records(student.id)
    session = store.create_session(student.id, subtopic_id=1)
    return service, store, student, session


def _first_question_for_subtopic(store: DemoDataStore, subtopic_id: int) -> int:
    for q in store.questions.values():
        if q.subtopic_id == subtopic_id and q.stage == "first":
            return q.id
    raise AssertionError("no first-stage question found for subtopic 1")


def test_submit_quiz_correct_score():
    service, store, student, session = _make_service()
    q_id = _first_question_for_subtopic(store, 1)
    question = store.questions[q_id]
    result = service.submit_quiz(
        student_id=student.id,
        session_id=session.id,
        subtopic_id=1,
        webcam_enabled=False,
        answers=[{"question_id": q_id, "student_answer": question.correct_answer}],
    )
    assert result.quiz_score == 100
    assert result.correct_answers == 1
    assert result.total_questions == 1


def test_submit_quiz_wrong_answer_scores_zero():
    service, store, student, session = _make_service()
    q_id = _first_question_for_subtopic(store, 1)
    question = store.questions[q_id]
    wrong = next(x for x in ("A", "B", "C", "D") if x != question.correct_answer)
    result = service.submit_quiz(
        student_id=student.id,
        session_id=session.id,
        subtopic_id=1,
        webcam_enabled=False,
        answers=[{"question_id": q_id, "student_answer": wrong}],
    )
    assert result.quiz_score == 0
    assert result.wrong_count == 1


def test_submit_quiz_promotes_level_on_high_score():
    service, store, student, session = _make_service()
    questions = [q for q in store.questions.values() if q.subtopic_id == 1 and q.stage == "first"][:5]
    answers = [{"question_id": q.id, "student_answer": q.correct_answer} for q in questions]
    result = service.submit_quiz(
        student_id=student.id,
        session_id=session.id,
        subtopic_id=1,
        webcam_enabled=False,
        answers=answers,
    )
    assert result.quiz_score == 100
    assert result.new_level == "intermediate"
    assert result.level_changed is True


def test_get_session_results_after_submit():
    service, store, student, session = _make_service()
    q_id = _first_question_for_subtopic(store, 1)
    question = store.questions[q_id]
    service.submit_quiz(
        student_id=student.id,
        session_id=session.id,
        subtopic_id=1,
        webcam_enabled=True,
        answers=[{"question_id": q_id, "student_answer": question.correct_answer}],
    )
    dto = service.get_session_results(session.id, student.id)
    assert dto.total_questions == 1
    assert dto.correct_answers == 1
    assert len(dto.attempts) == 1
    assert dto.attempts[0].is_correct is True
