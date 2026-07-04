from fastapi import APIRouter, Depends

from app.core.container import get_container
from app.models.dto import NextFreeCheckInRequest, UpdateAvailabilityRequest

router = APIRouter()


@router.put("/{student_id}/availability")
def update_availability(student_id: int, body: UpdateAvailabilityRequest, container=Depends(get_container)):
    return container.settings_controller.update_availability(
        student_id, body.free_days, body.session_length, body.email_reminders_enabled
    )


@router.post("/{student_id}/next-free")
def check_in_next_free(student_id: int, body: NextFreeCheckInRequest, container=Depends(get_container)):
    return container.settings_controller.check_in_next_free(student_id, body.choice)
