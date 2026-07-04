from __future__ import annotations

from datetime import date

from app.core.rules import days_since_last_studied
from app.ml import PREREQUISITES, ZPD_HIGH, ZPD_LOW, ZPD_TARGET, subtopic_id_to_skill
from app.ml.simulator import Interaction
from app.models.domain import QuizAttempt, SessionSummary, StudentProgress


LEVEL_TO_MASTERY_PROXY = {
    "beginner": 0.25,
    "intermediate": 0.55,
    "advanced": 0.80,
}


def build_interaction_history(
    sessions: list[SessionSummary],
    attempts_by_session: dict[int, list[QuizAttempt]],
) -> list[Interaction]:
    """Flatten a student's quiz attempts into DKT/BKT Interaction history.

    The trained models expect question-level interactions ordered over time.
    Each quiz attempt inherits the session's focus score because focus is tracked
    at session granularity in the current backend schema.
    """
    history: list[Interaction] = []
    for session in sorted(sessions, key=lambda item: (item.created_at, item.id)):
        tracked = 1 if session.webcam_enabled and session.focus_score is not None else 0
        focus = 1.0 if tracked == 0 else max(0.0, min(session.focus_score / 100.0, 1.0))
        attempts = sorted(
            attempts_by_session.get(session.id, []),
            key=lambda item: (item.created_at, item.id),
        )
        for attempt in attempts:
            history.append(
                Interaction(
                    skill=subtopic_id_to_skill(attempt.subtopic_id),
                    correct=int(attempt.is_correct),
                    focus=focus,
                    tracked=tracked,
                )
            )
    return history


def blended_mastery(
    progress_records: list[StudentProgress],
    model_mastery: dict[int, float],
) -> dict[int, float]:
    """Blend quiz-history mastery with the student's current assigned level.

    Diagnostic results already populate `current_level`, while BKT/DKT add
    attempt-history evidence. Blending the two prevents unseen skills from
    collapsing to a cold-start prior while still letting the trained models move
    the estimate based on real quiz behaviour.
    """
    mastery: dict[int, float] = {}
    for progress in progress_records:
        skill = subtopic_id_to_skill(progress.subtopic_id)
        proxy = LEVEL_TO_MASTERY_PROXY.get(progress.current_level, 0.25)
        model_value = model_mastery.get(skill, proxy)
        if progress.total_sessions <= 0:
            mastery[skill] = proxy
        else:
            mastery[skill] = (0.7 * model_value) + (0.3 * proxy)
    return mastery


def prerequisites_met(skill: int, mastery_by_skill: dict[int, float], threshold: float = 0.6) -> bool:
    for prereq, strength in PREREQUISITES.get(skill, []):
        if strength >= 0.6 and mastery_by_skill.get(prereq, 0.0) < threshold:
            return False
    return True


def classify_bucket(mastery: float) -> str:
    return "strong" if mastery > 0.70 else "weak"


def due_interval_days(progress: StudentProgress, mastery: float) -> int:
    if progress.total_sessions <= 0:
        return 0
    if mastery <= 0.40:
        return 1
    if mastery <= 0.70:
        return 3
    return 7


def score_candidate(
    *,
    progress: StudentProgress,
    mastery: float,
    p_correct: float,
    readiness: dict[int, float],
    today: date,
) -> tuple[float, bool]:
    """Score a subtopic for the daily study plan.

    Prioritises:
    - weak topics (low mastery)
    - spaced repetition / due-ness
    - ZPD-fit: challenging but not frustrating
    - new-but-unlocked topics for coverage
    """
    skill = subtopic_id_to_skill(progress.subtopic_id)
    days = days_since_last_studied(progress, today)
    interval = due_interval_days(progress, mastery)
    overdue = progress.total_sessions > 0 and days > interval
    due_ratio = 1.5 if progress.total_sessions <= 0 else min(days / max(interval, 1), 3.0)
    zpd_fit = max(0.0, 1.0 - (abs(p_correct - ZPD_TARGET) / max(ZPD_HIGH - ZPD_LOW, 0.01)))
    challenge_bonus = 0.25 if ZPD_LOW <= p_correct <= ZPD_HIGH else 0.0
    struggle_bonus = 1.0 - mastery
    new_topic_bonus = 0.75 if progress.total_sessions <= 0 else 0.0
    maintenance_bonus = 0.25 if mastery > 0.70 and days >= interval else 0.0

    score = (
        (struggle_bonus * 4.0)
        + (due_ratio * 2.0)
        + (zpd_fit * 1.5)
        + challenge_bonus
        + new_topic_bonus
        + maintenance_bonus
        + (3.0 if overdue else 0.0)
    )

    if progress.total_sessions <= 0 and not prerequisites_met(skill, readiness):
        score -= 5.0

    return score, overdue
