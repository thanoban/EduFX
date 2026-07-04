"""Knowledge-tracing recommender for EduFX.

This package turns the hand-tuned scheduler heuristic (app/core/rules.py) into a
*learned* recommender. It answers the core adaptive-learning question:

    "Given everything this student has done, which subtopic should they study
     next to make the most progress?"

The academic name for this is **Knowledge Tracing (KT)**: estimate the
probability that a student has mastered each skill from their history of
attempts, then recommend based on those estimates.

Two models are provided so you can compare a classic baseline against a deep one:

- ``bkt.py`` — Bayesian Knowledge Tracing. A tiny Hidden Markov Model per skill
  with four interpretable parameters. Pure numpy, always available.
- ``dkt.py`` — Deep Knowledge Tracing. One LSTM over the whole interaction
  sequence, capturing cross-skill dependencies BKT cannot. Trained with PyTorch
  offline; served from exported weights so torch is not a runtime dependency.

Both are *behaviour-aware*: the student's focus signal (from the webcam tracker)
feeds into the model so a quiz passed while distracted counts as weaker evidence
of mastery than one passed while focused.

This module (``__init__``) holds the shared vocabulary every other file imports:
the skill map, the level thresholds, and the prerequisite graph.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------
# The 10 S-block subtopics are our "skills". Everywhere in this package we use a
# 0-based skill INDEX (0..9) for array/tensor positions, and translate to the
# app's 1-based subtopic_id (1..10) only at the service boundary.

NUM_SKILLS = 10

# index -> human-readable label (mirrors app/core/curriculum_data.py subtopic ids)
SKILL_LABELS: dict[int, str] = {
    0: "G1 · Group trends",
    1: "G1 · Reactions",
    2: "G1 · Thermal stability",
    3: "G1 · Solubility",
    4: "G1 · Flame tests",
    5: "G2 · Group trends",
    6: "G2 · Reactions",
    7: "G2 · Thermal stability",
    8: "G2 · Solubility",
    9: "G2 · Flame tests",
}


def subtopic_id_to_skill(subtopic_id: int) -> int:
    """App subtopic_id (1..10) -> model skill index (0..9)."""
    return subtopic_id - 1


def skill_to_subtopic_id(skill: int) -> int:
    """Model skill index (0..9) -> app subtopic_id (1..10)."""
    return skill + 1


# ---------------------------------------------------------------------------
# Levels
# ---------------------------------------------------------------------------
# Mirrors app/core/rules.score_to_level so the ML layer speaks the same
# language as the rest of the backend. Kept here to avoid a circular import.

LEVELS = ("beginner", "intermediate", "advanced")


def mastery_to_level(p_known: float) -> str:
    """Map a mastery probability (0..1) to the app's three levels.

    Deliberately aligned with the quiz-score thresholds in rules.py (<=40 /
    <=70 / >70) so a student's ML-estimated level and quiz-driven level are on
    the same scale.
    """
    if p_known <= 0.40:
        return "beginner"
    if p_known <= 0.70:
        return "intermediate"
    return "advanced"


# ---------------------------------------------------------------------------
# Prerequisite graph
# ---------------------------------------------------------------------------
# Which skills should be learned before which. Used by:
#   - the simulator, so a student's latent ability on a skill is boosted once
#     its prerequisites are mastered (realistic learning);
#   - the recommender, so we never recommend a subtopic whose prerequisites the
#     student hasn't reached yet.
#
# Structure per group: trends -> reactions -> {thermal, solubility} -> flame.
# Plus a weak CROSS-group link: each Group 1 skill primes its Group 2 parallel
# (e.g. G1 thermal stability -> G2 thermal stability), because the underlying
# ideas — polarizing power, charge density, lattice vs hydration energy — carry
# straight over. This cross link is the dependency a deep model (DKT) can learn
# and a per-skill model (BKT) or the flat heuristic cannot.

# skill -> list of (prerequisite_skill, strength in 0..1)
PREREQUISITES: dict[int, list[tuple[int, float]]] = {
    0: [],                                   # G1 trends — entry point
    1: [(0, 1.0)],                           # G1 reactions <- trends
    2: [(1, 1.0)],                           # G1 thermal <- reactions
    3: [(1, 1.0)],                           # G1 solubility <- reactions
    4: [(1, 1.0)],                           # G1 flame <- reactions
    5: [(0, 0.4)],                           # G2 trends <- G1 trends (cross, weak)
    6: [(5, 1.0), (1, 0.4)],                 # G2 reactions <- G2 trends (+ G1 reactions)
    7: [(6, 1.0), (2, 0.4)],                 # G2 thermal <- G2 reactions (+ G1 thermal)
    8: [(6, 1.0), (3, 0.4)],                 # G2 solubility <- G2 reactions (+ G1 solubility)
    9: [(6, 1.0), (4, 0.4)],                 # G2 flame <- G2 reactions (+ G1 flame)
}


def prerequisites_met(skill: int, mastery: dict[int, float], threshold: float = 0.6) -> bool:
    """True if all STRONG prerequisites of ``skill`` are mastered.

    Only hard prerequisites (strength >= 0.6) gate a recommendation; the weak
    cross-group links are learning boosts, not blockers.
    """
    for prereq, strength in PREREQUISITES.get(skill, []):
        if strength >= 0.6 and mastery.get(prereq, 0.0) < threshold:
            return False
    return True


# Target mastery band for the recommendation policy (Zone of Proximal
# Development): a subtopic is the "right" thing to study next when the model
# predicts the student is likely-but-not-certain to succeed — challenging
# enough to learn from, not so hard it frustrates.
ZPD_TARGET = 0.65
ZPD_LOW = 0.45
ZPD_HIGH = 0.85
