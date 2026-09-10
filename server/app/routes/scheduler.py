from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.core.request_auth import require_student_access

router = APIRouter()


@router.get("/todays-plan/{student_id}")
def todays_plan(student_id: int, _current=Depends(require_student_access), container=Depends(get_container)):
    return container.scheduler_controller.todays_plan(student_id)
