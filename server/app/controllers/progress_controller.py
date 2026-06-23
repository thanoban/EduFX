from app.presenters.response_presenter import success_response
from app.services.progress_service import ProgressService


class ProgressController:
    def __init__(self, service: ProgressService) -> None:
        self.service = service

    def all_progress(self, student_id: int):
        return success_response({"student_id": student_id, "progress": self.service.get_progress(student_id)}, "Progress fetched")

    def subtopic_progress(self, student_id: int, subtopic_id: int):
        return success_response(self.service.get_subtopic_progress(student_id, subtopic_id), "Subtopic progress fetched")

