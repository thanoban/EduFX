from app.core.errors import EduFXError
from app.core.store import DemoDataStore
from app.models.domain import Content, Subtopic


class ContentRepository:
    def __init__(self, store: DemoDataStore) -> None:
        self.store = store

    def list_subtopics(self) -> list[Subtopic]:
        return sorted(self.store.subtopics.values(), key=lambda item: item.order_index)

    def get_student_level(self, student_id: int, subtopic_id: int) -> str:
        self.store.ensure_progress_records(student_id)
        return self.store.student_progress[(student_id, subtopic_id)].current_level

    def get_content(self, subtopic_id: int, level: str) -> Content:
        for content in self.store.content_records.values():
            if content.subtopic_id == subtopic_id and content.level == level:
                return content
        raise EduFXError("Content not found", status_code=404)

    def get_subtopic(self, subtopic_id: int) -> Subtopic:
        if subtopic_id not in self.store.subtopics:
            raise EduFXError("Subtopic not found", status_code=404)
        return self.store.subtopics[subtopic_id]

