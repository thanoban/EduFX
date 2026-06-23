from app.core.store import DemoDataStore
from app.models.domain import StudentProgress, Subtopic


class SchedulerRepository:
    def __init__(self, store: DemoDataStore) -> None:
        self.store = store

    def get_student_progress(self, student_id: int) -> list[StudentProgress]:
        self.store.ensure_progress_records(student_id)
        return [record for record in self.store.student_progress.values() if record.student_id == student_id]

    def get_subtopic(self, subtopic_id: int) -> Subtopic:
        return self.store.subtopics[subtopic_id]

