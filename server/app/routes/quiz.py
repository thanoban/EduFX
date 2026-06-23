from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.models.dto import GenerateQuizRequest

router = APIRouter()


@router.get("/{subtopic_id}/{student_id}")
def quiz(subtopic_id: int, student_id: int, container=Depends(get_container)):
    return container.quiz_controller.get_quiz(student_id, subtopic_id)


@router.post("/generate")
def generate(payload: GenerateQuizRequest, container=Depends(get_container)):
    return container.quiz_controller.generate_quiz(payload.student_id, payload.subtopic_id)

