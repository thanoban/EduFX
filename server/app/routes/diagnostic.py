from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.core.request_auth import assert_student_access, require_authenticated_request
from app.models.dto import DiagnosticSubmitRequest

router = APIRouter()


@router.get("/questions")
def questions(_current=Depends(require_authenticated_request), container=Depends(get_container)):
    return container.diagnostic_controller.questions()


@router.post("/submit")
def submit(payload: DiagnosticSubmitRequest, current=Depends(require_authenticated_request), container=Depends(get_container)):
    assert_student_access(current, payload.student_id)
    return container.diagnostic_controller.submit(
        payload.student_id,
        [answer.model_dump() for answer in payload.answers],
        [item.model_dump() for item in payload.self_assessments],
    )
