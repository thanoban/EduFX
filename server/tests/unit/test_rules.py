from datetime import UTC, date, datetime, timedelta

from app.core.rules import (
    aggregate_behaviour,
    compute_priority,
    score_to_level,
    update_level_after_quiz,
)
from app.models.domain import BehaviourLog, StudentProgress


def test_score_to_level_thresholds():
    assert score_to_level(20) == "beginner"
    assert score_to_level(55) == "intermediate"
    assert score_to_level(88) == "advanced"


def test_scheduler_priority_deadline_and_cooldown_logic():
    overdue = StudentProgress(
        id=1,
        student_id=1,
        subtopic_id=1,
        current_level="beginner",
        last_studied_date=date.today() - timedelta(days=5),
        last_quiz_score=20,
        total_sessions=1,
    )
    score, overdue_flag = compute_priority(overdue, date.today())
    assert score > 999
    assert overdue_flag is True


def test_level_transition_rules():
    assert update_level_after_quiz("intermediate", 20) == "beginner"
    assert update_level_after_quiz("intermediate", 60) == "intermediate"
    assert update_level_after_quiz("intermediate", 85) == "advanced"


def test_behaviour_aggregation_percentages():
    logs = [
        BehaviourLog(0, 1, 1, datetime.now(UTC), True, False, False, False, False, False, False, 100),
        BehaviourLog(0, 1, 1, datetime.now(UTC), True, True, False, False, False, False, False, 80),
        BehaviourLog(0, 1, 1, datetime.now(UTC), True, False, True, True, False, True, False, 20),
    ]
    summary = aggregate_behaviour(logs)
    assert summary["phone_percent"] == 33
    assert summary["drowsy_percent"] == 33
    assert summary["away_percent"] == 33
