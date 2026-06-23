from app.presenters.response_presenter import success_response
from app.services.content_service import ContentService


class ContentController:
    def __init__(self, service: ContentService) -> None:
        self.service = service

    def subtopics(self):
        return success_response(self.service.list_subtopics(), "Subtopics fetched")

    def content(self, subtopic_id: int, student_id: int):
        return success_response(self.service.get_content(subtopic_id, student_id), "Content fetched")

