from app.core.curriculum_data import SUBTOPIC_NOTES, SUBTOPIC_QUESTIONS, validate


def test_curriculum_data_is_valid():
    validate()


def test_first_stage_questions_carry_real_concepts():
    seeds = SUBTOPIC_QUESTIONS[5]["first"]
    assert len(seeds) == 15
    assert all(seed["concept"] for seed in seeds)
    assert not any(seed["concept"].endswith(("concept 1", "concept 2", "concept 3")) for seed in seeds)


def test_notes_cover_all_three_levels_per_subtopic():
    for subtopic_id, levels in SUBTOPIC_NOTES.items():
        assert set(levels) == {"beginner", "intermediate", "advanced"}, subtopic_id
