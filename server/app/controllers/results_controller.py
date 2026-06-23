from app.presenters.response_presenter import success_response
from app.services.results_service import ResultsService


class ResultsController:
    def __init__(self, service: ResultsService) -> None:
        self.service = service

    def submit(self, student_id: int, session_id: int, subtopic_id: int, webcam_enabled: bool, answers: list[dict]):
        result = self.service.submit_quiz(student_id, session_id, subtopic_id, webcam_enabled, answers)
        return success_response(result, "Quiz submitted")

    def session(self, session_id: int, student_id: int):
        return success_response(self.service.get_session_results(session_id, student_id), "Session results fetched")

