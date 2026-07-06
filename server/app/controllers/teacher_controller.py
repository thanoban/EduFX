from app.models.dto import TeacherChatMessageDTO
from app.presenters.response_presenter import success_response
from app.services.teacher_service import TeacherService


class TeacherController:
    def __init__(self, service: TeacherService) -> None:
        self.service = service

    def chat(self, student_id: int, message: str, history: list[TeacherChatMessageDTO]):
        reply = self.service.chat(
            student_id,
            message,
            [{"role": turn.role, "content": turn.content} for turn in history],
        )
        return success_response(reply, "Teacher reply")

    def report(self, student_id: int):
        report = self.service.generate_report(student_id)
        return success_response(report, "Teacher report")
