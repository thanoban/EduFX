from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.core.request_auth import require_student_access
from app.models.dto import NextFreeCheckInRequest, UpdateAvailabilityRequest

router = APIRouter()


@router.put("/{student_id}/availability")
def update_availability(student_id: int, body: UpdateAvailabilityRequest, _current=Depends(require_student_access), container=Depends(get_container)):
    return container.settings_controller.update_availability(
        student_id, body.free_days, body.session_length, body.day_session_length
    )


@router.post("/{student_id}/next-free")
def check_in_next_free(student_id: int, body: NextFreeCheckInRequest, _current=Depends(require_student_access), container=Depends(get_container)):
    return container.settings_controller.check_in_next_free(student_id, body.choice)
