from app.presenters.response_presenter import success_response
from app.services.behaviour_service import BehaviourService


class BehaviourController:
    def __init__(self, service: BehaviourService) -> None:
        self.service = service

    def save_snapshot(self, payload: dict):
        return success_response(self.service.save_snapshot(payload), "Snapshot saved")

    def save_summary(self, payload: dict):
        return success_response(self.service.save_summary(payload), "Session summary saved")

    def session(self, session_id: int):
        return success_response(self.service.get_session(session_id), "Behaviour session fetched")

    def history(self, student_id: int):
        return success_response({"student_id": student_id, "sessions": self.service.get_student_history(student_id)}, "Behaviour history fetched")

