from app.models.dto import StudentProfileDTO
from app.presenters.response_presenter import success_response
from app.services.auth_service import AuthService


class AuthController:
    def __init__(self, service: AuthService) -> None:
        self.service = service

    def login(self, token: str):
        profile = self.service.login_with_google(token)
        return success_response(profile, "Student authenticated")

    def check(self, student_id: int):
        profile: StudentProfileDTO = self.service.check_diagnostic(student_id)
        return success_response(
            {"student_id": profile.student_id, "diagnostic_completed": profile.diagnostic_completed},
            "Diagnostic status fetched",
        )

