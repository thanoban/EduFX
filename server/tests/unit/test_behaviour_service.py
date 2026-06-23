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


def test_save_summary_stores_percentages():
    service, store, session = _make_service()
    result = service.save_summary(
        {
            "student_id": 1,
            "session_id": session.id,
            "webcam_enabled": True,
            "phone_percent": 10,
            "drowsy_percent": 20,
            "away_percent": 5,
            "talking_percent": 0,
            "absent_percent": 0,
            "focus_score": 75,
        }
    )
    assert result["session_id"] == session.id
    assert result["focus_score"] == 75


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
