from app.core.store import DemoDataStore
from app.repositories.behaviour_repository import BehaviourRepository
from app.services.behaviour_service import BehaviourService


def _make_service():
    store = DemoDataStore()
    repo = BehaviourRepository(store)
    service = BehaviourService(repo)
    session = store.create_session(student_id=1, subtopic_id=1)
    return service, store, session


def test_save_snapshot_returns_snapshot_id_and_focus_score():
    service, store, session = _make_service()
    result = service.save_snapshot(
        {
            "student_id": 1,
            "session_id": session.id,
            "face_detected": True,
            "looking_away": False,
            "phone_detected": False,
            "drowsy": False,
            "multiple_persons": False,
            "talking": False,
            "absent": False,
            "focus_score": 0,
        }
    )
    assert result["snapshot_id"] >= 1
    assert result["focus_score"] == 100


def test_save_snapshot_deducts_for_phone_and_drowsy():
    service, store, session = _make_service()
    result = service.save_snapshot(
        {
            "student_id": 1,
            "session_id": session.id,
            "face_detected": True,
            "looking_away": False,
            "phone_detected": True,
            "drowsy": True,
            "multiple_persons": False,
            "talking": False,
            "absent": False,
            "focus_score": 0,
        }
    )
    assert result["focus_score"] == 30


def _snapshot(session_id: int, **flags) -> dict:
    base = {
        "student_id": 1,
        "session_id": session_id,
        "face_detected": True,
        "looking_away": False,
        "phone_detected": False,
        "drowsy": False,
        "multiple_persons": False,
        "talking": False,
        "absent": False,
        "focus_score": 0,
    }
    base.update(flags)
    return base


def test_save_summary_aggregates_from_stored_snapshots():
    # Server is the source of truth: it ignores client-sent percentages and
    # recomputes everything from the snapshots saved during the session.
    service, store, session = _make_service()
    service.save_snapshot(_snapshot(session.id))  # clean frame, focus 100
    service.save_snapshot(_snapshot(session.id, phone_detected=True))  # focus 60

    result = service.save_summary(
        {
            "student_id": 1,
            "session_id": session.id,
            "webcam_enabled": True,
            "phone_percent": 99,  # client value must be ignored
            "focus_score": 99,
        }
    )
    assert result["session_id"] == session.id
    # One of two frames had a phone → 50%; one of two frames was focused (>=80) → 50%.
    assert store.session_summaries[session.id].phone_percent == 50
    assert result["focus_score"] == 50


def test_save_summary_untracked_when_webcam_off():
    service, store, session = _make_service()
    result = service.save_summary(
        {
            "student_id": 1,
            "session_id": session.id,
            "webcam_enabled": False,
        }
    )
    assert result["focus_score"] is None
    assert store.session_summaries[session.id].focus_score is None


def test_save_summary_untracked_when_enabled_but_no_snapshots():
    service, store, session = _make_service()
    result = service.save_summary(
        {
            "student_id": 1,
            "session_id": session.id,
            "webcam_enabled": True,
        }
    )
    assert result["focus_score"] is None


def test_save_summary_recomputes_focus_if_zero():
    service, store, session = _make_service()
    service.save_snapshot(
        {
            "student_id": 1,
            "session_id": session.id,
            "face_detected": True,
            "looking_away": False,
            "phone_detected": False,
            "drowsy": False,
            "multiple_persons": False,
            "talking": False,
            "absent": False,
            "focus_score": 0,
        }
    )
    result = service.save_summary(
        {
            "student_id": 1,
            "session_id": session.id,
            "webcam_enabled": True,
            "phone_percent": 0,
            "drowsy_percent": 0,
            "away_percent": 0,
            "talking_percent": 0,
            "absent_percent": 0,
            "focus_score": 0,
        }
    )
    assert result["focus_score"] == 100


def test_get_session_returns_dto_with_snapshots():
    service, store, session = _make_service()
    service.save_snapshot(
        {
            "student_id": 1,
            "session_id": session.id,
            "face_detected": True,
            "looking_away": False,
            "phone_detected": False,
            "drowsy": False,
            "multiple_persons": False,
            "talking": False,
            "absent": False,
            "focus_score": 0,
        }
    )
    dto = service.get_session(session.id)
    assert dto.session_id == session.id
    assert len(dto.snapshots) == 1


def test_get_student_history_empty_initially():
    service, _, _ = _make_service()
    history = service.get_student_history(999)
    assert history == []
