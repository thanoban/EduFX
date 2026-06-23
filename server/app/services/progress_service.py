from app.core.errors import EduFXError
from app.models.dto import ProgressHistoryItemDTO, ProgressRecordDTO, SubtopicLiteDTO
from app.repositories.contracts import ProgressRepositoryContract
from app.repositories.progress_repository import ProgressRepository


class ProgressService:
    def __init__(self, repository: ProgressRepositoryContract | ProgressRepository) -> None:
        self.repository = repository

    def get_progress(self, student_id: int) -> list[ProgressRecordDTO]:
        records = self.repository.get_progress_records(student_id)
        payload: list[ProgressRecordDTO] = []
        for record in records:
            subtopic = self.repository.get_subtopic(record.subtopic_id)
            history = self.repository.get_session_history(student_id, record.subtopic_id)
            payload.append(
                ProgressRecordDTO(
                    id=record.id,
                    subtopic_id=record.subtopic_id,
                    current_level=record.current_level,  # type: ignore[arg-type]
                    last_studied_date=record.last_studied_date,
                    last_quiz_score=record.last_quiz_score,
                    total_sessions=record.total_sessions,
                    subtopics=SubtopicLiteDTO(id=subtopic.id, title=subtopic.title, group_name=subtopic.group_name),
                    session_history=[
                        ProgressHistoryItemDTO(
                            id=item.id,
                            session_date=item.session_date,
                            quiz_score=item.quiz_score,
                            focus_score=item.focus_score,
                            created_at=item.created_at,
                        )
                        for item in history
                    ],
                )
            )
        return payload

    def get_subtopic_progress(self, student_id: int, subtopic_id: int) -> ProgressRecordDTO:
        records = self.get_progress(student_id)
        for item in records:
            if item.subtopic_id == subtopic_id:
                return item
        raise EduFXError("Subtopic progress not found", status_code=404)
