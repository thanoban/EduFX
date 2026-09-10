from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.core.request_auth import require_authenticated_request, require_student_access

router = APIRouter()


@router.get("/subtopics")
def subtopics(_current=Depends(require_authenticated_request), container=Depends(get_container)):
    return container.content_controller.subtopics()


@router.get("/{subtopic_id}/{student_id}")
def content(subtopic_id: int, student_id: int, _current=Depends(require_student_access), container=Depends(get_container)):
    return container.content_controller.content(subtopic_id, student_id)
