from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.core.request_auth import assert_student_access, require_student_access, require_authenticated_request
from app.models.dto import GenerateQuizRequest

router = APIRouter()


@router.get("/{subtopic_id}/{student_id}")
def quiz(subtopic_id: int, student_id: int, _current=Depends(require_student_access), container=Depends(get_container)):
    return container.quiz_controller.get_quiz(student_id, subtopic_id)


@router.post("/generate")
def generate(payload: GenerateQuizRequest, current=Depends(require_authenticated_request), container=Depends(get_container)):
    assert_student_access(current, payload.student_id)
    return container.quiz_controller.generate_quiz(payload.student_id, payload.subtopic_id)
