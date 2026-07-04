from app.presenters.response_presenter import success_response
from app.services.admin_service import AdminService


class AdminController:
    def __init__(self, service: AdminService) -> None:
        self.service = service

    def all_students(self):
        return success_response(self.service.list_students_summary(), "Students fetched")

    def student_detail(self, student_id: int):
        return success_response(self.service.get_student_detail(student_id), "Student detail fetched")

    def set_student_role(self, student_id: int, role: str):
        return success_response(self.service.set_student_role(student_id, role), "Student role updated")
