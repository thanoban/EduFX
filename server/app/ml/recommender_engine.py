"""RecommenderEngine — the "what should I study next?" model layer.

This is the recommendation half of the old SchedulerService, extracted so it
has a single responsibility: rank a student's subtopics best-first. It is
deliberately **availability-agnostic** — it knows nothing about free days,
session length, streaks, or reminders. It returns the *full* ranked list; the
SchedulingAgent downstream decides how many of those the student has time for
today.

Ranking has two paths, mirroring the previous behaviour exactly:
- ML path: the trained DKT (or BKT fallback) predictor scores each subtopic via
  app.ml.recommender.score_candidate. Used when a predictor is loaded and the
  student has enough attempt history.
- Rule-based fallback: deadline/cooldown priority from app.core.rules. Used when
  no model is available or history is too thin.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.core.rules import compute_priority, is_on_cooldown
from app.ml.bkt import BKTModel
from app.ml.dkt import DKTInference
from app.ml.recommender import (
    blended_mastery,
    build_interaction_history,
    classify_bucket,
    score_candidate,
)
from app.models.domain import StudentProgress, Subtopic
from app.repositories.contracts import (
    ProgressRepositoryContract,
    ResultsRepositoryContract,
    SchedulerRepositoryContract,
)
from app.repositories.progress_repository import ProgressRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository


@dataclass
class ScoredCandidate:
    """A single ranked subtopic. `bucket` ("weak" | "strong") lets the
    SchedulingAgent compose a weak/strong mix without re-deriving mastery."""

    bucket: str
    score: float
    overdue: bool
    progress: StudentProgress
    subtopic: Subtopic


class RecommenderEngine:
    def __init__(
        self,
        scheduler_repository: SchedulerRepositoryContract | SchedulerRepository,
        progress_repository: ProgressRepositoryContract | ProgressRepository,
        results_repository: ResultsRepositoryContract | ResultsRepository,
    ) -> None:
        self.scheduler_repository = scheduler_repository
        self.progress_repository = progress_repository
        self.results_repository = results_repository
        self.predictor = self._load_predictor()

    def rank_candidates(self, student_id: int, today: date) -> list[ScoredCandidate]:
        """Full, uncapped ranking of a student's subtopics, best-first.

        Prefers the model ranking when it produces candidates; otherwise falls
        back to the rule-based priority ranking.
        """
        progress_records = self.scheduler_repository.get_student_progress(student_id)
        subtopics_by_id = {item.id: item for item in self.scheduler_repository.list_subtopics()}

        model_scored = self._rank_with_model(student_id, progress_records, subtopics_by_id, today)
        if model_scored:
            return sorted(model_scored, key=lambda candidate: candidate.score, reverse=True)

        rule_scored = self._rank_with_rules(progress_records, subtopics_by_id, today)
        return sorted(rule_scored, key=lambda candidate: candidate.score, reverse=True)

    def _rank_with_rules(
        self,
        progress_records: list[StudentProgress],
        subtopics_by_id: dict[int, Subtopic],
        today: date,
    ) -> list[ScoredCandidate]:
        candidates: list[ScoredCandidate] = []
        for progress in progress_records:
            if is_on_cooldown(progress, today):
                continue
            priority, overdue = compute_priority(progress, today)
            subtopic = subtopics_by_id.get(progress.subtopic_id)
            if subtopic is None:
                subtopic = self.scheduler_repository.get_subtopic(progress.subtopic_id)
            bucket = "strong" if progress.current_level == "advanced" else "weak"
            candidates.append(ScoredCandidate(bucket, priority, overdue, progress, subtopic))
        return candidates

    def _rank_with_model(
        self,
        student_id: int,
        progress_records: list[StudentProgress],
        subtopics_by_id: dict[int, Subtopic],
        today: date,
    ) -> list[ScoredCandidate]:
        """Model ranking, or an empty list when the model can't be applied
        (no predictor loaded, no/too-little history, or a prediction error)."""
        if self.predictor is None:
            return []

        sessions = self.progress_repository.get_student_session_history(student_id)
        if not sessions:
            return []

        attempts_by_session = {
            session.id: self.results_repository.get_attempts(session.id)
            for session in sessions
        }
        history = build_interaction_history(sessions, attempts_by_session)
        if len(history) < 3:
            return []

        try:
            model_mastery = self.predictor.predict_mastery(history)
            model_p_correct = self.predictor.predict_p_correct(history)
        except Exception:
            return []

        mastery_by_skill = blended_mastery(progress_records, model_mastery)
        scored: list[ScoredCandidate] = []
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
                subtopic = self.scheduler_repository.get_subtopic(progress.subtopic_id)
            bucket = classify_bucket(mastery)
            scored.append(ScoredCandidate(bucket, score, overdue, progress, subtopic))

        return scored

    @staticmethod
    def _load_predictor():
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
