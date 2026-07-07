from app.core.errors import EduFXError
from app.models.dto import ContentDTO, SubtopicLiteDTO
from app.repositories.contracts import ContentRepositoryContract
from app.repositories.content_repository import ContentRepository
from app.services.contracts import SchedulingAgentContract
from app.services.scheduling_agent import SchedulingAgent


class ContentService:
    def __init__(
        self,
        repository: ContentRepositoryContract | ContentRepository,
        scheduling_agent: SchedulingAgentContract | SchedulingAgent,
    ) -> None:
        self.repository = repository
        self.scheduling_agent = scheduling_agent

    def list_subtopics(self) -> list[SubtopicLiteDTO]:
        return [
            SubtopicLiteDTO(id=item.id, title=item.title, group_name=item.group_name)
            for item in self.repository.list_subtopics()
        ]

    def get_content(self, subtopic_id: int, student_id: int) -> ContentDTO:
        self._assert_active_recommendation(student_id, subtopic_id)
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

    def _assert_active_recommendation(self, student_id: int, subtopic_id: int) -> None:
        active_subtopic_id = self.scheduling_agent.get_active_subtopic_id(student_id)
        if active_subtopic_id is None:
            raise EduFXError(
                "No study topic is unlocked right now. Return to the dashboard to view your current recommendation.",
                status_code=403,
            )
        if active_subtopic_id != subtopic_id:
            raise EduFXError(
                "This topic is not your active EduFX recommendation right now. Follow the dashboard suggestion so the study route stays performance-based.",
                status_code=403,
            )
