from fastapi import APIRouter, Depends

from app.core.container import get_container

router = APIRouter()


@router.get("/todays-plan/{student_id}")
def todays_plan(student_id: int, container=Depends(get_container)):
    return container.scheduler_controller.todays_plan(student_id)

