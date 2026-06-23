from app.presenters.response_presenter import success_response
from app.services.scheduler_service import SchedulerService


class SchedulerController:
    def __init__(self, service: SchedulerService) -> None:
        self.service = service

    def todays_plan(self, student_id: int):
        return success_response({"plan": self.service.get_todays_plan(student_id)}, "Study plan ready")

