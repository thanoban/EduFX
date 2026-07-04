# EduFX ML Recommender — Knowledge Tracing (BKT + DKT)

## Context — why this plan exists

EduFX currently recommends subtopics with a hand-tuned heuristic in
`server/app/services/scheduler_service.py` + `compute_priority()` in
`server/app/core/rules.py`:

```
priority = days_since_last_studied × level_multiplier   (beginner 3.0, inter 2.0, adv 0.5)
```

It picks 2 "weak" + 1 "strong" subtopic per day, with an overdue override and a
1-day cooldown. This is a real, working rule — but it is not *learned* from
data, and it has three concrete blind spots:

1. **No cross-topic transfer.** It can't know that mastering "G1 thermal
   stability" (concept: polarizing power) makes "G2 thermal stability" easier —
   every subtopic is scored in isolation.
2. **No uncertainty.** A student who has answered 1 question on a subtopic and
   a student who has answered 20 get treated identically if their last score is
   the same.
3. **No behaviour signal.** A quiz passed while phone-distracted counts exactly
   the same as one passed while fully focused, even though EduFX already
   collects `focus_score` per session via the webcam tracker.

The user wants to replace/augment this with a **real machine-learning
recommender**, explicitly as a learning exercise — building understanding of
both classic ML and deep learning for adaptive education, the same way the
Qwen fine-tune was a hands-on deep-learning exercise. Two models were agreed:

- **BKT** (Bayesian Knowledge Tracing) — classic, fully interpretable.
- **DKT** (Deep Knowledge Tracing) — an LSTM, captures cross-topic transfer.
- Both **behaviour-aware**: `focus_score` feeds the model so a distracted
  correct answer counts as weaker evidence of mastery.
- **DKT training happens in Google Colab**, by the user, so they build it
  hands-on (same workflow as the earlier Qwen fine-tune) — I hand back code +
  a guide, they run it and hand back the trained weights.

This is a small **self-trained statistical/deep model**, not an LLM call — it
does not touch the "Vertex-AI-only for generation" project rule, and (explained
below) needs no GPU to serve.

---

## The concept: Knowledge Tracing, explained

**Knowledge Tracing (KT)** is the standard formulation of "recommend the right
next thing to study" in adaptive learning research. The question it answers:

> Given everything a student has done so far, what is the probability they have
> mastered each skill — and therefore, what should they attempt next?

A "skill" here = one of EduFX's 10 S-block subtopics. The input is the
student's ordered history of interactions: `(subtopic, correct/incorrect,
focus_level)` triples. The output is `P(mastered)` per subtopic, which then
feeds a **recommendation policy** (below) that turns probabilities into an
actual "study this next" decision.

### Model 1 — BKT (Bayesian Knowledge Tracing)

**What it is.** For *each skill independently*, BKT is a 2-state Hidden Markov
Model. The hidden state is binary: has the student learned this skill or not?
You never observe that directly, only whether they answered correctly. Four
parameters per skill describe the whole process:

| Param | Meaning |
|---|---|
| `L0` | P(already knew it before any practice) — the prior |
| `T`  | P(transitions from unknown → known on one attempt) — the learn rate |
| `S`  | P(answers wrong even though they know it) — "slip" |
| `G`  | P(answers right by luck even though they don't know it) — "guess" (~0.25 for 4-option MCQ) |

Two structural assumptions make it a *learning* model, not a generic HMM: state
is **absorbing** (once learned, BKT assumes no forgetting) and learning only
happens *between* attempts, at rate `T`.

**How it's fit.** Standard **Expectation-Maximization (EM)** — the Baum-Welch
algorithm: repeatedly (a) run forward-backward to get the posterior probability
of "known" at every timestep given the current parameters, then (b)
re-estimate `L0, T, S, G` from those posteriors. Repeat until the likelihood
stops improving. Pure numpy, trains on ~800 synthetic students in well under a
second.

**Why it's a great baseline.** Every number is defensible in a viva — "this
skill's slip is 0.08, so a wrong answer here is probably a slip, not ignorance."
Its structural weakness (which motivates DKT) is that each skill's HMM is
blind to every other skill.

**Behaviour-aware twist (already implemented in `bkt.py`).** Rather than
retraining EM per focus level, focus is folded in at *inference* time: when
updating the mastery belief after an answer, low focus inflates the effective
slip/guess toward 0.5 — i.e. a distracted answer carries almost no information,
so it barely moves the belief. Verified: a student who drills a skill fully
focused reaches mastery 0.999; the identical drill while distracted only
reaches 0.959; never-touching a skill stays near the 0.01–0.09 prior.

### Model 2 — DKT (Deep Knowledge Tracing)

**What it is** (Piech et al., NeurIPS 2015 — the paper that started this whole
subfield). Instead of one HMM per skill, DKT uses **one shared LSTM** that
reads the student's *entire* interaction sequence and, at every timestep,
outputs `P(correct)` for **all 10 skills simultaneously** — not just the one
just attempted.

Because the network is shared across skills, it can learn things BKT
structurally cannot: e.g. that succeeding on "G1 thermal stability" (which
teaches the "polarizing power" concept) should raise the predicted `P(correct)`
on "G2 thermal stability" too, even though the student hasn't touched G2 yet.
This cross-topic transfer is the entire reason to reach for a deep model here —
your 10 subtopics are explicitly designed with this kind of shared-concept
structure (see `PREREQUISITES` in `app/ml/__init__.py`).

**Input encoding.** At step *t*, the network reads a vector:

```
[ one-hot(skill) if correct | one-hot(skill) if wrong | focus ]
    \_______ 10 dims _______/   \_______ 10 dims _______/   1 dim
