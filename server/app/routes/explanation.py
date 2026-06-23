from fastapi import APIRouter, Depends

from app.core.container import get_container

router = APIRouter()


@router.get("/{session_id}/{student_id}")
def explanations(session_id: int, student_id: int, container=Depends(get_container)):
    return container.explanation_controller.session_explanations(session_id, student_id)

