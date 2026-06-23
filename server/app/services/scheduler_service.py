from datetime import date

from app.core.rules import compute_priority, is_on_cooldown
from app.models.dto import StudyPlanItemDTO
from app.repositories.contracts import SchedulerRepositoryContract
from app.repositories.scheduler_repository import SchedulerRepository


class SchedulerService:
    def __init__(self, repository: SchedulerRepositoryContract | SchedulerRepository) -> None:
        self.repository = repository

    def get_todays_plan(self, student_id: int) -> list[StudyPlanItemDTO]:
        today = date.today()
        progress_records = self.repository.get_student_progress(student_id)
        candidates = []
        for progress in progress_records:
            if is_on_cooldown(progress, today):
                continue
            priority, overdue = compute_priority(progress, today)
            subtopic = self.repository.get_subtopic(progress.subtopic_id)
            bucket = "strong" if progress.current_level == "advanced" else "weak"
            candidates.append((bucket, priority, overdue, progress, subtopic))

        weak = sorted([item for item in candidates if item[0] == "weak"], key=lambda value: value[1], reverse=True)[:2]
        strong = sorted([item for item in candidates if item[0] == "strong"], key=lambda value: value[1], reverse=True)[:1]
        chosen = weak + strong

        if len(chosen) < 3:
            filler = sorted(candidates, key=lambda value: value[1], reverse=True)
            for item in filler:
                if item not in chosen:
                    chosen.append(item)
                if len(chosen) == 3:
                    break

        return [
            StudyPlanItemDTO(
                subtopic_id=subtopic.id,
                subtopic_title=subtopic.title,
                group_name=subtopic.group_name,
                current_level=progress.current_level,  # type: ignore[arg-type]
                is_overdue=overdue,
                last_quiz_score=progress.last_quiz_score,
                last_studied_date=progress.last_studied_date,
                type=bucket,  # type: ignore[arg-type]
            )
            for bucket, _, overdue, progress, subtopic in chosen[:3]
        ]