```

21 dimensions total (`2 × NUM_SKILLS + 1`). The trailing `focus` value is the
**behaviour-aware** part — instead of hand-crafting how focus should discount
evidence (as BKT does), the LSTM learns it directly from the training data,
because the simulator already couples low focus with lower correctness and
smaller ability gains.

**Output & training.** The LSTM's hidden state at step *t* feeds a linear head
producing 10 logits → sigmoid → `P(correct)` per skill. The training target at
step *t* is whether the student got the skill they attempted at step *t+1*
right — a standard **next-step prediction** objective, masked binary
cross-entropy so padding doesn't pollute the loss.

**Where the code lives:** `server/app/ml/dkt.py` is deliberately split in two:

- **Numpy half (`DKTInference`)** — hand-rolls the LSTM forward pass
  (input/forget/cell/output gates) from exported weights. **This is what the
  server runs.** No torch import needed to serve it.
- **Torch half (`build_model`, `train_dkt`, `export_numpy`)** — import-guarded
  behind a `_require_torch()` check, so importing `dkt.py` on a torch-free
  server is safe; the torch code path is simply never reached. This is what
  Colab runs.

### Why no GPU / hosting problem (unlike the Qwen fine-tune)

This is the standout practical difference from the earlier LLM fine-tune, and
worth being very explicit about since that earlier work needed a whole hosting
investigation (Azure VM, vLLM, etc.):

| | Fine-tuned Qwen (Task A quiz gen) | DKT recommender |
|---|---|---|
| Parameters | 7,000,000,000 | **~23,000** |
| Size on disk | ~4 GB (4-bit) | **~90 KB** |
| Needs GPU to serve? | Yes | **No** |
| Where it runs | Separate GPU host (Azure/vLLM) | **Inside the existing FastAPI backend, CPU** |
| Inference cost | Seconds, needs a live model server | **Microseconds, in-process** |

The DKT is one small LSTM (hidden size 64). Scoring all 10 subtopics for a
student with a ~50-step history is a handful of matrix multiplies — no
separate deployment, no on/off VM toggling, nothing beyond the numpy file
already in your `requirements.txt`.

### The recommendation policy — coverage-aware spaced repetition (+ ZPD)

Neither model *is* a recommender by itself — they output a mastery / `P(correct)`
per subtopic. The policy that turns those numbers into a study plan must satisfy
an explicit requirement from the user:

> **Teach ALL subtopics, not only the weak ones — but give weak ones more
> focus.** New subtopics get introduced and then revisited (e.g. a day later);
> weak subtopics come back often (e.g. twice as frequently); average subtopics
> at a medium cadence; strong subtopics still resurface occasionally so they
> aren't forgotten.

That is textbook **spaced repetition** with **mastery-adaptive intervals** — the
same idea as Anki/Leitner, but the interval is driven by the ML mastery estimate
instead of a self-report. It also *extends what EduFX already has*:
`LEVEL_DEADLINES` in `rules.py` (beginner 3 / intermediate 7 / advanced 14 days)
is already a per-level review interval — we generalize it so the interval keys
off model mastery, and so **every** subtopic is on a schedule.

**How the pieces combine.** For each of the 10 subtopics we compute a priority
from three factors, then build a *mixed* daily plan rather than an all-weak one:

1. **Mastery tier → base review interval** (how often it should come back):

   | Tier (from model mastery) | Interval | Role in the plan |
   |---|---|---|
   | New (never studied) | introduce now, review +1 day | onboarding — always surfaced early |
   | Weak (mastery ≤ ~0.4) | ~1 day | **most** daily slots — the focus |
   | Average (~0.4–0.7) | ~3 days | medium cadence |
   | Strong (> ~0.7) | ~7–14 days | light maintenance so it isn't forgotten |

2. **Spacing / due-ness**: a subtopic becomes *due* when
   `days_since_studied ≥ its interval`. Overdue items rise in priority (reusing
   the existing overdue logic in `compute_priority`). This is what makes old
   weak subtopics come back "twice" while strong ones wait.

3. **ZPD readiness** (`ZPD_TARGET = 0.65`, band `0.45–0.85` in
   `app/ml/__init__.py`): among *due* subtopics whose hard prerequisites are met
   (`prerequisites_met()`), prefer the one whose predicted `P(correct)` is in the
   "Goldilocks zone" — challenging but not frustrating. This stops the plan from
   throwing a subtopic at a student before they're ready for it, and breaks ties
   sensibly.

**The daily plan is therefore a coverage mix**, e.g. weighted toward weak/due
subtopics but always including any *new* subtopic that needs introducing and any
*strong* subtopic that has gone long enough to need a refresh — so over a week
all 10 subtopics get touched, with weak ones touched the most. This replaces the
current fixed "2 weak + 1 strong" split with a mastery- and spacing-driven mix,
while keeping the same idea of a small, focused daily set.

### Why simulate students instead of training on real EduFX data

Deep KT models in the literature are trained on **thousands** of real student
sequences (e.g. the ASSISTments dataset has ~15,000 students). EduFX currently
has a handful of demo/test students — nowhere near enough to fit an LSTM
without severe overfitting. The standard, legitimate fix (and a good exercise
in itself) is a **synthetic student simulator**
(`server/app/ml/simulator.py`, already built and validated):

- Each virtual student has a hidden per-skill ability (`theta`), starting low.
- Answering follows an **item-response** logistic curve with slip/guess, so
  it behaves like a real 4-option MCQ.
- Practising a skill raises ability with diminishing returns, **scaled by
  focus** — distracted practice barely helps, matching the behaviour-aware
  premise everywhere else in this design.
- Ability on a skill is boosted by mastered prerequisites (`PREREQUISITES`),
  which is exactly the cross-topic transfer structure DKT is meant to
  discover.

Validated output: within-session accuracy rises 0.38 → 0.62 as students
practice, and focused vs distracted accuracy is 0.58 vs 0.42 — both signals
are cleanly present, so a model that successfully learns from this corpus is
demonstrably learning the right things. Real EduFX interaction logs can be fed
into the same pipeline later, once enough accumulate; nothing about the model
code is simulator-specific.

### Handling students who skip behaviour tracking

The webcam check screen already lets a student **skip tracking**
(`webcam-check-screen.tsx` — "Skip tracking" button; `SessionSummary.focus_score`
and `BehaviourSummaryRequest.focus_score` are both `int | None` in the domain
model precisely because tracking is optional per session). The recommender
must not break, and must not unfairly penalize, a student who opts out.

**Design decision:** add an explicit **`tracked` flag** alongside the
continuous `focus` value, rather than silently defaulting untracked sessions to
some guessed focus number:

- When tracking is **on**: `tracked = 1`, `focus = focus_score / 100`.
- When tracking is **off**: `tracked = 0`, `focus = 1.0` (neutral/full credit —
  an opted-out student is never treated as if they were distracted).

This changes the DKT input from `2K + 1` to **`2K + 2`** dimensions
(`server/app/ml/dkt.py`'s `encode_step`), and BKT's focus-adjustment
(`BKTModel._focus_adjust`) treats `tracked=0` as "no discount" — identical to
`focus=1.0`. The simulator (`server/app/ml/simulator.py`) is updated to make
some sessions untracked (a per-student toggle, since in practice a student
tends to consistently enable or disable it) so both models see and learn to
handle the untracked case, not just infer it from an unseen corner of the
input space.

**Why the explicit flag instead of just defaulting focus to 1.0 alone:** it
keeps "fully focused" and "we don't know" statistically distinguishable to the
model even though they get the same *charitable* treatment today — leaving
room for the model to learn a difference later if real data ever shows tracked
and untracked students behave differently, without re-deriving the encoding.

**Product framing (for docs/UI copy, not a behaviour change):** behaviour
tracking is and stays fully optional — the recommender works correctly without
it. The value proposition to surface to the user is "recommendations get more
precise when focus tracking is on, because we can tell a lucky guess made
while distracted apart from a confident, focused answer" — an incentive to
enable it, not a requirement to use the platform.

This must land in `simulator.py` / `bkt.py` / `dkt.py` **before** Colab
training (an encoding change after training invalidates the weights).

---

## What's already built this session (local, uncommitted)

- `server/app/ml/__init__.py` — skill map (10 subtopics ↔ 0-based skill index),
  `mastery_to_level`, prerequisite graph, ZPD constants.
- `server/app/ml/simulator.py` — synthetic student generator, validated (see
  numbers above).
- `server/app/ml/bkt.py` — BKT via EM, pure numpy. **Trained + validated**
  (`artifacts/bkt.json` saved; behaviour-aware inference confirmed).
- `server/app/ml/dkt.py` — DKT torch model + numpy inference, **written, not
  yet trained**.
- `server/requirements.txt` (+numpy), `server/requirements-ml.txt` (torch,
  training-only, not part of the deployed image).

## Immediate deliverable — a self-contained Colab TRAINING guide (the .md)

**Clarified with the user:** the `.md` must contain the actual **Google Colab
training code** — the runnable notebook cells you paste into Colab to train the
model — each with an **explanation and the reasoning behind it**. It is NOT a
description of the backend project files and does NOT reference/upload
`app/ml/*.py`. It is a standalone teaching-and-training document: read the why,
copy the cell, run it, watch it train, download the weights. Same spirit as the
existing `docs/finetune-colab-guide.md`, which has real runnable cells.

**File:** `docs/recommender-colab-training.md`

**Structure (every code section is a full, self-contained, copy-paste Colab
cell, preceded by a plain-English "what this does and why"):**

- **Intro** — what we're training (a DKT knowledge-tracing model that recommends
  the next subtopic by predicting mastery), why it matters (replaces the flat
  rule-based scheduler), and why Colab (hands-on learning; GPU optional because
  the model is tiny).
- **Cell 1 — Install** `torch numpy scikit-learn`, with a note on why torch is
  only needed for *training*, not serving.
- **Cell 2 — Config / skill map**: the 10 S-block subtopics, the prerequisite
  graph, and *why* prerequisites encode the cross-topic transfer DKT will learn.
- **Cell 3 — The student simulator** (full inline code): the generative model of
  learning — latent ability, the item-response (logistic) correctness curve with
  slip/guess, focus-scaled learning, prerequisite boosts. Explanation of *why we
  simulate* (deep KT needs thousands of sequences; EduFX has few real students
  yet) and the validated signals it produces.
- **Cell 4 — Behaviour tracking is optional** (the `tracked` flag): how a
  skipped-webcam session is encoded (`tracked = 0`, `focus = 1.0` — full credit,
  never penalized) vs a tracked one, and *why* an explicit flag beats silently
  guessing a focus number. Also the product framing: tracking stays optional;
  it just makes recommendations sharper when on.
- **Cell 5 — The DKT model** (full inline PyTorch code): the input encoding
  (`2K + 2` = one-hot(skill×correct) + focus + tracked), the LSTM, the
  per-skill sigmoid output head. Explanation of each piece.
- **Cell 6 — Training loop**: masked binary-cross-entropy next-step prediction,
  Adam, per-epoch loss. Explanation of the objective (predict the *next*
  answer) and the masking (ignore padding).
- **Cell 7 — Evaluation**: held-out **ROC-AUC** so you can see it working, and a
  short read on what a good number looks like and how it beats a coin-flip / the
  heuristic.
- **Cell 8 — Export & download**: save the trained weights as `dkt.npz`
  (numpy — for torch-free serving), `dkt.pt` (torch checkpoint), and
  `dkt_meta.json` (architecture record), then `files.download(...)` each.
  Explanation of *why numpy export* = the server runs the model on CPU with no
  torch and no GPU.
- **Hand-off** — send the three downloaded files back; they get placed in
  `server/app/ml/artifacts/`.
- **Why DKT / FAQ / viva talking points** — DKT vs BKT, why no GPU is needed
  (the size/latency table vs the fine-tuned Qwen), and what to say in the viva.

**Consistency requirement:** the model architecture in Cell 5 (LSTM hidden=64,
`2K+2` encoding, gate order) and the export format in Cell 8 (npz key names)
must match `server/app/ml/dkt.py`'s `DKTInference` exactly, so the weights the
guide produces load and run correctly in the backend. The backend `dkt.py`
/`simulator.py`/`bkt.py` get the same `tracked`-flag update (see Files) so the
two stay in lockstep; the guide is the standalone learning+training copy.

BKT needs no Colab (pure numpy, trains instantly) — the guide ends with a one
-liner noting BKT is fit locally and doesn't require this notebook.

## Downstream phases (after artifacts return)

- **Phase 4 — `server/app/ml/evaluate.py`**: held-out simulated students,
  next-answer AUC/accuracy for BKT vs DKT vs a rule-based proxy — the viva
  comparison table ("my ML model beats the heuristic by X%").
- **Phase 5 — recommender wiring**: `server/app/ml/recommender.py` implements the
  **coverage-aware spaced-repetition policy above** — mastery-tier review
  intervals, due-ness/overdue, ZPD tie-break, prerequisite-gating, behaviour
  down-weighting — so it produces a *mixed* daily plan covering all subtopics
  with weak ones weighted highest, not an all-weak list.
  `server/app/services/recommender_service.py` loads DKT if present, else BKT,
  else nothing — graceful degrade. Blended into
  `SchedulerService.get_todays_plan`; the existing `compute_priority` rule stays
  as the fallback when no model is trained, so the app never breaks. The plan
  still returns a small daily set but selects it by mastery + spacing instead of
  the fixed "2 weak + 1 strong" split.
- **Phase 6**: expose via the plan endpoint (or a new `/recommendations`
  route), unit tests under `server/tests/unit/`, and
  `docs/recommender-guide.md` — the full math + behaviour-aware rationale +
  eval numbers + viva talking points, mirroring `docs/finetune-method.md`.

## Files

- **New now (the immediate ask):** `docs/recommender-colab-training.md` — the
  self-contained Colab training guide with full inline code + explanations.
- Edited (behaviour-tracking-optional `tracked` flag; keeps the backend copies
  in sync with the guide's encoding, before Colab training):
  `server/app/ml/simulator.py`, `server/app/ml/bkt.py`, `server/app/ml/dkt.py`.
- After hand-off: `server/app/ml/artifacts/{dkt.npz,dkt.pt,dkt_meta.json}`.
- Later phases: `server/app/ml/evaluate.py`, `server/app/ml/recommender.py`,
  `server/app/services/recommender_service.py`, edits to
  `server/app/services/scheduler_service.py`, tests, `docs/recommender-guide.md`.
- Already created: `server/app/ml/{__init__,simulator,bkt,dkt}.py`,
  requirements files, `artifacts/bkt.json` (the last two regenerated after the
  `tracked`-flag edit, which changes BKT's inference signature too).

## Verification

- **In Colab (user):** `train.py` prints decreasing loss + held-out AUC
  (expect comfortably above 0.5, competitive with/above BKT), and the
  torch-vs-numpy parity assert must pass before export.
- **Locally (after hand-off, no torch needed):** load `DKTInference` from
  `dkt.npz`, run `predict_p_correct` on a hand-built history — drilled skill
  should score high, an untouched skill near base rate, a distracted-drill
  history lower than a focused one.
- **Phase 4:** `python -m app.ml.evaluate` prints the BKT/DKT/rule-based table.
- **Phase 6:** `pytest server/tests/unit` green; hit the plan endpoint and
  confirm recommendations shift with a student's history and focus level.

---

# Appendix A — Full Colab training code (copy-paste cells)

This is the exact content that will become `docs/recommender-colab-training.md`.
Every cell is self-contained: paste into a Colab notebook top-to-bottom and run.
The model architecture (LSTM hidden=64, `2K+2` input encoding, PyTorch gate
order) matches the backend `server/app/ml/dkt.py` `DKTInference`, so the weights
you download load and run in the server with no changes.

---

### Cell 1 — Install

**What & why.** We only need three libraries. `torch` builds and trains the
LSTM. `numpy` handles arrays and, later, the tiny CPU inference the *server*
uses. `scikit-learn` gives us `roc_auc_score` for evaluation. Note: torch is a
*training-only* dependency — the EduFX backend never imports it, because we
export plain numpy weights at the end (Cell 8).

```python
!pip -q install torch numpy scikit-learn
print("installed")
```

---

### Cell 2 — Config & the skill map

**What & why.** Our "skills" are the 10 S-block subtopics. The **prerequisite
graph** encodes which subtopics build on which — e.g. skill 7 (G2 thermal
stability) depends on skill 6 (G2 reactions) and is *primed* by skill 2 (G1
thermal stability, which teaches the same "polarizing power" idea). This
cross-topic structure is exactly what the deep model will learn to exploit and
what the old flat heuristic is blind to.

```python
import numpy as np

NUM_SKILLS = 10
SKILL_LABELS = {
    0: "G1 · Group trends", 1: "G1 · Reactions",     2: "G1 · Thermal stability",
    3: "G1 · Solubility",   4: "G1 · Flame tests",
    5: "G2 · Group trends", 6: "G2 · Reactions",     7: "G2 · Thermal stability",
    8: "G2 · Solubility",   9: "G2 · Flame tests",
}

# skill -> list of (prerequisite_skill, strength 0..1)
# strength >= 0.6 = hard prerequisite (gates recommendation);
# weaker links = cross-group "priming" (a learning boost, not a blocker).
PREREQUISITES = {
    0: [],                    1: [(0, 1.0)],           2: [(1, 1.0)],
    3: [(1, 1.0)],            4: [(1, 1.0)],
    5: [(0, 0.4)],            6: [(5, 1.0), (1, 0.4)], 7: [(6, 1.0), (2, 0.4)],
    8: [(6, 1.0), (3, 0.4)],  9: [(6, 1.0), (4, 0.4)],
}
print("skills:", NUM_SKILLS)
```

---

### Cell 3 — The student simulator (synthetic training data)

**What & why.** Deep knowledge-tracing models need *thousands* of student
histories; EduFX doesn't have that many real students yet. So we hand-write a
small **generative model of learning** and sample virtual students from it —
a standard, legitimate way to prototype (and a great way to understand what the
model must recover).

The three ingredients: (1) each student has a hidden per-skill **ability**
(`theta`) that starts low and grows with practice; (2) **answering** follows a
logistic item-response curve with slip/guess so it behaves like a real 4-option
MCQ; (3) **focus** varies per attempt — low focus both hurts the answer and
slows learning. Mastered prerequisites boost effective ability, creating the
cross-topic transfer DKT should discover.

```python
from dataclasses import dataclass

_DISCRIMINATION = 1.7    # steepness of the correctness curve
_SLIP  = 0.10            # P(wrong | fully mastered)
_GUESS = 0.25            # P(right | no idea) — 4-option MCQ
_LEARN_RATE   = 0.85     # ability gained per focused practice
_PREREQ_BOOST = 0.9      # lift from mastered prerequisites
_START_THETA  = -1.8     # ability floor before practice
_THETA_CEILING = 3.5     # mastery asymptote

def _sigmoid(x): return 1.0 / (1.0 + np.exp(-x))

@dataclass(frozen=True)
class Interaction:
    skill: int
    correct: int
    focus: float     # recorded focus (1.0 if not tracked — see Cell 4)
    tracked: int     # 1 = webcam focus measured, 0 = student skipped tracking

class _SimStudent:
    def __init__(self, rng):
        aptitude = rng.normal(0.0, 0.7)
        self.theta = np.full(NUM_SKILLS, _START_THETA) + aptitude + rng.normal(0, 0.4, NUM_SKILLS)
        self.focus_mean   = float(rng.uniform(0.35, 0.95))
        self.focus_spread = float(rng.uniform(4.0, 10.0))
        # A student tends to consistently enable or skip webcam tracking (~70% use it).
        self.uses_tracking = rng.random() < 0.7
        self._rng = rng

    def sample_focus(self):
        a = self.focus_mean * self.focus_spread
        b = (1 - self.focus_mean) * self.focus_spread
        return float(np.clip(self._rng.beta(a, b), 0.02, 1.0))

    def effective_theta(self, s):
        t = self.theta[s]
        for p, strength in PREREQUISITES.get(s, []):
            t += _PREREQ_BOOST * strength * _sigmoid(self.theta[p])
        return t

    def p_correct(self, s, focus):
        z = _DISCRIMINATION * (self.effective_theta(s) - 0.0)
        base = _GUESS + (1 - _GUESS - _SLIP) * _sigmoid(z)
        distraction = 1.0 - focus
        return float((1 - 0.5 * distraction) * base + 0.5 * distraction * _GUESS)

    def study(self, s, focus):
        headroom = _THETA_CEILING - self.theta[s]
        self.theta[s] += _LEARN_RATE * focus * _sigmoid(headroom)

def _choose_next_skill(st, rng):
    if rng.random() < 0.2:
        return int(rng.integers(NUM_SKILLS))               # exploration
    unlocked = [s for s in range(NUM_SKILLS)
                if all(_sigmoid(st.theta[p]) >= 0.5
                       for p, strg in PREREQUISITES.get(s, []) if strg >= 0.6)]
    if not unlocked:
        unlocked = [0]
    return min(unlocked, key=lambda s: st.theta[s])        # weakest unlocked

def simulate_student(rng, min_len=30, max_len=80):
    st = _SimStudent(rng)
    L = int(rng.integers(min_len, max_len + 1))
    hist = []
    for _ in range(L):
        s = _choose_next_skill(st, rng)
        true_focus = st.sample_focus()          # physically always exists
        correct = int(rng.random() < st.p_correct(s, true_focus))
        st.study(s, true_focus)                 # learning uses the REAL focus
        # What the SYSTEM records depends on whether tracking was on:
        if st.uses_tracking:
            rec_focus, tracked = round(true_focus, 3), 1
        else:
            rec_focus, tracked = 1.0, 0          # not measured -> neutral / full credit
        hist.append(Interaction(s, correct, rec_focus, tracked))
    return hist

def simulate_dataset(n_students=800, seed=42, min_len=30, max_len=80):
    rng = np.random.default_rng(seed)
    return [simulate_student(rng, min_len, max_len) for _ in range(n_students)]

# quick sanity check: learning should rise, focus should help
_d = simulate_dataset(800, seed=42)
_early = np.mean([np.mean([i.correct for i in s[:len(s)//3]]) for s in _d])
_late  = np.mean([np.mean([i.correct for i in s[-len(s)//3:]]) for s in _d])
_all = [(i.focus, i.correct) for s in _d for i in s if i.tracked]
_f = np.array([a for a, _ in _all]); _c = np.array([b for _, b in _all])
print(f"learning: early={_early:.3f} -> late={_late:.3f}")
print(f"focus (tracked only): hi={_c[_f>=0.7].mean():.3f} lo={_c[_f<0.4].mean():.3f}")
print(f"students={len(_d)}  interactions={sum(len(s) for s in _d)}")
```

---

### Cell 4 — Input encoding: behaviour-aware, tracking optional

**What & why.** The LSTM reads one vector per interaction. The first `2K` slots
are the classic DKT encoding: a one-hot of the skill placed in the *first* half
if the answer was correct, the *second* half if wrong. Then we append **two**
behaviour slots:

- `focus` — the measured focus (0–1);
- `tracked` — 1 if the webcam measured focus, 0 if the student skipped it.

**Why an explicit `tracked` flag** (this is the "students can skip tracking"
requirement): a skipped session is recorded as `focus = 1.0, tracked = 0` — the
student gets **full credit and is never penalized** for opting out. The separate
`tracked` bit lets the model tell "genuinely fully focused" apart from "we
didn't measure," so a student who turns tracking off is treated fairly *and* the
model can still learn a difference if one exists. Tracking stays optional; when
it's on, recommendations get sharper because a lucky distracted guess is
distinguishable from a confident focused answer.

```python
INPUT_DIM = 2 * NUM_SKILLS + 2   # 2K one-hot(skill*correct) + focus + tracked

def encode_step(skill, correct, focus, tracked):
    v = np.zeros(INPUT_DIM, dtype=np.float32)
    if correct:
        v[skill] = 1.0
    else:
        v[NUM_SKILLS + skill] = 1.0
    v[2 * NUM_SKILLS]     = float(np.clip(focus, 0.0, 1.0))
    v[2 * NUM_SKILLS + 1] = float(tracked)
    return v

print("input dim:", INPUT_DIM)
```

---

### Cell 5 — The DKT model (PyTorch LSTM)

**What & why.** One shared LSTM reads the sequence; at each step its hidden
state feeds a linear head that outputs one logit per skill. Sigmoid turns each
logit into `P(next answer on that skill is correct)`. Because a *single*
network sees all skills, it can transfer knowledge across them — the whole point
of going deep instead of one-HMM-per-skill (BKT).

```python
import torch
import torch.nn as nn

HIDDEN_DIM = 64

class DKT(nn.Module):
    def __init__(self, input_dim=INPUT_DIM, hidden=HIDDEN_DIM, num_skills=NUM_SKILLS):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden, batch_first=True)
        self.head = nn.Linear(hidden, num_skills)

    def forward(self, x):                 # x: (batch, seq, input_dim)
        out, _ = self.lstm(x)             # out: (batch, seq, hidden)
        return self.head(out)             # logits: (batch, seq, num_skills)

print(DKT())
```

---

### Cell 6 — Training loop (masked next-step prediction)

**What & why.** The learning objective is **predict the next answer**: at step
*t*, the model's prediction for the skill attempted at step *t+1* is compared to
whether the student actually got it right, with binary cross-entropy. We only
supervise the *attempted* skill each step (gather), and we **mask** padded
timesteps so shorter sequences don't pollute the loss. Adam optimizes; the loss
should fall steadily.

```python
def build_tensors(dataset):
    xs, sks, ys = [], [], []
    for seq in dataset:
        if len(seq) < 2:
            continue
        x  = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in seq[:-1]])
        sk = np.array([i.skill   for i in seq[1:]], dtype=np.int64)
        y  = np.array([i.correct for i in seq[1:]], dtype=np.float32)
        xs.append(x); sks.append(sk); ys.append(y)
    maxlen = max(len(x) for x in xs); B = len(xs)
    X  = np.zeros((B, maxlen, INPUT_DIM), np.float32)
    SK = np.zeros((B, maxlen), np.int64)
    Y  = np.zeros((B, maxlen), np.float32)
    M  = np.zeros((B, maxlen), np.float32)
    for i, (x, sk, y) in enumerate(zip(xs, sks, ys)):
        L = len(x); X[i, :L] = x; SK[i, :L] = sk; Y[i, :L] = y; M[i, :L] = 1.0
    return (torch.from_numpy(X), torch.from_numpy(SK),
            torch.from_numpy(Y), torch.from_numpy(M))

def train_dkt(dataset, epochs=20, batch=32, lr=1e-2, seed=0):
    torch.manual_seed(seed)
    model = DKT()
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    bce = nn.BCEWithLogitsLoss(reduction="none")
    X, SK, Y, M = build_tensors(dataset); n = X.shape[0]
    for ep in range(epochs):
        perm = torch.randperm(n); tot = 0.0
        for s in range(0, n, batch):
            idx = perm[s:s + batch]
            xb, skb, yb, mb = X[idx], SK[idx], Y[idx], M[idx]
            logits = model(xb)                                    # (b, seq, K)
            pred = logits.gather(2, skb.unsqueeze(-1)).squeeze(-1)  # (b, seq)
            loss = (bce(pred, yb) * mb).sum() / mb.sum()
            opt.zero_grad(); loss.backward(); opt.step()
            tot += float(loss) * len(idx)
        print(f"epoch {ep + 1:2d}/{epochs}  loss={tot / n:.4f}")
    return model

data = simulate_dataset(800, seed=42)
train_data, val_data = data[:640], data[640:]     # 80/20 split
model = train_dkt(train_data)
```

---

### Cell 7 — Evaluate (held-out ROC-AUC)

**What & why.** The honest test: on students the model never trained on, how
well does its predicted `P(correct)` rank actual correct vs wrong answers?
**ROC-AUC** measures exactly that — 0.5 is a coin flip, 1.0 is perfect. A number
comfortably above 0.5 (typically ~0.7+) means the model genuinely learned the
patterns and is a real improvement over the flat heuristic.

```python
from sklearn.metrics import roc_auc_score

@torch.no_grad()
def evaluate(model, dataset):
    y_true, y_prob = [], []
    for seq in dataset:
        if len(seq) < 2:
            continue
        x = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in seq[:-1]])
        logits = model(torch.from_numpy(x).unsqueeze(0))[0]     # (seq, K)
        probs = torch.sigmoid(logits).numpy()
        for t, nxt in enumerate(seq[1:]):
            y_true.append(nxt.correct)
            y_prob.append(probs[t, nxt.skill])
    return roc_auc_score(y_true, y_prob)

print(f"Held-out ROC-AUC = {evaluate(model, val_data):.4f}")
```

---

### Cell 8 — Export weights, verify numpy parity, download

**What & why.** The EduFX server runs on CPU with **no torch** — so we export
the trained weights to a plain `.npz` and prove a hand-written numpy LSTM
forward pass reproduces PyTorch's output (the `assert`). This parity check
guards the one subtle risk: PyTorch packs the LSTM gates in the order
(input, forget, cell, output), and the server's numpy code must unpack them the
same way. If parity passes, the ~90 KB `dkt.npz` will behave identically inside
FastAPI. We also save `dkt.pt` (to resume training) and `dkt_meta.json`
(architecture record), then download all three.

```python
def _np_forward(w, seq):
    H = w["W_hh"].shape[1]
    h = np.zeros(H, np.float32); c = np.zeros(H, np.float32)
    for i in seq:
        x = encode_step(i.skill, i.correct, i.focus, i.tracked)
        g = w["W_ih"] @ x + w["b_ih"] + w["W_hh"] @ h + w["b_hh"]
        ii = _sigmoid(g[:H]); f = _sigmoid(g[H:2*H])
        gg = np.tanh(g[2*H:3*H]); o = _sigmoid(g[3*H:4*H])
        c = f * c + ii * gg; h = o * np.tanh(c)
    return _sigmoid(w["W_out"] @ h + w["b_out"])

sd = model.state_dict()
weights = dict(
    W_ih=sd["lstm.weight_ih_l0"].cpu().numpy(), W_hh=sd["lstm.weight_hh_l0"].cpu().numpy(),
    b_ih=sd["lstm.bias_ih_l0"].cpu().numpy(),   b_hh=sd["lstm.bias_hh_l0"].cpu().numpy(),
    W_out=sd["head.weight"].cpu().numpy(),      b_out=sd["head.bias"].cpu().numpy(),
)

# --- parity check: numpy must match torch to ~1e-5 ---
sample = val_data[0]
with torch.no_grad():
    xs = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in sample])
    torch_last = torch.sigmoid(model(torch.from_numpy(xs).unsqueeze(0))[0, -1]).numpy()
np_last = _np_forward(weights, sample)
assert np.allclose(torch_last, np_last, atol=1e-5), "numpy/torch mismatch — do NOT ship"
print("parity OK — max diff:", float(np.abs(torch_last - np_last).max()))

import json
np.savez("dkt.npz", **weights)
torch.save(sd, "dkt.pt")
json.dump({"num_skills": NUM_SKILLS, "input_dim": INPUT_DIM, "hidden_dim": HIDDEN_DIM,
           "encoding": "onehot(skill*correct) 2K + focus + tracked"},
          open("dkt_meta.json", "w"), indent=2)

from google.colab import files
for fn in ("dkt.npz", "dkt.pt", "dkt_meta.json"):
    files.download(fn)
print("done — send these three files back")
```

---

### Hand-off & notes

- Send back `dkt.npz`, `dkt.pt`, `dkt_meta.json`; they go into
  `server/app/ml/artifacts/` and the backend loads `dkt.npz` (numpy, CPU).
- **GPU not required** — this model is ~23k parameters; Colab CPU trains it in a
  minute. GPU is only a "nice to have."
- **BKT** (the interpretable baseline) is pure numpy and trains locally in
  under a second — it does not need this notebook. The DKT above is the deep
  model you asked to train hands-on.
