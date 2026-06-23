from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.models.dto import QuizSubmitRequest

router = APIRouter()


@router.post("/submit-quiz")
def submit(payload: QuizSubmitRequest, container=Depends(get_container)):
    return container.results_controller.submit(
        payload.student_id,
        payload.session_id,
        payload.subtopic_id,
        payload.webcam_enabled,
        [answer.model_dump() for answer in payload.answers],
    )


@router.get("/session/{session_id}/{student_id}")
def session(session_id: int, student_id: int, container=Depends(get_container)):
    return container.results_controller.session(session_id, student_id)

