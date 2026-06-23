from fastapi import APIRouter, Depends

from app.core.container import get_container

router = APIRouter()


@router.get("/subtopics")
def subtopics(container=Depends(get_container)):
    return container.content_controller.subtopics()


@router.get("/{subtopic_id}/{student_id}")
def content(subtopic_id: int, student_id: int, container=Depends(get_container)):
    return container.content_controller.content(subtopic_id, student_id)

