from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.models.dto import TeacherChatRequest

router = APIRouter()


@router.post("/{student_id}/chat")
def chat(student_id: int, body: TeacherChatRequest, container=Depends(get_container)):
    return container.teacher_controller.chat(student_id, body.message, body.history)


@router.get("/{student_id}/report")
def report(student_id: int, container=Depends(get_container)):
    return container.teacher_controller.report(student_id)
