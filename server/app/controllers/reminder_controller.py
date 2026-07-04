from app.presenters.response_presenter import success_response
from app.services.reminder_service import ReminderService


class ReminderController:
    def __init__(self, service: ReminderService) -> None:
        self.service = service

    def run_daily_scan(self):
        counts = self.service.run_daily_scan()
        return success_response(counts, "Reminder scan complete")
