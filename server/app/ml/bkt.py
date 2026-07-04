"""Bayesian Knowledge Tracing (BKT) — the interpretable baseline.

WHAT BKT IS
-----------
For each skill, BKT is a tiny **2-state Hidden Markov Model**. The hidden state
is whether the student has *learned* the skill:

    state 0 = "not learned"      state 1 = "learned"

You never observe the state directly — you only see correct/incorrect answers.
BKT infers the probability the student has learned the skill from that stream of
answers, using just **four parameters** per skill:

    L0 = P(already knew it before any practice)      "prior"
    T  = P(learn it on a given attempt | didn't know) "transit / learn rate"
    S  = P(answer wrong | actually knows it)          "slip"
    G  = P(answer right | doesn't know it)            "guess"  (~0.25 for MCQ)

Two structural assumptions make it a *knowledge* model, not a generic HMM:
  * **No forgetting** — once learned, you stay learned (state 1 is absorbing).
  * Learning can only happen between attempts, at rate T.

WHY IT'S A GREAT BASELINE
-------------------------
Every number means something you can defend in a viva ("this student's slip on
Flame Tests is 0.08, so we're confident they've mastered it"). It trains in a
fraction of a second with pure numpy. Its weakness — which DKT fixes — is that
each skill is modelled in isolation: BKT cannot know that mastering G1 thermal
stability makes G2 thermal stability easier.

FITTING
-------
Parameters are learned with **Expectation-Maximization (EM)** — the standard
Baum-Welch algorithm for HMMs:
  * E-step: given current params, compute the posterior probability of each
    hidden state (and each transition) at every timestep, via scaled
    forward-backward.
  * M-step: re-estimate L0, T, S, G from those posteriors.
Repeat until the log-likelihood stops improving.

BEHAVIOUR AWARENESS
-------------------
Focus is folded in at INFERENCE time (keeping EM standard and pure-numpy): when
we update the mastery belief with an answer, a low-focus answer gets a higher
effective guess and slip, so it moves the belief less. A correct answer given
while distracted is treated as weaker evidence of mastery — exactly the intent.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from app.ml import NUM_SKILLS
from app.ml.simulator import Interaction

_ARTIFACT = Path(__file__).parent / "artifacts" / "bkt.json"

# Clamps that keep parameters identifiable and sane. The S + G < 1 constraint
# (a slip plus a guess can't exceed certainty) is the classic BKT guardrail.
_MIN_P, _MAX_P = 0.01, 0.99
_MAX_SLIP, _MAX_GUESS = 0.30, 0.40


@dataclass
class BKTParams:
    """The four learned parameters for one skill."""

    p_L0: float  # prior probability of already knowing
    p_T: float   # learn rate
    p_S: float   # slip
    p_G: float   # guess


def _emission(obs: int, slip: float, guess: float) -> tuple[float, float]:
    """P(obs | not-learned), P(obs | learned) for a single answer."""
    if obs == 1:  # correct
        return guess, 1.0 - slip
    return 1.0 - guess, slip  # wrong


def _forward_backward(
    obs: np.ndarray, params: BKTParams
) -> tuple[np.ndarray, np.ndarray, float]:
    """Scaled forward-backward for one skill's answer sequence.

    Returns (gamma, xi, loglik):
      gamma[t, k]      = P(state_t = k | observations)
      xi[t]            = P(state_t = unknown, state_{t+1} = known | obs)
                         (only this transition matters; known is absorbing)
      loglik           = log P(observations) under the current params
    """
    T = len(obs)
    # states: 0 = not-learned, 1 = learned
    pi = np.array([1.0 - params.p_L0, params.p_L0])
    A = np.array([[1.0 - params.p_T, params.p_T], [0.0, 1.0]])

    alpha = np.zeros((T, 2))
    scale = np.zeros(T)

    # --- forward ---
    b0, b1 = _emission(int(obs[0]), params.p_S, params.p_G)
    alpha[0] = pi * np.array([b0, b1])
    scale[0] = alpha[0].sum() or 1e-12
    alpha[0] /= scale[0]
    for t in range(1, T):
        b0, b1 = _emission(int(obs[t]), params.p_S, params.p_G)
        alpha[t] = (alpha[t - 1] @ A) * np.array([b0, b1])
        scale[t] = alpha[t].sum() or 1e-12
        alpha[t] /= scale[t]

    # --- backward ---
    beta = np.zeros((T, 2))
    beta[-1] = 1.0
    for t in range(T - 2, -1, -1):
        b0, b1 = _emission(int(obs[t + 1]), params.p_S, params.p_G)
        beta[t] = (A @ (np.array([b0, b1]) * beta[t + 1])) / scale[t + 1]

    # --- posteriors ---
    gamma = alpha * beta
    gamma /= gamma.sum(axis=1, keepdims=True) + 1e-12

    xi = np.zeros(T - 1)  # P(unknown_t -> known_{t+1})
    for t in range(T - 1):
        b0, b1 = _emission(int(obs[t + 1]), params.p_S, params.p_G)
        num = alpha[t, 0] * params.p_T * b1 * beta[t + 1, 1]
        denom = scale[t + 1]
        xi[t] = num / (denom + 1e-12)

    loglik = float(np.log(scale + 1e-12).sum())
    return gamma, xi, loglik


def _fit_skill(sequences: list[np.ndarray], iters: int = 60) -> BKTParams:
    """EM fit of one skill's four parameters from many students' answer runs."""
    params = BKTParams(p_L0=0.2, p_T=0.15, p_S=0.1, p_G=0.25)
    prev_ll = -np.inf
    for _ in range(iters):
        l0_num = l0_den = 0.0
        t_num = t_den = 0.0
        s_num = s_den = 0.0
        g_num = g_den = 0.0
        total_ll = 0.0

        for obs in sequences:
            if len(obs) == 0:
                continue
            gamma, xi, ll = _forward_backward(obs, params)
            total_ll += ll

            # L0: expected P(learned) at the first timestep
            l0_num += gamma[0, 1]
            l0_den += 1.0
            # T: expected unknown->known transitions / expected time spent unknown
            if len(obs) > 1:
                t_num += xi.sum()
                t_den += gamma[:-1, 0].sum()
            # S: among learned mass, fraction that answered WRONG
            wrong = (obs == 0).astype(float)
            s_num += (gamma[:, 1] * wrong).sum()
            s_den += gamma[:, 1].sum()
            # G: among not-learned mass, fraction that answered RIGHT
            right = (obs == 1).astype(float)
            g_num += (gamma[:, 0] * right).sum()
            g_den += gamma[:, 0].sum()

        params = BKTParams(
            p_L0=float(np.clip(l0_num / (l0_den + 1e-12), _MIN_P, _MAX_P)),
            p_T=float(np.clip(t_num / (t_den + 1e-12), _MIN_P, _MAX_P)),
            p_S=float(np.clip(s_num / (s_den + 1e-12), _MIN_P, _MAX_SLIP)),
            p_G=float(np.clip(g_num / (g_den + 1e-12), _MIN_P, _MAX_GUESS)),
        )

        if abs(total_ll - prev_ll) < 1e-4:
            break
        prev_ll = total_ll
    return params


class BKTModel:
    """A full BKT recommender: one BKTParams per skill, plus inference."""

    def __init__(self, params: dict[int, BKTParams] | None = None) -> None:
        self.params: dict[int, BKTParams] = params or {}

    # ---- training -------------------------------------------------------
    @classmethod
    def fit(cls, dataset: list[list[Interaction]]) -> "BKTModel":
        """Fit all skills from a dataset of Interaction sequences."""
        # Split each student's history into per-skill answer runs.
        per_skill: dict[int, list[np.ndarray]] = {s: [] for s in range(NUM_SKILLS)}
        for seq in dataset:
            buckets: dict[int, list[int]] = {s: [] for s in range(NUM_SKILLS)}
            for it in seq:
                buckets[it.skill].append(it.correct)
            for skill, obs in buckets.items():
                if obs:
                    per_skill[skill].append(np.array(obs, dtype=np.int64))
        model = cls()
        for skill in range(NUM_SKILLS):
            model.params[skill] = _fit_skill(per_skill[skill])
        return model

    # ---- inference ------------------------------------------------------
    @staticmethod
    def _focus_adjust(params: BKTParams, focus: float) -> tuple[float, float]:
        """Effective (slip, guess) for one answer given the student's focus.

        Full focus (1.0) → the fitted slip/guess. Zero focus → slip and guess
        both inflate toward 0.5, i.e. the answer carries almost no information
        about true mastery. This is the behaviour-aware core.
        """
        distraction = 1.0 - float(np.clip(focus, 0.0, 1.0))
        slip = params.p_S + distraction * (0.5 - params.p_S)
        guess = params.p_G + distraction * (0.5 - params.p_G)
        return slip, guess

    def _filter_skill(self, obs: list[int], focus: list[float], skill: int) -> float:
        """Forward belief filter → P(learned) after the student's history.

        This is the online mastery update: start from the prior L0, and after
        each answer apply Bayes' rule with the focus-adjusted emission, then the
        learning transition.
        """
        p = self.params[skill]
        belief = p.p_L0
        for o, f in zip(obs, focus):
            slip, guess = self._focus_adjust(p, f)
            # Bayes update: P(learned | answer)
            if o == 1:
                like_known, like_unknown = 1.0 - slip, guess
            else:
                like_known, like_unknown = slip, 1.0 - guess
            post = (belief * like_known) / (
                belief * like_known + (1.0 - belief) * like_unknown + 1e-12
            )
            # Learning transition (can only go unknown -> known at rate T)
            belief = post + (1.0 - post) * p.p_T
        return float(belief)

    def predict_mastery(self, history: list[Interaction]) -> dict[int, float]:
        """P(learned) for every skill given the student's full history."""
        per_skill_obs: dict[int, list[int]] = {s: [] for s in range(NUM_SKILLS)}
        per_skill_foc: dict[int, list[float]] = {s: [] for s in range(NUM_SKILLS)}
        for it in history:
            per_skill_obs[it.skill].append(it.correct)
            per_skill_foc[it.skill].append(it.focus)
        mastery = {}
        for skill in range(NUM_SKILLS):
            if per_skill_obs[skill]:
                mastery[skill] = self._filter_skill(
                    per_skill_obs[skill], per_skill_foc[skill], skill
                )
            else:
                mastery[skill] = self.params[skill].p_L0  # no data → prior
        return mastery

    def predict_p_correct(self, history: list[Interaction]) -> dict[int, float]:
        """P(next answer correct) per skill — what the recommender consumes.

        P(correct) = P(learned)*(1 - slip) + P(unlearned)*guess, at full focus.
        """
        mastery = self.predict_mastery(history)
        out = {}
        for skill, m in mastery.items():
            p = self.params[skill]
            out[skill] = m * (1.0 - p.p_S) + (1.0 - m) * p.p_G
        return out

    # ---- persistence ----------------------------------------------------
    def save(self, path: Path = _ARTIFACT) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {str(s): asdict(p) for s, p in self.params.items()}
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: Path = _ARTIFACT) -> "BKTModel":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        params = {int(s): BKTParams(**vals) for s, vals in data.items()}
        return cls(params)

    @classmethod
    def is_available(cls, path: Path = _ARTIFACT) -> bool:
        return Path(path).exists()


if __name__ == "__main__":  # pragma: no cover - manual training run
    from app.ml.simulator import simulate_dataset

    data = simulate_dataset(n_students=800, seed=42)
    model = BKTModel.fit(data)
    model.save()
    print("Fitted BKT parameters per skill:")
    for skill in range(NUM_SKILLS):
        p = model.params[skill]
        print(f"  skill {skill}: L0={p.p_L0:.3f} T={p.p_T:.3f} "
              f"S={p.p_S:.3f} G={p.p_G:.3f}")
