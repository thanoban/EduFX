from app.presenters.response_presenter import success_response
from app.services.explanation_service import ExplanationService


class ExplanationController:
    def __init__(self, service: ExplanationService) -> None:
        self.service = service

    def session_explanations(self, session_id: int, student_id: int):
        return success_response(
            {"session_id": session_id, "explanations": self.service.get_explanations(session_id, student_id)},
            "Explanations generated",
        )

