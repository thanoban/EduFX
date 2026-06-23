from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.models.dto import BehaviourSnapshotRequest, BehaviourSummaryRequest

router = APIRouter()


@router.post("/save-snapshot")
def save_snapshot(payload: BehaviourSnapshotRequest, container=Depends(get_container)):
    return container.behaviour_controller.save_snapshot(payload.model_dump())


@router.post("/save-summary")
def save_summary(payload: BehaviourSummaryRequest, container=Depends(get_container)):
    return container.behaviour_controller.save_summary(payload.model_dump())


@router.get("/session/{session_id}")
def session(session_id: int, container=Depends(get_container)):
    return container.behaviour_controller.session(session_id)


@router.get("/student/{student_id}")
def history(student_id: int, container=Depends(get_container)):
    return container.behaviour_controller.history(student_id)
