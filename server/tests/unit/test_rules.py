from datetime import UTC, date, datetime, timedelta

from app.core.rules import (
    aggregate_behaviour,
    compute_priority,
    level_difficulty_spread,
    resolve_next_free_choice,
    score_to_level,
    select_weak_concepts,
    update_level_after_quiz,
    update_streak,
)
from app.models.domain import BehaviourLog, StudentProgress


def _attempt(concept, is_correct, question_text="q", correct_answer="A"):
    return {
        "concept": concept,
        "is_correct": is_correct,
        "question_text": question_text,
        "correct_answer": correct_answer,
    }


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


def test_level_difficulty_spread_scales_and_sums():
    for level in ("beginner", "intermediate", "advanced"):
        spread = level_difficulty_spread(level, total=15)
        assert sum(spread.values()) == 15
    # Beginner skews easy, advanced skews hard.
    assert level_difficulty_spread("beginner")["easy"] > level_difficulty_spread("beginner")["hard"]
    assert level_difficulty_spread("advanced")["hard"] > level_difficulty_spread("advanced")["easy"]
    # Unknown level falls back to an even spread.
    assert level_difficulty_spread("unknown", total=15) == {"easy": 5, "medium": 5, "hard": 5}


def test_select_weak_concepts_flags_struggles_and_retires_mastered():
    attempts = [
        # "trends" mastered: most recent two correct -> excluded
        _attempt("trends", True),
        _attempt("trends", True),
        _attempt("trends", False),
        # "reactions" still weak: recent wrong
        _attempt("reactions", False),
        _attempt("reactions", True),
        # "flame" never wrong -> not a struggle, excluded
        _attempt("flame", True),
    ]
    weak = select_weak_concepts(attempts)
    concepts = [item["concept"] for item in weak]
    assert "reactions" in concepts
    assert "trends" not in concepts  # mastered (last 2 correct)
    assert "flame" not in concepts  # no wrong answers


def test_select_weak_concepts_orders_by_severity():
    attempts = [
        _attempt("a", False),
        _attempt("a", True),  # accuracy 0.5
        _attempt("b", False),
        _attempt("b", False),  # accuracy 0.0 -> most severe, first
    ]
    weak = select_weak_concepts(attempts)
    assert weak[0]["concept"] == "b"
    assert weak[0]["sample_question"] == "q"


def test_update_streak_increments_on_consecutive_day():
    today = date(2026, 7, 3)
    assert update_streak(today - timedelta(days=1), 4, today) == 5


def test_update_streak_noop_when_already_studied_today():
    today = date(2026, 7, 3)
    assert update_streak(today, 4, today) == 4


def test_update_streak_resets_after_gap():
    today = date(2026, 7, 3)
    assert update_streak(today - timedelta(days=3), 10, today) == 1


def test_update_streak_starts_from_none():
    today = date(2026, 7, 3)
    assert update_streak(None, 0, today) == 1


def test_resolve_next_free_choice_tomorrow_and_in_2_days():
    today = date(2026, 7, 6)  # Monday
    assert resolve_next_free_choice("tomorrow", today) == date(2026, 7, 7)
    assert resolve_next_free_choice("in_2_days", today) == date(2026, 7, 8)


def test_resolve_next_free_choice_weekend_from_weekday():
    monday = date(2026, 7, 6)
    assert resolve_next_free_choice("this_weekend", monday) == date(2026, 7, 11)  # Saturday


def test_resolve_next_free_choice_weekend_from_weekend():
    saturday = date(2026, 7, 11)
    assert resolve_next_free_choice("this_weekend", saturday) == saturday


def test_resolve_next_free_choice_not_sure_returns_none():
    today = date(2026, 7, 6)
    assert resolve_next_free_choice("not_sure", today) is None
