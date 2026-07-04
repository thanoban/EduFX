from app.presenters.response_presenter import success_response
from app.services.settings_service import SettingsService


class SettingsController:
    def __init__(self, service: SettingsService) -> None:
        self.service = service

    def update_availability(
        self,
        student_id: int,
        free_days: list[int],
        session_length: str,
        email_reminders_enabled: bool,
    ):
        profile = self.service.update_availability(student_id, free_days, session_length, email_reminders_enabled)
        return success_response(profile, "Availability updated")

    def check_in_next_free(self, student_id: int, choice: str):
        profile = self.service.check_in_next_free(student_id, choice)
        return success_response(profile, "Next-free check-in saved")
