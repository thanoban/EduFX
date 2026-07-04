"""Synthetic student simulator — the generative model of learning.

WHY THIS EXISTS
---------------
Deep knowledge-tracing models (DKT) are trained on *thousands* of student
interaction sequences. EduFX has only a handful of demo students, so we can't
train on real data yet. Instead we hand-write a small model of *how learning
works* and sample virtual students from it. This is a standard, legitimate way
to prototype and validate a KT pipeline — and building the simulator teaches you
the mechanics the models are trying to recover.

THE MODEL (three ingredients)
-----------------------------
1. **Ability.** Each student has a hidden ability per skill, ``theta[skill]``,
   on a logit scale (roughly -3 = no idea, +3 = expert). It starts low and grows
   with practice.

2. **Answering.** The chance of getting a question right follows a logistic
   (item-response) curve::

       P(correct) = guess + (1 - guess - slip) * sigmoid(D * (theta - difficulty))

   ``D`` is discrimination (curve steepness), ``slip`` is the chance of failing
   something you know, ``guess`` is the chance of getting a 4-option MCQ right by
   luck (~0.25). Prerequisites raise the *effective* ability: you learn G2
   solubility faster if you already understand G1 solubility.

3. **Focus.** Each interaction has a focus level in [0, 1] sampled from the
   student's focus tendency. Low focus (distracted, on phone) does two things:
   it adds noise to the answer (a distracted student is closer to guessing) and
   it *reduces how much ability is gained* from the practice. This is the signal
   the behaviour-aware models will learn to use.

OUTPUT
------
``simulate_dataset`` returns a list of students, each a list of ``Interaction``
tuples ``(skill, correct, focus)`` in the order they happened — exactly the
sequence format BKT and DKT consume.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.ml import NUM_SKILLS, PREREQUISITES

# ---------------------------------------------------------------------------
# Fixed "true" item-response parameters of the simulated world. The KT models
# do NOT see these — their job is to recover behaviour consistent with them.
# ---------------------------------------------------------------------------
_DISCRIMINATION = 1.7          # steepness of the correctness curve
_SLIP = 0.10                   # P(wrong | fully mastered)
_GUESS = 0.25                  # P(right | no idea) — 4-option MCQ
_BASE_DIFFICULTY = 0.0         # per-skill difficulty offset (logit scale)

# Learning dynamics
_LEARN_RATE = 0.85             # ability gained per focused practice (logit units)
_PREREQ_BOOST = 0.9            # how much mastered prerequisites lift effective ability
_START_THETA = -1.8            # initial ability floor before any practice
_THETA_CEILING = 3.5           # mastery asymptote used for diminishing returns


@dataclass(frozen=True)
class Interaction:
    """One answered question in a student's history."""

    skill: int      # 0..NUM_SKILLS-1
    correct: int    # 0 or 1
    focus: float    # 0.0..1.0 — 1.0 fully focused (1.0 when not tracked)
    tracked: int = 1  # 1 = webcam focus measured, 0 = student skipped tracking


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


class _SimStudent:
    """A single virtual learner with hidden abilities that grow as they study."""

    def __init__(self, rng: np.random.Generator) -> None:
        # Overall aptitude shifts every skill up or down a bit.
        aptitude = rng.normal(0.0, 0.7)
        # Start well below mastery on every skill, with some individual spread.
        self.theta = np.full(NUM_SKILLS, _START_THETA) + aptitude + rng.normal(0.0, 0.4, NUM_SKILLS)
        # Focus tendency: some students are consistently focused, others not.
        # Beta(a, b) mean = a / (a + b); we sample a per-student mean in [0.3, 0.95].
        self.focus_mean = float(rng.uniform(0.35, 0.95))
        self.focus_spread = float(rng.uniform(4.0, 10.0))  # higher = steadier
        # Behaviour tracking is optional; a student tends to consistently enable
        # or skip it (~70% use it). Untracked sessions get full credit (no focus
        # penalty) so opting out is never punished.
        self.uses_tracking = bool(rng.random() < 0.7)
        self._rng = rng

    def sample_focus(self) -> float:
        """Draw a focus level for one interaction from the student's tendency."""
        a = self.focus_mean * self.focus_spread
        b = (1.0 - self.focus_mean) * self.focus_spread
        return float(np.clip(self._rng.beta(a, b), 0.02, 1.0))

    def effective_theta(self, skill: int) -> float:
        """Ability actually available on a skill, lifted by mastered prerequisites."""
        theta = self.theta[skill]
        for prereq, strength in PREREQUISITES.get(skill, []):
            # A mastered prerequisite (high theta) adds a scaled bonus.
            prereq_mastery = _sigmoid(self.theta[prereq])
            theta += _PREREQ_BOOST * strength * prereq_mastery
        return theta

    def p_correct(self, skill: int, focus: float) -> float:
        """Logistic item-response probability, degraded by low focus."""
        difficulty = _BASE_DIFFICULTY
        z = _DISCRIMINATION * (self.effective_theta(skill) - difficulty)
        base = _GUESS + (1.0 - _GUESS - _SLIP) * _sigmoid(z)
        # Low focus pulls the answer toward a coin-ish guess: blend base with
        # GUESS by how distracted the student is.
        distraction = 1.0 - focus
        return float((1.0 - 0.5 * distraction) * base + 0.5 * distraction * _GUESS)

    def study(self, skill: int, focus: float) -> None:
        """Practising a skill raises its ability — but only if attention is paid.

        Diminishing returns: the closer to mastery, the less each session adds.
        Focus scales the gain, so distracted study barely moves the needle.
        """
        headroom = _THETA_CEILING - self.theta[skill]   # room left up to the ceiling
        gain = _LEARN_RATE * focus * _sigmoid(headroom)
        self.theta[skill] += gain


