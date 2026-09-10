from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.core.request_auth import require_student_access

router = APIRouter()


@router.get("/{student_id}")
def progress(student_id: int, _current=Depends(require_student_access), container=Depends(get_container)):
    return container.progress_controller.all_progress(student_id)


@router.get("/{student_id}/{subtopic_id}")
def subtopic_progress(student_id: int, subtopic_id: int, _current=Depends(require_student_access), container=Depends(get_container)):
    return container.progress_controller.subtopic_progress(student_id, subtopic_id)
