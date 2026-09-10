from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.core.request_auth import assert_student_access, require_student_access, require_authenticated_request
from app.models.dto import BehaviourSnapshotRequest, BehaviourSummaryRequest

router = APIRouter()


@router.post("/save-snapshot")
def save_snapshot(payload: BehaviourSnapshotRequest, current=Depends(require_authenticated_request), container=Depends(get_container)):
    assert_student_access(current, payload.student_id)
    return container.behaviour_controller.save_snapshot(payload.model_dump())


@router.post("/save-summary")
def save_summary(payload: BehaviourSummaryRequest, current=Depends(require_authenticated_request), container=Depends(get_container)):
    assert_student_access(current, payload.student_id)
    return container.behaviour_controller.save_summary(payload.model_dump())


@router.get("/session/{session_id}")
def session(session_id: int, current=Depends(require_authenticated_request), container=Depends(get_container)):
    return container.behaviour_controller.session(session_id, current.student_id)


@router.get("/student/{student_id}")
def history(student_id: int, _current=Depends(require_student_access), container=Depends(get_container)):
    return container.behaviour_controller.history(student_id)