def _choose_next_skill(student: _SimStudent, rng: np.random.Generator) -> int:
    """Pick which subtopic the student studies next.

    Mimics real usage: mostly work the weakest unlocked skill (prerequisites
    roughly met), with some exploration so every skill appears in the data.
    """
    if rng.random() < 0.2:
        return int(rng.integers(NUM_SKILLS))  # exploration

    unlocked: list[int] = []
    for skill in range(NUM_SKILLS):
        ok = all(
            _sigmoid(student.theta[p]) >= 0.5
            for p, strength in PREREQUISITES.get(skill, [])
            if strength >= 0.6
        )
        if ok:
            unlocked.append(skill)
    if not unlocked:
        unlocked = [0]
    # Weakest unlocked skill first (lowest ability).
    return min(unlocked, key=lambda s: student.theta[s])


def simulate_student(
    rng: np.random.Generator,
    min_len: int = 30,
    max_len: int = 80,
) -> list[Interaction]:
    """Generate one student's full interaction history."""
    student = _SimStudent(rng)
    length = int(rng.integers(min_len, max_len + 1))
    history: list[Interaction] = []
    for _ in range(length):
        skill = _choose_next_skill(student, rng)
        # A true focus level always exists physically and drives correctness and
        # learning — but it is only RECORDED if the student enabled tracking.
        true_focus = student.sample_focus()
        p = student.p_correct(skill, true_focus)
        correct = int(rng.random() < p)
        # The act of attempting the quiz is also studying → ability grows.
        student.study(skill, true_focus)
        if student.uses_tracking:
            rec_focus, tracked = round(true_focus, 3), 1
        else:
            rec_focus, tracked = 1.0, 0  # not measured → neutral / full credit
        history.append(
            Interaction(skill=skill, correct=correct, focus=rec_focus, tracked=tracked)
        )
    return history


def simulate_dataset(
    n_students: int = 800,
    seed: int = 42,
    min_len: int = 30,
    max_len: int = 80,
) -> list[list[Interaction]]:
    """Generate a full synthetic training corpus.

    Returns a list of ``n_students`` sequences. Deterministic for a given seed
    so training and evaluation are reproducible.
    """
    rng = np.random.default_rng(seed)
    return [simulate_student(rng, min_len, max_len) for _ in range(n_students)]


def sequences_to_arrays(
    dataset: list[list[Interaction]],
) -> tuple[list[np.ndarray], list[np.ndarray], list[np.ndarray], list[np.ndarray]]:
    """Flatten Interaction sequences into parallel numpy arrays per student.

    Returns (skills, corrects, focuses, trackeds) where each is a list of 1-D
    arrays, one per student. Convenient for both the numpy BKT and the torch DKT
    loaders.
    """
    skills, corrects, focuses, trackeds = [], [], [], []
    for seq in dataset:
        skills.append(np.array([i.skill for i in seq], dtype=np.int64))
        corrects.append(np.array([i.correct for i in seq], dtype=np.int64))
        focuses.append(np.array([i.focus for i in seq], dtype=np.float32))
        trackeds.append(np.array([i.tracked for i in seq], dtype=np.int64))
    return skills, corrects, focuses, trackeds


if __name__ == "__main__":  # pragma: no cover - manual sanity check
    data = simulate_dataset(n_students=5, seed=1)
    for idx, seq in enumerate(data):
        acc = sum(i.correct for i in seq) / len(seq)
        avg_focus = sum(i.focus for i in seq) / len(seq)
        print(f"student {idx}: {len(seq)} interactions, "
              f"accuracy={acc:.2f}, avg_focus={avg_focus:.2f}")
