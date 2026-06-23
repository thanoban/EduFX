from app.presenters.response_presenter import success_response
from app.services.diagnostic_service import DiagnosticService


class DiagnosticController:
    def __init__(self, service: DiagnosticService) -> None:
        self.service = service

    def questions(self):
        questions = self.service.get_questions()
        return success_response(
            {"total_questions": len(questions), "questions": questions},
            "Diagnostic questions fetched",
        )

    def submit(self, student_id: int, answers: list[dict]):
        results = self.service.submit(student_id, answers)
        return success_response({"results": results}, "Diagnostic submitted")

