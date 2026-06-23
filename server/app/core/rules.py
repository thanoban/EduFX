from collections import Counter
from datetime import date

from app.models.domain import BehaviourLog, StudentProgress

LEVEL_ORDER = ("beginner", "intermediate", "advanced")
LEVEL_MULTIPLIERS = {"beginner": 3.0, "intermediate": 2.0, "advanced": 0.5}
LEVEL_DEADLINES = {"beginner": 3, "intermediate": 7, "advanced": 14}


def score_to_level(score_percent: int) -> str:
    if score_percent <= 40:
        return "beginner"
    if score_percent <= 70:
        return "intermediate"
    return "advanced"


def update_level_after_quiz(current_level: str, score_percent: int) -> str:
    index = LEVEL_ORDER.index(current_level)
    if score_percent < 40:
        return LEVEL_ORDER[max(index - 1, 0)]
    if score_percent > 70:
        return LEVEL_ORDER[min(index + 1, len(LEVEL_ORDER) - 1)]
    return current_level


def days_since_last_studied(progress: StudentProgress, today: date) -> int:
    if progress.last_studied_date is None:
        return 99
    return max((today - progress.last_studied_date).days, 0)


def is_on_cooldown(progress: StudentProgress, today: date) -> bool:
    return days_since_last_studied(progress, today) <= 1


def compute_priority(progress: StudentProgress, today: date) -> tuple[float, bool]:
    days = days_since_last_studied(progress, today)
    deadline = LEVEL_DEADLINES[progress.current_level]
    overdue = days > deadline
    if overdue:
        return 999.0 + days, True
    return days * LEVEL_MULTIPLIERS[progress.current_level], False


def calculate_focus_score(log: BehaviourLog) -> int:
    score = 100
    score -= 40 if log.phone_detected else 0
    score -= 50 if log.absent else 0
    score -= 30 if log.drowsy else 0
    score -= 20 if log.looking_away else 0
    score -= 20 if log.multiple_persons else 0
    score -= 10 if log.talking else 0
    return max(score, 0)


def aggregate_behaviour(logs: list[BehaviourLog]) -> dict[str, int]:
    if not logs:
        return {
            "phone_percent": 0,
            "drowsy_percent": 0,
            "away_percent": 0,
            "talking_percent": 0,
            "absent_percent": 0,
            "focus_score": 100,
        }

    total = len(logs)
    counts = Counter(
        {
            "phone_percent": sum(1 for item in logs if item.phone_detected),
            "drowsy_percent": sum(1 for item in logs if item.drowsy),
            "away_percent": sum(1 for item in logs if item.looking_away),
            "talking_percent": sum(1 for item in logs if item.talking),
            "absent_percent": sum(1 for item in logs if item.absent),
            "focused": sum(1 for item in logs if item.focus_score >= 80),
        }
    )
    return {
        "phone_percent": round((counts["phone_percent"] / total) * 100),
        "drowsy_percent": round((counts["drowsy_percent"] / total) * 100),
        "away_percent": round((counts["away_percent"] / total) * 100),
        "talking_percent": round((counts["talking_percent"] / total) * 100),
        "absent_percent": round((counts["absent_percent"] / total) * 100),
        "focus_score": round((counts["focused"] / total) * 100),
    }

