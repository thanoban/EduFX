from app.core.errors import EduFXError
from app.core.auth import verify_google_token
from app.models.dto import StudentProfileDTO
from app.repositories.contracts import AuthRepositoryContract
from app.repositories.auth_repository import AuthRepository


class AuthService:
    def __init__(self, repository: AuthRepositoryContract | AuthRepository) -> None:
        self.repository = repository

    def login_with_google(self, token: str) -> StudentProfileDTO:
        identity = verify_google_token(token)
        student = self.repository.find_student_by_email(identity.email)
        if student is None:
            student = self.repository.create_student(identity.name, identity.email)
        return StudentProfileDTO.from_student(student)

    def is_admin(self, email: str) -> bool:
        student = self.repository.find_student_by_email(email)
        return bool(student and student.role == "admin")

    def check_diagnostic(self, student_id: int) -> StudentProfileDTO:
        student = self.repository.get_student(student_id)
        if student is None:
            raise EduFXError("Student not found", status_code=404)
        return StudentProfileDTO.from_student(student)
