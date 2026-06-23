from app.models.dto import ContentDTO, SubtopicLiteDTO
from app.repositories.contracts import ContentRepositoryContract
from app.repositories.content_repository import ContentRepository


class ContentService:
    def __init__(self, repository: ContentRepositoryContract | ContentRepository) -> None:
        self.repository = repository

    def list_subtopics(self) -> list[SubtopicLiteDTO]:
        return [
            SubtopicLiteDTO(id=item.id, title=item.title, group_name=item.group_name)
            for item in self.repository.list_subtopics()
        ]

    def get_content(self, subtopic_id: int, student_id: int) -> ContentDTO:
        subtopic = self.repository.get_subtopic(subtopic_id)
        level = self.repository.get_student_level(student_id, subtopic_id)
        content = self.repository.get_content(subtopic_id, level)
        return ContentDTO(
            id=content.id,
            subtopic_id=content.subtopic_id,
            body=content.body,
            level=level,  # type: ignore[arg-type]
            subtopic_title=subtopic.title,
            group_name=subtopic.group_name,
        )
