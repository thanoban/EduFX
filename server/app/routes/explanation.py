from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.core.request_auth import require_student_access

router = APIRouter()


@router.get("/{session_id}/{student_id}")
def explanations(session_id: int, student_id: int, _current=Depends(require_student_access), container=Depends(get_container)):
    return container.explanation_controller.session_explanations(session_id, student_id)
