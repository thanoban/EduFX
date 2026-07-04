from datetime import date

from app.core.rules import CAP_TO_WEAK_STRONG_SPLIT, DURATION_TO_CAP, compute_priority, is_on_cooldown
from app.ml.bkt import BKTModel
from app.ml.dkt import DKTInference
from app.ml.recommender import (
    blended_mastery,
    build_interaction_history,
    classify_bucket,
    score_candidate,
)
from app.models.domain import Student
from app.models.dto import StudyPlanItemDTO
from app.repositories.contracts import ProgressRepositoryContract, ResultsRepositoryContract, SchedulerRepositoryContract
from app.repositories.progress_repository import ProgressRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository

# Fallback plan size for a student who hasn't set availability in Settings yet
# — unchanged historical behaviour (2 weak + 1 strong) so nothing breaks for
# existing/unconfigured students. The dashboard nudges them to set it once.
_UNCONFIGURED_DEFAULT_CAP = 3


class SchedulerService:
    def __init__(
        self,
        repository: SchedulerRepositoryContract | SchedulerRepository,
        progress_repository: ProgressRepositoryContract | ProgressRepository,
        results_repository: ResultsRepositoryContract | ResultsRepository,
    ) -> None:
        self.repository = repository
        self.progress_repository = progress_repository
        self.results_repository = results_repository
        self.predictor = self._load_predictor()

    def get_todays_plan(self, student_id: int) -> list[StudyPlanItemDTO]:
        today = date.today()
        student = self.results_repository.get_student(student_id)
        cap = self._resolve_cap(student, today)
        if cap == 0:
            return []

        progress_records = self.repository.get_student_progress(student_id)
        subtopics_by_id = {item.id: item for item in self.repository.list_subtopics()}
        model_plan = self._get_model_plan(student_id, progress_records, subtopics_by_id, today, cap)
        if model_plan is not None:
            return model_plan
        candidates = []
        for progress in progress_records:
            if is_on_cooldown(progress, today):
                continue
            priority, overdue = compute_priority(progress, today)
            subtopic = subtopics_by_id.get(progress.subtopic_id)
            if subtopic is None:
                subtopic = self.repository.get_subtopic(progress.subtopic_id)
            bucket = "strong" if progress.current_level == "advanced" else "weak"
            candidates.append((bucket, priority, overdue, progress, subtopic))

        return self._select_capped(candidates, cap)

    def _resolve_cap(self, student: Student | None, today: date) -> int:
        """How many subtopics today's plan should contain.

        - No availability configured yet -> unchanged historical fallback size,
          so existing/unconfigured students see no behaviour change.
        - Configured, but today isn't a free day and no post-session check-in
          promised today -> 0 (no plan; the dashboard explains why instead of
          showing a confusing empty list).
        - Otherwise -> the cap for their chosen session length. This is the
          ceiling that stops a fully-free day from dumping every subtopic in
          one sitting.
        """
        if student is None or not student.free_days:
            return _UNCONFIGURED_DEFAULT_CAP
        is_free_today = today.weekday() in student.free_days
        is_promised_today = student.next_expected_date == today
        if not is_free_today and not is_promised_today:
            return 0
        return DURATION_TO_CAP.get(student.session_length, _UNCONFIGURED_DEFAULT_CAP)

    def _select_capped(self, scored: list[tuple], cap: int) -> list[StudyPlanItemDTO]:
        """Pick `cap` items from scored (bucket, score, overdue, progress, subtopic)
        tuples, preferring the weak/strong mix for that cap size (see
        CAP_TO_WEAK_STRONG_SPLIT), falling back to top-score fill if either
        bucket is short.
        """
        weak_n, strong_n = CAP_TO_WEAK_STRONG_SPLIT.get(cap, (cap, 0))
        weak = sorted((item for item in scored if item[0] == "weak"), key=lambda value: value[1], reverse=True)[:weak_n]
        strong = sorted((item for item in scored if item[0] == "strong"), key=lambda value: value[1], reverse=True)[:strong_n]
        chosen = weak + strong

        if len(chosen) < cap:
            filler = sorted(scored, key=lambda value: value[1], reverse=True)
            for item in filler:
                if item not in chosen:
                    chosen.append(item)
                if len(chosen) == cap:
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
            for bucket, _, overdue, progress, subtopic in chosen[:cap]
        ]

    def _load_predictor(self):
        try:
            if DKTInference.is_available():
                return DKTInference.load()
        except Exception:
            pass
        try:
            if BKTModel.is_available():
                return BKTModel.load()
        except Exception:
            pass
        return None

    def _get_model_plan(self, student_id: int, progress_records, subtopics_by_id, today: date, cap: int):
        if self.predictor is None:
            return None

        sessions = self.progress_repository.get_student_session_history(student_id)
        if not sessions:
            return None

        attempts_by_session = {
            session.id: self.results_repository.get_attempts(session.id)
            for session in sessions
        }
        history = build_interaction_history(sessions, attempts_by_session)
        if len(history) < 3:
            return None

        try:
            model_mastery = self.predictor.predict_mastery(history)
            model_p_correct = self.predictor.predict_p_correct(history)
        except Exception:
            return None

        mastery_by_skill = blended_mastery(progress_records, model_mastery)
        scored = []
        for progress in progress_records:
            if is_on_cooldown(progress, today):
                continue
            skill = progress.subtopic_id - 1
            mastery = mastery_by_skill.get(skill, 0.25)
            p_correct = model_p_correct.get(skill, mastery)
            score, overdue = score_candidate(
                progress=progress,
                mastery=mastery,
                p_correct=p_correct,
                readiness=mastery_by_skill,
                today=today,
            )
            subtopic = subtopics_by_id.get(progress.subtopic_id)
            if subtopic is None:
                subtopic = self.repository.get_subtopic(progress.subtopic_id)
            bucket = classify_bucket(mastery)
            scored.append((bucket, score, overdue, progress, subtopic))

        if not scored:
            return None

        return self._select_capped(scored, cap)
