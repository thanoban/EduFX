import pytest

from app.core.errors import EduFXError
from app.core.store import DemoDataStore
from app.repositories.content_repository import ContentRepository
from app.services.content_service import ContentService


class StubSchedulingAgent:
    def __init__(self, active_subtopic_id: int | None = 1) -> None:
        self.active_subtopic_id = active_subtopic_id

    def get_active_subtopic_id(self, student_id: int) -> int | None:
        return self.active_subtopic_id

    def get_todays_plan(self, student_id: int):
        return []

    def register_study_session(self, student_id: int) -> None:
        return None


def test_content_service_allows_active_recommendation():
    store = DemoDataStore()
    student = store.create_student("Test", "content-service@edufx.local")
    store.ensure_progress_records(student.id)
    service = ContentService(ContentRepository(store), StubSchedulingAgent(active_subtopic_id=1))

    content = service.get_content(1, student.id)

    assert content.subtopic_id == 1


def test_content_service_blocks_non_recommended_topic():
    store = DemoDataStore()
    student = store.create_student("Test", "content-service@edufx.local")
    store.ensure_progress_records(student.id)
    service = ContentService(ContentRepository(store), StubSchedulingAgent(active_subtopic_id=1))

    with pytest.raises(EduFXError, match="not your active EduFX recommendation"):
        service.get_content(2, student.id)
