"""SchedulingAgent — the deterministic "when / how much / keep-going" layer.

The scheduling half of the old SchedulerService. It takes the RecommenderEngine's
ranked list (what to study) and applies the student's free-time/availability caps
(how much to serve today), then owns the study-cadence state: streaks now, with
next-free check-ins (SettingsService) and reminders (ReminderService) as its
sibling collaborators. It never imports the model (bkt/dkt) directly — it only
consumes the engine's ranked candidates.
"""
from datetime import date

from app.core.rules import CAP_TO_WEAK_STRONG_SPLIT, DURATION_TO_CAP, update_streak
from app.ml.recommender_engine import RecommenderEngine, ScoredCandidate
from app.models.domain import Student
from app.models.dto import StudyPlanItemDTO
from app.repositories.contracts import ResultsRepositoryContract
from app.repositories.results_repository import ResultsRepository

# Fallback plan size for a student who hasn't set availability in Settings yet
# — unchanged historical behaviour (2 weak + 1 strong) so nothing breaks for
# existing/unconfigured students. The dashboard nudges them to set it once.
_UNCONFIGURED_DEFAULT_CAP = 3


class SchedulingAgent:
    def __init__(
        self,
        recommender_engine: RecommenderEngine,
        results_repository: ResultsRepositoryContract | ResultsRepository,
    ) -> None:
        self.recommender_engine = recommender_engine
        self.results_repository = results_repository

    def get_todays_plan(self, student_id: int) -> list[StudyPlanItemDTO]:
        today = date.today()
        student = self.results_repository.get_student(student_id)
        cap = self._resolve_cap(student, today)
        if cap == 0:
            return []

        candidates = self.recommender_engine.rank_candidates(student_id, today)
        return self._select_capped(candidates, cap)

    def register_study_session(self, student_id: int) -> None:
        """Record that the student completed a study session today and roll the
        streak forward. Called by ResultsService after a quiz is submitted so the
        agent owns all cadence/engagement state in one place."""
        student = self.results_repository.get_student(student_id)
        if student is None:
            return
        today = date.today()
        student.current_streak = update_streak(student.last_study_date, student.current_streak, today)
        student.longest_streak = max(student.longest_streak, student.current_streak)
        student.last_study_date = today
        self.results_repository.save_student(student)

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

    def _select_capped(self, scored: list[ScoredCandidate], cap: int) -> list[StudyPlanItemDTO]:
        """Pick `cap` ScoredCandidates, preferring the weak/strong mix for that
        cap size (see CAP_TO_WEAK_STRONG_SPLIT), falling back to top-score fill if
        either bucket is short.
        """
        weak_n, strong_n = CAP_TO_WEAK_STRONG_SPLIT.get(cap, (cap, 0))
        weak = sorted((item for item in scored if item.bucket == "weak"), key=lambda item: item.score, reverse=True)[:weak_n]
        strong = sorted((item for item in scored if item.bucket == "strong"), key=lambda item: item.score, reverse=True)[:strong_n]
        chosen = weak + strong

        if len(chosen) < cap:
            filler = sorted(scored, key=lambda item: item.score, reverse=True)
            for item in filler:
                if item not in chosen:
                    chosen.append(item)
                if len(chosen) == cap:
                    break

        return [
            StudyPlanItemDTO(
                subtopic_id=item.subtopic.id,
                subtopic_title=item.subtopic.title,
                group_name=item.subtopic.group_name,
                current_level=item.progress.current_level,  # type: ignore[arg-type]
                is_overdue=item.overdue,
                last_quiz_score=item.progress.last_quiz_score,
                last_studied_date=item.progress.last_studied_date,
                type=item.bucket,  # type: ignore[arg-type]
            )
            for item in chosen[:cap]
        ]
