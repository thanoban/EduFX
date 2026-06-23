from app.presenters.response_presenter import success_response
from app.services.quiz_service import QuizService


class QuizController:
    def __init__(self, service: QuizService) -> None:
        self.service = service

    def get_quiz(self, student_id: int, subtopic_id: int):
        return success_response(self.service.get_quiz(student_id, subtopic_id), "Quiz ready")

    def generate_quiz(self, student_id: int, subtopic_id: int):
        return success_response(self.service.generate_quiz(student_id, subtopic_id), "Personalized quiz generated")

