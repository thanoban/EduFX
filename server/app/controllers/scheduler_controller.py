from app.presenters.response_presenter import success_response
from app.services.scheduling_agent import SchedulingAgent


class SchedulerController:
    def __init__(self, service: SchedulingAgent) -> None:
        self.service = service

    def todays_plan(self, student_id: int):
        return success_response({"plan": self.service.get_todays_plan(student_id)}, "Study plan ready")

