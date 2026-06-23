from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.models.dto import DiagnosticSubmitRequest

router = APIRouter()


@router.get("/questions")
def questions(container=Depends(get_container)):
    return container.diagnostic_controller.questions()


@router.post("/submit")
def submit(payload: DiagnosticSubmitRequest, container=Depends(get_container)):
    return container.diagnostic_controller.submit(
        payload.student_id,
        [answer.model_dump() for answer in payload.answers],
    )

